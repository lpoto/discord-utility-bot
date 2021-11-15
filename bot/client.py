import discord
import sys
import os
import logging
import traceback

import bot.utils.wrappers as wrappers
import bot.utils.misc as utils


class UtilityClient(discord.Client):
    def __init__(self, *, loop=None, bot, **options):
        super().__init__(loop=loop, **options)
        self.bot = bot

    def get_channel(self, channel_id) -> wrappers.ChannelWrapper:
        return wrappers.ChannelWrapper(
            super().get_channel(int(channel_id)))

    def get_user(self, user_id) -> wrappers.MemberWrapper:
        return wrappers.MemberWrapper(super().get_user(int(user_id)))

#  -------------------------------------------------------------- client events

    async def on_ready(self):
        if self.user:
            logging.info(msg='Bot logged in!')
            logging.info(msg='Client: ' + str(self.user))
            # show help command in self.bot's status message
            await self.bot.initialize(self)
            activity = discord.Game(
                name=self.bot.default_prefix + 'help', type=2)
            status = discord.Status.idle
            await self.change_presence(status=status, activity=activity)
            logging.info(msg='Status: {}\n'.format(activity))

    async def on_error(self, error, *args, **kwargs):
        root_dir = os.path.abspath(os.curdir)
        if len(args) == 3:
            ex_type, ex, tb = args
        else:
            ex_type, ex, tb = sys.exc_info()
        x = traceback.format_list(traceback.extract_tb(tb))
        # 10008 -> unknown message, can ignore as mostly
        # when deleting an already deleted message
        if 'error code: 10008' in str(ex):
            return
        result = ['{}({})\n{}'.format(str(ex_type.__name__), str(ex), 56*'-')]
        if str(ex) == 'MySQL Connection not available.':
            await self.bot.database.connect_database()
            return
        for i in x:
            if root_dir in i and 'super()._run_event' not in i:
                result.append(i)
        logging.error('\n'.join(result) + '\n')

    async def on_message(self, msg):
        # check messages if they start with prefix and
        # match any of the commands
        # if so push them to queue, to be processed one by one
        # dispatch different events based on message type
        if (msg.author.id == self.user.id or
                msg.content.split() is None or
                len(msg.content.split()) < 1):
            return
        if str(msg.channel.type) == 'private':
            self.dispatch('dm', msg)
            return
        if str(msg.channel.type) == 'public_thread':
            self.dispatch('thread_message', msg)
            return
        if str(msg.channel.type) != 'text':
            return
        # wrapp message and override default functions to avoid errors
        # and add additional functionality
        msg = wrappers.MessageWrapper(msg)
        if msg.reference is not None and msg.reference.message_id:
            referenced_msg = await msg.channel.fetch_message(
                msg.reference.message_id)
            if referenced_msg is not None:
                self.dispatch('reply', msg, referenced_msg)
            return
        # allow calling help with default prefix, even if a different
        # prefix is set
        if msg.content.startswith("{prefix}help".format(
                prefix=self.bot.default_prefix)):
            await self.bot.handle_message(
                msg, 'help', self.bot.default_prefix)
            return
        # if server has prefix set in it's config, use that prefix,
        # else use default prefix
        prefix = await self.bot.database.get_prefix(msg)
        cmd = msg.content.split()[0][len(prefix):]
        if (msg.content[: len(prefix)] == prefix and
                (cmd in self.bot.commands or
                    cmd in self.bot.games or
                    cmd in self.bot.commands_synonyms)):
            await self.bot.handle_message(msg, cmd, prefix)
            return

    async def on_reply(self, msg, referenced_msg):
        if referenced_msg.author.id != self.user.id:
            return
        # process replies in a queue to avoid missing edits
        await self.bot.queue.add_to_queue(
            'reply:{}'.format(msg.id),
            msg.channel,
            msg,
            referenced_msg.id,
            function=self.bot.handle_reply)

    async def on_dm(self, msg):
        # handle messages sent in private chats
        msg = wrappers.MessageWrapper(msg)
        if msg.reference is not None and msg.reference.message_id:
            referenced_msg = await msg.channel.fetch_message(
                msg.reference.message_id)
            if referenced_msg is not None:
                self.dispatch('dm_reply', msg, referenced_msg)
            return

    async def on_dm_reply(self, msg, referenced_msg):
        if referenced_msg.author.id != self.user.id:
            return
        # call commands that have on_dm_reply function
        for method in sum(self.bot.special_methods['OnDmReply'].values(), []):
            await method(msg, referenced_msg)

    async def on_thread_message(self, msg):
        # handle messages sent in threads
        msg = wrappers.MessageWrapper(msg)
        msg.channel.parent = wrappers.ChannelWrapper(msg.channel.parent)
        parent_msg = await msg.channel.parent.fetch_message(msg.channel.id)
        if parent_msg is None or parent_msg.author.id != msg.guild.me.id:
            return
        # run commands that have on thread message function
        for method in sum(
                self.bot.special_methods['OnThreadMessage'].values(), []):
            await method(msg)

    async def on_member_join(self, member):
        # if server has welcome text set up
        # in database, send welcome text to default channel
        server = member.guild
        default_channel = wrappers.ChannelWrapper(server.system_channel)
        # check if self.bot has send_messages permissions in defaut channel
        hello = await self.bot.database.get_welcome(server)
        if hello is None:
            return
        msg = '{} {}'.format(member.mention, hello)
        await default_channel.send(msg)

    async def on_interaction(self, interaction):
        # catch user interactions on  buttons and dropdown menus
        # and dispatch new events based on interaction type
        try:
            # defer interaction response to avoid
            # "This interaction failed" in discord channel
            # when  clicking on a button created before bot restarted
            await interaction.response.defer()
        except discord.NotFound:
            pass
        msg = wrappers.MessageWrapper(interaction.message)
        if interaction.data['component_type'] == 2:
            self.dispatch('button_click', interaction, msg)
            return
        elif interaction.data['component_type'] == 3:
            self.dispatch('menu_select', interaction, msg)
            return

    async def on_button_click(self, interaction, msg):
        # handle interaction when a button is clicked
        button = utils.get_component(interaction.data['custom_id'], msg)
        if not button:
            return
        # if delete button was clicked and message is deletable
        # (not pinned, and not marked with ND) delete it
        # process button_click in a queue to avoid
        # missing any of the edits
        await self.bot.queue.add_to_queue(
            'click:{}'.format(msg.id),
            msg.channel,
            msg.id,
            interaction,
            button,
            None if not msg.flags.ephemeral else msg,
            function=self.bot.handle_button_click)

    async def on_menu_select(self, interaction, msg):
        # handle interaction when a selection is made
        # in a dropdown menu
        # process menu_selection in a queue to avoid
        # missing any of the edits
        await self.bot.queue.add_to_queue(
            'select:{}'.format(msg.id),
            msg.channel,
            msg.id,
            interaction,
            None if not msg.flags.ephemeral else msg,
            function=self.bot.handle_menu_select)

    async def on_raw_message_delete(self, msg):
        # clean up message's info from database when deleted
        if msg.cached_message:
            m = msg.cached_message
            if (len(m.embeds) < 1 or
                    str(m.channel.type) not in ['text', 'public_thread'] or
                    m.guild.me.id != m.author.id):
                return
        await self.bot.handle_deleted_messages(msg.message_id, msg.channel_id)

    async def on_raw_bulk_message_delete(self, payload):
        # clean up bulk deleted message's info from
        # database when deleted
        for i in payload.message_ids:
            c_m = [msg for msg in payload.cached_messages if msg.id == i]
            c_m = None if len(c_m) == 0 else c_m[0]
            data = {
                'id': i,
                'channel_id': payload.channel_id,
                'guild_id': payload.guild_id,
                'cached_message': None
            }
            event = discord.RawMessageDeleteEvent(data)
            event.cached_message = c_m
            self.dispatch('raw_message_delete', event)

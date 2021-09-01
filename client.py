import discord
import asyncio
import sys
import os
import logging
import traceback
from utils.wrappers import ChannelWrapper, MemberWrapper, MessageWrapper
import utils.misc as utils


class MyClient(discord.Client):
    def __init__(self, *, loop=None, **options):
        super().__init__(loop=loop, **options)
        self.bot = None
        self.handle_exit = None

    def get_channel(self, channel_id) -> ChannelWrapper:
        return ChannelWrapper(
            super().get_channel(int(channel_id)))

    def get_user(self, user_id) -> MemberWrapper:
        return MemberWrapper(super().get_user(int(user_id)))

    async def _run_event(self, coro, event_name, *args, **kwargs):
        """Call a method matching the event recieved from discord."""
        try:
            if event_name != 'on_ready' and not self.bot.ready:
                return
            await super()._run_event(
                coro, event_name, *args, **kwargs)
        except SystemExit:
            self.dispatch('error', event_name, *sys.exc_info())
            self.handle_exit(
                self, self.bot, asyncio.all_tasks(loop=self.loop), True)
        except Exception:
            self.dispatch('error', event_name, *sys.exc_info())

#  -------------------------- events -------------------------

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
        # when deleting or reacting to already deleted message
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
        if str(msg.channel.type) == 'private':
            self.dispatch('dm', msg)
            return
        if (msg.author.id == self.user.id or
                str(msg.channel.type) != 'text' or
                msg.content.split() is None or
                len(msg.content.split()) < 1):
            return
        # wrapp message and override default functions to avoid errors
        # and add additional functionality
        msg = MessageWrapper(msg)
        if msg.reference is not None and msg.reference.message_id:
            referenced_msg = await msg.channel.fetch_message(
                msg.reference.message_id)
            if referenced_msg is not None:
                self.dispatch('reply', msg, referenced_msg)
                return
        # allow calling help with default prefix, even if a different
        # prefix is set
        if msg.content == "{prefix}help".format(
                prefix=self.bot.default_prefix):
            await self.bot.handle_message(
                    msg, 'help', self.bot.default_prefix)
            return
        # if server has prefix set in it's config, use that prefix,
        # else use default prefix
        prefix = await self.bot.database.get_prefix(msg)
        cmd = msg.content.split()[0][len(prefix):]
        if (msg.content[:len(prefix)] == prefix and
                (cmd in self.bot.commands or 
                    cmd in self.bot.commands_synonyms)):
            await self.bot.handle_message(msg, cmd, prefix)
            return

    async def on_dm(self, msg):
        if (msg.author.id == self.user.id or
                msg.content.split() is None or
                len(msg.content.split()) < 1):
            return
        msg = MessageWrapper(msg)
        if msg.reference is not None and msg.reference.message_id:
            referenced_msg = await msg.channel.fetch_message(
                msg.reference.message_id)
            if referenced_msg is not None:
                self.dispatch('dm_reply', msg, referenced_msg)
                return

    async def on_reply(self, msg, referenced_msg):
        # functions that should be processed separately
        if referenced_msg.author.id != self.user.id:
            return
        # iterate through those commands in linked list that
        # have on_reply function
        for i in self.bot.on_reply_commands:
            await i.on_reply(msg, referenced_msg)

    async def on_dm_reply(self, msg, referenced_msg):
        if referenced_msg.author.id != self.user.id:
            return
        for i in self.bot.on_dm_reply_commands:
            await i.on_dm_reply(msg, referenced_msg)

    async def on_raw_reaction_add(self, payload):
        if (payload.user_id == self.user.id or
                (payload.emoji.name not in utils.emojis and
                    payload.emoji.name not in utils.rps_emojis and
                    payload.emoji.name not in utils.number_emojis and
                    payload.emoji.name != utils.thumbs_up and
                    payload.emoji.name != utils.cross and
                    payload.emoji.name != utils.waste_basket)):
            return
        if payload.guild_id:
            await self.bot.handle_raw_reactions(
                payload, payload.event_type, False)
        else:
            await self.bot.handle_raw_reactions(
                payload, payload.event_type, True)

    async def on_raw_reaction_remove(self, payload):
        self.dispatch('raw_reaction_add', payload)

    async def on_time(self, time, execute=True):
        for cmd in self.bot.on_time_commands:
            await cmd.on_time(time, execute)

    async def on_member_join(self, member):
        # if server has welcome text set up
        # in database, send welcome text to default channel
        server = member.guild
        default_channel = ChannelWrapper(server.system_channel)
        # check if self.bot has send_messages permissions in defaut channel
        hello = await self.bot.database.get_welcome(server)
        if hello is None:
            return
        msg = '{} {}'.format(member.mention, hello)
        await default_channel.send(msg)

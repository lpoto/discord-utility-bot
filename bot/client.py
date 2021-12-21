import os
import inspect
import sys
import traceback
import nextcord
import logging
from functools import partial

import bot.commands as commands
import bot.games as games
import bot.decorators as decorators
import bot.utils as utils


class UtilityClient(nextcord.Client):
    """Client connection handling events recieved from Discord."""

    def __init__(self, *, version, database, log_level, **options):
        super().__init__(**options)
        self.version = version
        self.logger = logging.getLogger('utility_client')
        self.logger.setLevel(logging.INFO if not log_level else int(log_level))
        self.ready = False
        self.database = database
        self.commands = {}
        self.games = {}
        self.decorated_methods = {}
        self.queue = utils.Queue(self)
        self.default_type = 'Hello world!'
        self.default_deletion_times = {}

    def __initialize_commands__(self, cmds, cmds_dict):
        # fill commands/games dictionary with all commands objects
        for Command in cmds:
            # save the commands' decorated methods in a dict
            command = Command(self)
            cmds_dict[command.__class__.__name__] = command

            if hasattr(command, 'default_deletion_time'):
                self.default_deletion_times[
                    command.__class__.__name__] = command.default_deletion_time

            self.logger.debug(
                msg='Initializing command: ' + command.__class__.__name__)

            for Dec in (dec for dec in decorators.__dict__.values()
                        if isinstance(dec, type)):
                if not Dec or not hasattr(Dec, 'methods'):
                    continue
                for v in Dec.methods(command).values():
                    if not v:
                        continue
                    self.decorated_methods.setdefault(
                        Dec.__name__,
                        {}).setdefault(command.__class__.__name__,
                                       []).append(partial(v, command))

    async def call_decorated_methods(
            self, method_type, command_name, *args):
        """
        Call all command's methods with 'method_type' decorator.
        """
        if (method_type not in self.decorated_methods or
                command_name not in self.decorated_methods.get(method_type)):
            return

        self.logger.debug(
            msg=f'Calling decorator methods: {method_type} ({command_name})')

        for method in self.decorated_methods.get(method_type
                                                 ).get(command_name):
            if not inspect.iscoroutinefunction(method):
                await method(*args)
            else:
                method(*args)

    async def restart_deletion_timers(self):
        deleting = await self.database.Messages.get_messages_by_info(
            name='deletion_time')

        self.logger.debug(msg='Restarting deletion timers')

        for i in deleting:
            try:
                channel = self.get_channel(i.get('channel_id'))
                msg = await channel.fetch_message(int(i.get('id')))
                timestamp = i.get('info')
                time_dif = utils.time_dif(timestamp)
                if not time_dif or time_dif < 0:
                    await msg.delete()
                else:
                    await msg.delete(delay=time_dif)
            except Exception:
                continue

    async def on_ready(self):
        try:
            if not self.user:
                self.logger.critical(msg='Client user failed to connect!')
                return

            self.logger.debug(msg="Client user logged in\n")

            if not self.database or not self.database.connected:
                self.logger.critical(msg='Failed connecting to database!')
                await self.close()
                return

            self.logger.info(msg='Version: ' + self.version)
            self.logger.info(msg='Client: ' + str(self.user))

            activity = nextcord.Game(name='"Mention me!"', type=2)
            status = nextcord.Status.idle
            await self.change_presence(status=status, activity=activity)
            self.logger.info(msg='Status: Playing {}'.format(activity))

            # initialize all commands and games
            self.__initialize_commands__(
                (cls for cls in commands.__dict__.values()
                    if isinstance(cls, type)), self.commands)
            self.__initialize_commands__(
                (cls for cls in games.__dict__.values()
                    if isinstance(cls, type)), self.games)
            await self.restart_deletion_timers()

            self.ready = True
            self.logger.info(msg='Client ready!\n')
        except Exception as exception:
            self.logger.critical(exception)
            self.ready = False
            await self.close()

    def determine_msg_type(self, msg):
        if (msg.author.id == self.user.id or
                msg.author.bot or
                msg.content.split() is None or
                len(msg.content.split()) < 1):
            return
        if msg.reference is not None and msg.reference.message_id:
            return 'reply'
        if str(msg.channel.type) == 'public_thread':
            return 'thread_message'
        user = self.user if str(
            msg.channel.type) == 'private' else msg.guild.me
        if (len(msg.mentions) == 1 and msg.mentions[0].id == self.user.id and
                msg.channel.permissions_for(user).send_messages):
            return 'client_mention'

    def check_client_permissions(self, msg):
        return not isinstance(msg.channel, nextcord.TextChannel) or (
            msg.channel.permissions_for(msg.guild.me).send_messages and
            msg.channel.permissions_for(msg.guild.me).read_messages and
            msg.channel.permissions_for(msg.guild.me).read_message_history and
            msg.channel.permissions_for(msg.guild.me).manage_roles and
            msg.channel.permissions_for(msg.guild.me).create_public_threads
        )

    async def validate_author(self, msg, type):
        if type == 'client_mention':
            return True
        prev_msg = None
        author_id = None
        if type == 'reply':
            prev_msg = await msg.channel.fetch_message(
                msg.reference.message_id)
            author_id = msg.author.id
        elif type == 'thread_message':
            prev_msg = await msg.channel.parent.fetch_message(
                msg.channel.id)
            author_id = msg.author.id
        if type == 'menu_select':
            prev_msg = await msg.message.channel.fetch_message(
                msg.message.id)
            author_id = msg.user.id
        elif type == 'button_click':
            prev_msg = await msg.message.channel.fetch_message(
                msg.message.id)
            author_id = msg.user.id
        msg_info = await self.database.Messages.get_message(prev_msg.id)
        if (author_id and not msg_info and type == 'reply'
                and not isinstance(msg.channel, nextcord.TextChannel)):
            return True
        if not author_id or not msg_info:
            self.logger.debug(msg='Failed validating author: no info')
            return False
        self.logger.debug(msg='Validating author: {} - {}'.format(
            author_id, msg_info.get('author_id')))
        return (not msg_info.get('author_id') or
                str(msg_info.get('author_id')) == str(author_id))

    async def on_message(self, msg):
        if not self.ready or not self.check_client_permissions(msg):
            return
        # determine the type of message
        msg_type = self.determine_msg_type(msg)
        if (not msg_type or (
                msg_type != 'reply' and
                not isinstance(msg.channel, nextcord.TextChannel) and
                not isinstance(msg.channel, nextcord.threads.Thread)) or
                (msg_type == 'thread_message' and
                 not isinstance(msg.channel, nextcord.threads.Thread))):
            return
        # check if message is valid and user has the permissions to modify
        # the message
        if not await self.validate_author(msg, msg_type):
            return

        self.logger.debug(
            msg='Validated message of type "{}" with id {}'.format(
                msg_type, msg.id))

        # dispatch the event in a queue, to avoid multiple or too few instances
        # of same command
        await self.queue.add_to_queue(
            str(msg.id), msg_type, msg, function=self.dispatch)

    async def on_client_mention(self, msg, old_author_id=None):
        """
        Send the commands' main menu when the bot is tagged.
        If 'old_author_id' is not None, 'msg' will be edited
        instead of sending a new message.
        """
        # All the command should be initialized with methods with @MenuSelect
        # or @ButtonClick commands

        self.logger.debug(msg='Main menu ({}): {}'.format(
            'Client mention' if not old_author_id else 'Home button',
            str(msg.id)))

        embed = utils.UtilityEmbed(
            type=self.default_type, version=self.version,
            color=utils.colors['black'])
        options = []
        for name, command in self.commands.items():
            opt = nextcord.SelectOption(label=name)
            if hasattr(command, 'description'):
                opt.description = command.description
            options.append(opt)
        view = utils.build_view([
            nextcord.ui.Select(
                placeholder='Select a command',
                options=options),
            utils.help_button(),
            utils.delete_button()
        ])

        author_id = None
        if old_author_id is None:
            author_id = msg.author.id
            msg = await msg.channel.send(embed=embed, view=view)
        else:
            await self.database.Messages.delete_message(id=msg.id)
            await msg.edit(embed=embed, view=view)
            author_id = old_author_id
        # persist the message
        await self.database.Messages.add_message(
            id=msg.id, channel_id=msg.channel.id, author_id=author_id)

    async def on_reply(self, msg):
        """
        Call methods with @Reply tag when user
        replies to the bot's message.
        """

        self.logger.debug(msg='Reply: ' + str(msg.id))

        msg = await msg.channel.fetch_message(msg.id)
        if msg is None:
            return
        referenced_msg = await msg.channel.fetch_message(
            msg.reference.message_id)
        if referenced_msg is None:
            return
        cmd = utils.UtilityEmbed(embed=referenced_msg.embeds[0]).get_type()
        await self.call_decorated_methods(
            'Reply', cmd, msg,
            msg.author, referenced_msg)

    async def on_thread_message(self, msg):
        """
        Call methods with @Thread tag when user sends
        a message in bot's thread.
        """

        self.logger.debug(msg='Thread message: ' + str(msg.id))

        parent_msg = await msg.channel.parent.fetch_message(msg.channel.id)
        cmd = utils.UtilityEmbed(embed=parent_msg.embeds[0]).get_type()
        await self.call_decorated_methods(
            'Thread', cmd, msg, msg.author, parent_msg)

    def determine_interaction_type(self, interaction):
        if interaction.user.bot:
            return
        if interaction.data['component_type'] == 2:
            return 'button_click'
        elif interaction.data['component_type'] == 3:
            return 'menu_select'

    async def on_interaction(self, interaction):
        """
        Determine type of interaction and trigger "on_button_click"
        or "on_menu_select" events.
        """
        if not self.ready or not self.check_client_permissions(
                interaction.message):
            return
        try:
            # defer interaction response to avoid
            # "This interaction failed" in nextcord channel
            # when  clicking on a button created before bot restarted
            await interaction.response.defer()
        except nextcord.NotFound:
            pass

        interaction_type = self.determine_interaction_type(interaction)
        if not interaction_type:
            return
        valid_interaction = await self.validate_author(
            interaction, interaction_type)
        if not valid_interaction:
            return

        self.logger.debug(
            msg='Validated interaction of type "{}" on message {}'.format(
                interaction_type, interaction.message.id))

        # process interactions in a queue to avoid
        # multiple or too few instances
        if interaction_type == 'button_click':
            await self.queue.add_to_queue(
                str(interaction.message.id),
                interaction,
                function=self.on_button_click)
        elif interaction_type == 'menu_select':
            await self.queue.add_to_queue(
                str(interaction.message.id),
                interaction,
                function=self.on_menu_select)

    async def on_button_click(self, interaction):
        """
        Call methods with @ButtonClick tag when user
        clicks a button on bot's message.
        Different events are triggered for buttons
        'delete', 'help' and 'home'.
        """

        self.logger.debug(msg='Button click: ' + str(interaction.message.id))

        msg = await interaction.message.channel.fetch_message(
            interaction.message.id)
        if msg is None or len(msg.embeds) != 1:
            return
        cmd = utils.UtilityEmbed(embed=msg.embeds[0]).get_type()
        if not cmd:
            return
        button = utils.get_component(interaction.data['custom_id'], msg)
        if not button:
            return

        # if delete button call on_delete_button_click
        if button.label in ['delete', 'help', 'home', 'back']:
            # delete message if deletable
            if button.label == 'delete':
                self.dispatch('delete_button_click', msg)
                return
            # show help about the current stage of the interface
            if button.label == 'help':
                self.dispatch('help_button_click', msg)
                return
            if button.label == 'back':
                await self.call_decorated_methods(
                    'MenuSelect',
                    utils.UtilityEmbed(embed=msg.embeds[0]).get_type(),
                    msg,
                    interaction.user,
                    interaction.data,
                    interaction.followup)
                return
            # return to main menu
            if button.label == 'home':
                self.dispatch('client_mention', msg, interaction.user.id)
                return

        await self.call_decorated_methods(
            'ButtonClick',
            cmd,
            msg,
            interaction.user,
            button,
            interaction.followup)

    async def on_delete_button_click(self, msg):
        """
        If the message is not pinned, delete it
        """

        self.logger.debug(msg='Delete button: ' + str(msg.id))

        if msg.pinned:
            return
        await msg.edit(content=None,
                       embed=utils.UtilityEmbed(
                           type='Message has been deleted.',
                           version=self.version,
                           color=utils.colors['green']),
                       delete_after=2,
                       view=None)

    async def on_help_button_click(self, msg):
        """
        Edit the message into a help message, based
        on message's type.
        """

        self.logger.debug(msg='Help button: ' + str(msg.id))

        old_embed = utils.UtilityEmbed(embed=msg.embeds[0])
        name = old_embed.get_type()
        if not name:
            return
        embed = nextcord.Embed(title='Help')
        embed.set_footer(text=old_embed.footer.text)
        if name == self.default_type:
            embed.description = ('Select a command in the main menu,\n' +
                                 'then click on the "help" ' +
                                 'button for more info about the command.\n' +
                                 '**\nOnly the user who started ' +
                                 'the menu may navigate it\n**')
        else:
            embed.description = self.commands[name].description
            if name in self.decorated_methods['Help']:
                embed.description += ('\n\n' + '\n'.join([
                    i()
                    for i in self.decorated_methods['Help'][name]
                ]))
            if hasattr(self.commands[name], 'color'):
                embed.color = self.commands[name].color

        if name == self.default_type:
            components = [utils.home_button(), utils.delete_button()]
        else:
            components = [utils.back_button(), utils.delete_button()]
        view = utils.build_view(components)
        embed.color = utils.colors['white']
        await msg.edit(embed=embed, view=view)

    async def on_menu_select(self, interaction):
        """
        Call methods with @MenuSelect tag when user
        selects a dropdown menu item on bot's message.
        """

        self.logger.debug(msg='Menu select: ' + str(interaction.message.id))

        msg = await interaction.message.channel.fetch_message(
            interaction.message.id)
        if msg is None or len(msg.embeds) != 1:
            return

        cmd = utils.UtilityEmbed(embed=msg.embeds[0]).get_type()
        if (interaction.data and interaction.data.get('values') and
                len(interaction.data['values']) > 0 and (
                cmd == self.default_type or
                interaction.data['values'][0] in self.games)):
            await self.call_decorated_methods(
                'MenuSelect',
                interaction.data['values'][0],
                msg,
                interaction.user,
                interaction.data,
                interaction.followup)
        else:
            await self.call_decorated_methods(
                'MenuSelect',
                cmd,
                msg,
                interaction.user,
                interaction.data,
                interaction.followup)

    async def on_raw_message_delete(self, msg):
        # clean up message's info from database when deleted

        self.logger.debug(msg='Deleting message: ' + str(msg.message_id))

        await self.database.Messages.delete_message(id=msg.message_id)

    async def on_raw_bulk_message_delete(self, payload):
        # clean up bulk deleted message's info from
        # database when deleted

        self.logger.debug(msg='Bulk deleting {} messages'.format(
            len(payload.message_ids)))

        for i in payload.message_ids:
            await self.database.Messages.delete_message(id=str(i))

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
        result = [
            '{}({})\n{}'.format(str(ex_type.__name__), str(ex), 56 * '-')
        ]
        if str(ex) == 'MySQL Connection not available.':
            await self.database.connect_database()
            return
        for i in x:
            if root_dir in i and 'super()._run_event' not in i:
                result.append(i)
        self.logger.error('\n'.join(result) + '\n')

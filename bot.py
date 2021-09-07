import discord
from utils.misc import Queue, colors
from threading import Timer
from utils.wrappers import EmbedWrapper
from database import DB
import commands as cmds


class Bot:
    """
    Connection between discord.Client's events and
    user defined commands.
    """

    def __init__(self, default_prefix):
        self.client = None
        self.database = None
        self.default_prefix = default_prefix
        # discord.Client will not trigger events until
        # it has a ready Bot object
        self.ready = False
        self.queue = Queue(self)
        self.timers = {}
        # dictionary containing all command objects as
        # values and their names as keys
        self.commands = {}
        self.commands_synonyms = {}
        # lists containing commands with special functions
        # that need to be processes separately
        self.on_reply_commands = []
        self.on_dm_reply_commands = []
        self.on_time_commands = []
        self.on_thread_message_commands = []
        self.on_button_click_commands = []
        self.on_menu_select_commands = []

    async def initialize(self, client):
        """
        Link a discord.Client to a Bot object,
        connect MySQL database if info provided and
        initialize all the commands.
        """
        self.client = client
        if self.database is None:
            self.database = DB(self.default_prefix)
        await self.database.connect_database()
        if not self.ready:
            for C in list([cls for cls in cmds.__dict__.values()
                           if isinstance(cls, type)]):
                c = C()
                c.bot = self
                self.add_command(c)
            self.ready = True

    def add_command(self, command):
        """
        Add a command object to Bot object's commands
        dictionary, when initializing a command object.
        """
        self.commands[command.name] = command
        if hasattr(command, 'on_reply'):
            self.on_reply_commands.append(command)
        if hasattr(command, 'on_thread_message'):
            self.on_thread_message_commands.append(command)
        if hasattr(command, 'on_button_click'):
            self.on_button_click_commands.append(command)
        if hasattr(command, 'on_menu_select'):
            self.on_menu_select_commands.append(command)
        if hasattr(command, 'on_dm_reply'):
            self.on_dm_reply_commands.append(command)
        if hasattr(command, 'on_time'):
            self.on_time_commands.append(command)
        for i in command.synonyms:
            self.commands_synonyms[i] = command

    async def handle_message(self, msg, cmd, prefix):
        """
        Handle a message sent by a user in a discord server.
        """
        args = msg.content.split()
        if cmd in self.commands:
            cmd = self.commands[cmd]
        elif cmd in self.commands_synonyms:
            cmd = self.commands_synonyms[cmd]
        else:
            return
        # if 2nd word is help send additional info
        # about the command
        if len(args) > 1 and args[1] == 'help':
            await msg.channel.send(
                embed=await self.create_additional_help(
                    cmd.command_info(prefix), msg, prefix),
                components=discord.ui.Button(label='delete'))
        else:
            # else execute the command
            # check if valid channel, permissions,...
            if await self.check_if_valid(cmd, msg) is True:
                await cmd.execute_command(msg)

    async def check_if_valid(self, command, msg) -> bool:
        """
        Check if a command is allowed for the user and for the bot.
        """
        if command.requires_database and not self.database.connected:
            await msg.channel.warn(
                    text='This command requires database connection!')
            return False
        # check for required permissions
        # and roles
        return await self.check_permissions(command, msg)

    async def check_permissions(self, command, msg) -> bool:
        """
        Check if bot and user have all the required permissions to use the
        command in message's channel.
        """
        # check bot's permissions
        p = msg.channel.permissions(
            msg.guild.me, command.bot_permissions)
        if not p[0]:
            await msg.channel.warn(
                text=('I need `{}` permission to use this command.'
                      ).format(p[1]))
            return False
        if msg.channel.permissions(msg.author, 'administrator')[0]:
            return True
        # if command has required roles set up, override default
        # required permissions
        required_roles = await self.database.get_required_roles(
            msg, command.name)
        user_roles = [i.name for i in msg.author.roles]
        if required_roles is not None:
            for i in required_roles:
                if i in user_roles:
                    return True
            await msg.channel.warn(
                text=(
                    'This command can be used by the following roles:\n{}'
                ).format(', '.join(required_roles)))
            return False
        # check if user has all the required permissions
        p = msg.channel.permissions(
            msg.author, command.user_permissions)
        if not p[0]:
            await msg.channel.warn(
                text=(
                    'You need `{}` permission to use this command.'
                ).format(p[1]))
            return False
        return True

    async def create_additional_help(self, info, msg, prefix) -> EmbedWrapper:
        """Return command's information in an embed."""
        idx = list(self.commands.keys()).index(info[0])
        embed_var = EmbedWrapper(discord.Embed(
            title='{}{}'.format(prefix, info[0]),
            description=info[1],
            color=colors[idx % 9]),
            embed_type='HELP',
            marks=EmbedWrapper.INFO)
        synonyms = 'None'
        if len(info[5]) > 0:
            synonyms = ', '.join([prefix + i for i in info[5]])
        embed_var.add_field(
            name='synonyms',
            value=synonyms,
            inline=False)
        embed_var.add_field(
            name='Additional info',
            value=info[2],
            inline=False)
        embed_var.add_field(
            name='Required permissions for bot',
            value='[{}]'.format(', '.join(info[3])),
            inline=False)
        roles = await self.database.get_required_roles(msg, info[0])
        if roles is None:
            embed_var.add_field(
                name='Required permissions for user',
                value='[{}]'.format(', '.join(info[4])),
                inline=False)
        else:
            embed_var.add_field(
                name='Roles that can use the command',
                value='[{}]'.format(', '.join(roles)),
                inline=False)
        return embed_var

    def clean_up(self):
        """Cancel multithreading functions."""
        for k, v in self.timers.items():
            if isinstance(v, Timer) and v.is_alive():
                v.cancel()
        self.timers.clear()
        self.client = None

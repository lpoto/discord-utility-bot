import discord
from utils.misc import Queue, waste_basket, colors
from utils.wrappers import ChannelWrapper, EmbedWrapper
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
        # dictionary containing all command objects as
        # values and their names as keys
        self.commands = {}
        # lists containing commands with special functions
        # that need to be processes separately
        self.on_reply_commands = []
        self.on_raw_reaction_commands = []
        self.on_dm_reaction_commands = []
        self.on_time_commands = []

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
            # if event command is ready, start timing for the scheduled
            # events
            if 'event' in self.commands:
                await self.database.use_database(
                        self.commands['event'].events_from_database)
                await self.commands['event'].start_timer()
            self.ready = True

    def add_command(self, command):
        """
        Add a command object to Bot object's commands
        dictionary, when initializing a command object.
        """
        self.commands[command.name] = command
        # if commands have on raw reaction or on message
        # methods, add them to list
        if hasattr(command, 'on_reply'):
            self.on_reply_commands.append(command)
        if hasattr(command, 'on_raw_reaction'):
            self.on_raw_reaction_commands.append(command)
        if hasattr(command, 'on_dm_reaction'):
            self.on_dm_reaction_commands.append(command)
        if hasattr(command, 'on_time'):
            self.on_time_commands.append(command)

    async def handle_message(self, msg, cmd, prefix):
        """
        Handle a message sent by a user in a discord server.
        """
        args = msg.content.split()
        cmd = self.commands[cmd]
        # if 2nd word is help send additional info
        # about the command
        if len(args) > 1 and args[1] == 'help':
            await msg.channel.send(
                embed=await self.create_additional_help(
                    cmd.command_info(prefix), msg, prefix),
                reactions=waste_basket)
        else:
            # else execute the command
            # check if valid channel, permissions,...
            if await self.check_if_valid(cmd, msg) is True:
                await cmd.execute_command(msg)

    async def handle_raw_reactions(self, payload, reaction_type, dm):
        """
        Handle a payload recieved from a raw reaction event in
        a discord server.
        """
        if dm:
            # iterate through those commands that have
            # on dm reaction function
            for i in self.on_dm_reaction_commands:
                await i.on_dm_reaction(payload)
            return
        guild = discord.utils.get(
            self.client.guilds,
            id=payload.guild_id)
        if guild is None:
            return
        channel = ChannelWrapper(discord.utils.get(
            guild.channels,
            id=payload.channel_id))
        if channel is None:
            return
        msg = await channel.fetch_message(payload.message_id)
        # onnly listen for reactions on bot's messages
        if msg.author.id != self.client.user.id:
            return
        # if wastebin reaction and bot is msg author
        # and message is not pinned and message has an
        # embed or starts with help, delete it
        if payload.emoji.name == waste_basket:
            if reaction_type == 'REACTION_ADD':
                await self.waste_basket_delete(msg)
            return
        # iterate through those commands that have
        # on raw reaction functinon
        for i in self.on_raw_reaction_commands:
            await i.on_raw_reaction(msg, payload)

    async def waste_basket_delete(self, msg):
        """Delete a message with a waste basket emoji."""
        if msg.is_deletable:
            await msg.edit(
                text='Message has been deleted.',
                delete_after=3)

    async def check_if_valid(self, command, msg) -> bool:
        """
        Check if a command is allowd in message's channel type.
        """
        if str(msg.channel.type) not in command.channel_types:
            await msg.channel.send(
                text='This command cannot be used in this channel type!',
                delete_after=5)
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
            await msg.channel.send(
                text=('I need `{}` permission to use this command.'
                      ).format(p[1]),
                delete_after=5)
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
            await msg.channel.send(
                text=(
                    'This command can be used by the following roles:\n{}'
                ).format(', '.join(required_roles)),
                delete_after=5)
            return False
        # check if user has all the required permissions
        p = msg.channel.permissions(
            msg.author, command.user_permissions)
        if not p[0]:
            await msg.channel.send(
                text=(
                    'You need `{}` permission to use this command.'
                ).format(p[1]),
                delete_after=5)
            return False
        return True

    async def create_additional_help(self, info, msg, prefix) -> EmbedWrapper:
        """Return command's information in an embed."""
        idx = list(self.commands.keys()).index(info[0])
        embed_var = EmbedWrapper(discord.Embed(
            title='{}{}'.format(prefix, info[0]),
            description=info[1],
            color=colors[idx]),
            embed_type='HELP',
            marks=EmbedWrapper.INFO)
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
            embed_var.add_field(
                name='Allowed channel types',
                value='[{}]'.format(', '.join(info[5])),
                inline=False)
        return embed_var

    def clean_up(self):
        """Cancel multithreading functions."""
        for cmd in self.commands.values():
            cmd.clean_up()
        self.client = None

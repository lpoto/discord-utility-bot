import discord
from collections import defaultdict
from functools import partial
from datetime import datetime
from utils.misc import Queue, colors, delete_button
from utils.wrappers import EmbedWrapper, MemberWrapper
import utils.decorators as decorators
from database import DB
import commands as cmds
import games as gms


class Bot:
    """
    Connection between discord.Client's events and
    user defined commands.
    """

    def __init__(self, default_prefix):
        self.client = None
        self.database = None
        self.default_prefix = default_prefix
        self.default_deletion_times = {
            'poll': 160,
            'rock_paper_scissors': 24,
            'connect_four': 24,
            'hangman': 24
        }
        # discord.Client will not trigger events until
        # it has a ready Bot object
        self.ready = False
        self.queue = Queue(self)
        # dictionary containing all command objects as
        # values and their names as keys
        self.commands = {}
        self.commands_synonyms = {}
        self.games = {}
        self.special_methods = defaultdict(lambda: defaultdict(list))
        # lists containing commands with special functions
        # that need to be processes separately

    async def initialize(self, client):
        """
        Link a discord.Client to a Bot object,
        connect MySQL database if info provided and
        initialize all the commands.
        """
        self.client = client
        if self.database is None:
            self.database = DB(
                self.default_prefix,
                self.default_deletion_times)
            await self.database.connect_database()
        if not self.ready:
            for C in list([cls for cls in cmds.__dict__.values()
                           if isinstance(cls, type)]):
                c = C()
                c.bot = self
                self.add_command(c)
            for C in list([cls for cls in gms.__dict__.values()
                           if isinstance(cls, type)]):
                c = C()
                c.bot = self
                self.add_command(c, True)
        await self.database.use_database(self.restart_deleting_timers)
        self.ready = True

    def add_command(self, command, game=False):
        """
        Add a command object to Bot object's commands
        dictionary, when initializing a command object.
        Add command's methods with decorators to
        special_methods dictionary.
        """
        if not game:
            self.commands[command.name] = command
        else:
            self.games[command.name] = command
        for i in command.synonyms:
            self.commands_synonyms[i] = command
        for Dec in list([dec for dec in decorators.__dict__.values()
                         if isinstance(dec, type)]):
            if not hasattr(Dec, 'methods'):
                continue
            for v in Dec.methods(command).values():
                if command.name != 'help' and v._method.__name__.startswith(
                        '__'):
                    continue
                self.special_methods[Dec.__name__][command.name].append(
                    partial(v, command))

    def clean_up(self):
        """
        Clean up commands threading timers etc.
        """
        self.client = None
        for method in sum(self.special_methods['CleanUp'].values(), []):
            method()

    async def check_if_valid(self, command, msg, user, wh=None) -> bool:
        """
        Check if user and bot are allowed to use the command.
        """
        if command.requires_database and not self.database.connected:
            await msg.channel.warn(
                content='This command requires database connection!',
                webhook=wh)
            return False
        return await self.check_permissions(command, msg, user, wh)

    async def check_permissions(self, command, msg, user, wh=None) -> bool:
        """
        Check if bot and user have all the required permissions
        or roles to use the command in message's channel.
        """
        # check bot's permissions
        if (command.bot_permissions is not None and
                len(command.bot_permissions) > 0):
            p = msg.channel.permissions(
                msg.guild.me, command.bot_permissions)
            if not p[0]:
                await msg.channel.warn(
                    content=('I need `{}` permission to use this command.'
                             ).format(p[1]),
                    webhook=wh)
                return False
        if msg.channel.permissions(user, 'administrator')[0]:
            return True
        # if command has required roles set up, override default
        # required permissions and only check if user has any of the
        # set up roles
        required_roles = await self.database.get_required_roles(
            msg, command.name)
        user_roles = [i.name for i in user.roles]
        if required_roles is not None and len(required_roles) > 0:
            if any(i in required_roles for i in user_roles):
                return True
            await msg.channel.warn(
                content=(
                    'This command can be used by the following roles:\n`{}`'
                ).format(
                    ', '.join(required_roles)),
                webhook=wh)
            return False
        # check if user has all the required permissions
        if command.user_permissions is None or len(
                command.user_permissions) == 0:
            return True
        p = msg.channel.permissions(
            user, command.user_permissions)
        if not p[0]:
            await msg.channel.warn(
                content=(
                    'You need `{}` permission to use this command.'
                ).format(p[1]),
                webhook=wh)
            return False
        return True

    async def create_additional_help(self, info, msg, prefix) -> EmbedWrapper:
        """
        Return command's information in an embed.
        (description, synonyms, additional_info, bot/user permissions, roles)
        """
        idx = (list(self.commands.keys()) + list(self.games.keys())
               ).index(info[0])
        title = info[0]
        if ((info[0] in self.commands and
                self.commands[info[0]].executable) or
                (info[0] in self.games and self.games[info[0]].executable)):
            title = prefix + title
        embed_var = EmbedWrapper(discord.Embed(
            title=title,
            description=info[1],
            color=colors[idx % 9]),
            embed_type='HELP',
            marks=EmbedWrapper.INFO)
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
            value=None if info[3] is None else '[{}]'.format(
                ', '.join(info[3])),
            inline=False)
        roles = await self.database.get_required_roles(msg, info[0])
        if roles is None or len(roles) == 0:
            embed_var.add_field(
                name='Required permissions for user',
                value=None if info[4] is None else '[{}]'.format(
                    ', '.join(info[4])),
                inline=False)
        else:
            embed_var.add_field(
                name='Roles that can use the command',
                value='[{}]'.format(', '.join(roles)),
                inline=False)
        return embed_var

    # ---------------------------------------------------- handle client events

    async def handle_message(self, msg, cmd, prefix):
        """
        Handle a message, that fits command format,
        sent by a user in a discord server.
        """
        args = msg.content.split()
        if cmd in self.commands:
            cmd = self.commands[cmd]
        elif cmd in self.games:
            cmd = self.games[cmd]
        elif cmd in self.commands_synonyms:
            cmd = self.commands_synonyms[cmd]
        else:
            return
        # if 2nd word is help send additional info
        # about the command
        if len(args) > 1 and args[1] in ['h', 'help']:
            await msg.channel.send(
                embed=await self.create_additional_help(
                    cmd.command_info(prefix), msg, prefix),
                components=delete_button())
            return
        # each command has "execute_command" function
        # that should be triggered when a message matches the command
        for method in self.special_methods['ExecuteCommand'][cmd.name]:
            if await self.check_if_valid(cmd, msg, msg.author) is True:
                await method(msg)

    async def handle_reply(self, channel, msg, ref_msg_id):
        referenced_msg = await channel.fetch_message(int(ref_msg_id))
        if msg is None or referenced_msg is None:
            return
        for method in sum(self.special_methods['OnReply'].values(), []):
            await method(msg, referenced_msg)

    async def handle_button_click(
            self, channel, msg_id, interaction, button, msg=None):
        # function handling button_clicks in a queue
        msg = msg if msg is not None else (
            await channel.fetch_message(int(msg_id)))
        webhook = interaction.followup
        x = self.special_methods['ExecuteWithInteraction']
        if button.label in x:
            await x[button.label][0](
                msg, MemberWrapper(interaction.user), webhook)
            return
        if msg.is_ended:
            return
        if msg is None:
            return
        # call those commands that have on button click functions
        # await v(button, msg, MemberWrapper(interaction.user, webhook))
        for method in sum(self.special_methods['OnButtonClick'].values(), []):
            await method(
                button,
                msg,
                MemberWrapper(interaction.user),
                webhook)

    async def handle_menu_select(self, channel, msg_id, interaction, msg=None):
        # function for menu selection handled in a queue
        msg = msg if msg is not None else (
            await channel.fetch_message(int(msg_id)))
        if not msg:
            return
        webhook = interaction.followup
        x = self.special_methods['ExecuteWithInteraction']
        if interaction.data['values'][0] in x:
            await x[interaction.data['values'][0]][0](
                msg, MemberWrapper(interaction.user), webhook)
            await msg.edit(content='')
            return
        if msg.is_ended:
            return
        # call those commands that have on menu select functions
        for method in sum(self.special_methods['OnMenuSelect'].values(), []):
            await method(
                interaction,
                msg,
                MemberWrapper(interaction.user),
                webhook)

    async def handle_deleted_messages(self, msg_id, channel_id):
        """
        Clear deleted message's info from databases.
        Archive any threads the bot started on the message.
        """
        if not self.database.connected:
            return
        # clear the deleted message from the databases
        await self.database.use_database(
            self.delete_message_from_database, msg_id, channel_id)
        channel = self.client.get_channel(channel_id)
        if (channel is None or channel.threads is None or
                len(channel.threads) == 0):
            return
        # if message has any threads owned by the bot, archive them
        threads = [t for t in channel.threads if (
            not t.archived and
            t.owner_id == self.client.user.id and
            t.id == msg_id)]
        for i in threads:
            await i.edit(archived=True)

    async def delete_message_from_database(self, cursor, msg_id, channel_id):
        # delete message info from all the tables that have entries
        # containing info about exactly one message
        cursor.execute(
            ("DELETE FROM messages " +
                "WHERE channel_id = '{}' AND message_id = '{}'").format(
                    channel_id, msg_id))

    async def restart_deleting_timers(self, cursor):
        # on initializing the bot, reschedule the deletion of the
        # messages
        cursor.execute(
            'SELECT * FROM messages WHERE deletion_time IS NOT NULL')
        fetched = cursor.fetchall()
        for i in fetched:
            hours = None
            now = datetime.strptime(datetime.now(
            ).strftime("%d:%m:%H"), "%d:%m:%H")
            then = datetime.strptime(i[5], "%d:%m:%H")
            tdelta = then - now
            if tdelta.days < 0 or tdelta.seconds < 0:
                hours = 0
            else:
                hours = tdelta.days * 24 + tdelta.seconds / (3600)
            channel = self.client.get_channel(int(i[1]))
            if channel is None or hours is None:
                continue
            msg = await channel.fetch_message(int(i[2]))
            if msg is None:
                continue
            await msg.delete(delay=hours * 3600)

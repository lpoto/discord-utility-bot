import discord
from datetime import datetime, timedelta
from utils.misc import Queue, colors, delete_button
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
        await self.database.use_database(self.restart_deleting_timers)

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
        Handle a message, that fits command format,
        sent by a user in a discord server.
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
                components=delete_button())
        else:
            # each command has "execute_command" function
            # that should be triggered when a message matches the command
            if await self.check_if_valid(cmd, msg) is True:
                await cmd.execute_command(msg)

    async def check_if_valid(self, command, msg) -> bool:
        """
        Check if user and bot are allowed to use the command.
        """
        if command.requires_database and not self.database.connected:
            await msg.channel.warn(
                text='This command requires database connection!')
            return False
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
        # required permissions and only check if user has any of the
        # set up roles
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
        """
        Return command's information in an embed.
        (description, synonyms, additional_info, bot/user permissions, roles)
        """
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

    async def timed_delete(self, msg, hours=24, reschedule=False):
        """
        Delete messages after time. Save the scheduled message
        to the database, so it is deleted even if the bot
        restarts.
        """
        if msg.pinned:
            return
        await msg.delete(delay=hours * 60 * 60)
        if not reschedule:
            await self.database.use_database(
                self.message_to_deleting_database, msg, hours)

    async def handle_deleted_messages(self, msg_id, channel_id):
        """
        Clear deleted message's info from databases.
        Archive any threads the bot started on the message.
        """
        # clear the deleted message from the databases
        await self.database.use_database(
            self.delete_message_from_databases, msg_id, channel_id)
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

    async def delete_message_from_databases(self, cursor, msg_id, channel_id):
        # delete message info from all the tables that have entries
        # containing info about exactly one message
        for i in self.database.deletable_messages_databases:
            cursor.execute(
                ("DELETE FROM {} " +
                 "WHERE channel_id = '{}' AND message_id = '{}'").format(
                    i, channel_id, msg_id))

    async def message_to_deleting_database(self, cursor, msg, time):
        # save message to database when scheduled for deletion
        # so it is deleted even if bot is restarted during the timing
        cur_time = (datetime.now() + timedelta(hours=time)
                    ).strftime('%d:%m:%H')
        cursor.execute(
            ("INSERT INTO deleting_messages (channel_id, message_id, time)" +
                "VALUES ('{}', '{}', '{}')").format(
                msg.channel.id, msg.id, cur_time))

    async def restart_deleting_timers(self, cursor):
        # on initializing the bot, reschedule the deletion of the
        # messages in the deleting_messages table
        cursor.execute('SELECT * FROM deleting_messages')
        fetched = cursor.fetchall()
        for i in fetched:
            time = await self.get_from_entry(i, 'time')
            channel = await self.get_from_entry(i, 'channel')
            if channel is None or time is None:
                continue
            msg = await self.get_from_entry(i, 'message', channel)
            if msg is None:
                continue
            await self.timed_delete(msg, time, reschedule=True)

    async def get_from_entry(self, entry, e_type, channel=None):
        for i in entry:
            if e_type == 'time' and len(i) == 8:
                now = datetime.strptime(datetime.now(
                ).strftime("%d:%m:%H"), "%d:%m:%H")
                then = datetime.strptime(i, "%d:%m:%H")
                tdelta = then - now
                if tdelta.days < 0 or tdelta.seconds < 0:
                    return 0
                hours = tdelta.days * 24 + tdelta.seconds / (3600)
                return hours
            elif e_type == 'channel' and len(i) == 18:
                channel = self.client.get_channel(int(i))
                if channel is None:
                    continue
                return channel
            elif e_type == 'message' and channel and len(i) == 18:
                msg = None
                try:
                    msg = await channel.fetch_message(int(i))
                except Exception:
                    continue
                if msg is None:
                    continue
                return msg

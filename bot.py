import discord
from utils import *


class Bot:
    def __init__(self, client):
        self.msg_queue = []
        self.raw_queue = []
        # dictionary containing all command objects as
        # values and their names as keys
        self.commands = {}
        # lists containing objects with special methods
        # that need to be processed seperately
        self.on_raw_reactions = []
        self.on_message = []
        self.on_dm_reactions = []

    def add_command(self, command):
        # add a command object to commands dictionary
        # this is called when initializing a
        # Command object
        self.commands[command.name] = command
        # if commands have on raw reaction or on message
        # methods, add them to list
        if hasattr(command, 'on_raw_reaction'):
            self.on_raw_reactions.append(command)
        if hasattr(command, 'on_message'):
            self.on_message.append(command)
        if hasattr(command, 'on_dm_reaction'):
            self.on_dm_reactions.append(command)

    async def push_msg_queue(self, msg, first_word):
        try:
            # push msgs that match command format to
            # the queue to be proccesed one by one
            self.msg_queue.append((msg, first_word))
            await clear_queue(
                queue_type="messages",
                ignore_running=False,
                queue=self.msg_queue,
                function=self.msg_queue_function)
        except Exception as err:
            await send_error(msg, err, 'bot.py -> push_msg_queue()')

    async def msg_queue_function(self, queue):
        # function used when recursively clearing msg queue
        # to avoid multiplce instances of the same command
        try:
            el = queue.pop(0)
            msg = el[0]
            args = msg.content.split()
            first_word = el[1]
            cmd = self.commands[first_word]
            # if 2nd word is help send additional info
            # about the command
            if len(args) > 1 and args[1] == 'help':
                if dict(iter(
                    msg.guild.me.permissions_in(
                        msg.channel)))['send_messages']:
                    prefix = await get_prefix(msg)
                    new_msg = await msg.channel.send(
                        await self.create_additional_help(
                            cmd.command_info(
                                prefix), msg, prefix)
                    )
                    await message_react(
                        new_msg, waste_basket)
            else:
                # else execute the command
                # check if valid channel, permissions,...
                if await self.check_if_valid(cmd, msg):
                    await cmd.execute_command(msg)
        except Exception as error:
            await send_error(msg, error, 'bot.py -> msg_queue_function()')

    async def create_additional_help(self, info, msg, prefix):
        try:
            txt = ('```Help: {}{}``````\n{}\n\n{}``````' +
                   '\nRequired permissions:\n* Bot: [{}]').format(
                prefix, info[0], info[1], info[2], ', '.join(info[3]))
            roles = await get_required_roles(msg, info[0])
            if roles is None:
                txt += "\n* User: [{}]\n\nAllowed channels: [{}]```".format(
                    ', '.join(info[4]), ', '.join(info[5]))
            else:
                txt += ('\n\nRoles that can use the command: [{}]\n\n' +
                        'Allowed channels: [{}]```').format(
                    ', '.join(roles), ', '.join(info[5]))
            return txt
        except Exception as err:
            await send_error(msg, err, 'bot.py -> create_additional_help()')

    async def check_if_valid(self, command, msg):
        try:
            # check if command can be used in this type of channel
            if str(msg.channel.type) not in command.channel_types:
                if bot_perms['send_messages']:
                    txt = 'This command cannot be used in this channel type!'
                    await message_delete(msg, 5, txt)
                return False

            # check for required permissions
            # and roles
            return await self.check_permissions(command, msg)
        except Exception as err:
            await send_error(msg, err, 'bot.py -> check_if_valid()')

    async def check_permissions(self, command, msg):
        try:
            user_perms = dict(iter(
                msg.author.permissions_in(msg.channel)))
            bot_perms = dict(iter(
                msg.guild.me.permissions_in(msg.channel)))
            # check if bot has all the required permissions in the channel
            for perm in command.bot_permissions:
                if not bot_perms[perm]:
                    if bot_perms['send_messages']:
                        txt = ('I need `{}` permission to use this command.'
                               .format(perm))
                        await message_delete(msg, 5, txt)
                    return False
            if user_perms['administrator']:
                return True
            # if command has required roles set up, override default
            # required permissions
            required_roles = await get_required_roles(msg, command.name)
            user_roles = [i.name for i in msg.author.roles]
            if required_roles is not None:
                for i in required_roles:
                    if i in user_roles:
                        return True
                txt = ('This command can be used by the following roles:\n{}'
                       .format(', '.join(required_roles)))
                return False

            # check if user has all the required permissions
            for perm in command.user_permissions:
                if not user_perms[perm]:
                    if bot_perms['send_messages']:
                        txt = ('You need `{} permission to use this command!`'
                               .format(perm))
                        await message_delete(msg, 5, txt)
                    return False
            return True
        except Exception as err:
            await send_error(msg, err, 'bot.py -> check_permissions()')
            return False

    async def push_raw_queue(self, payload, reaction_type):
        # push raw reactions that match emojis in utils.py into queue
        if (payload.emoji.name in emojis or
                payload.emoji.name in rps_emojis or
                payload.emoji.name == waste_basket):
            # check if dm
            if payload.guild_id is None:
                self.raw_queue.append((payload, reaction_type, True))
            else:
                self.raw_queue.append((payload, reaction_type, False))
        # recursively clear raw reactions queue to avoid too many or too
        # few reactions
        await clear_queue(
            queue_type='raw_reactions',
            ignore_running=False,
            queue=self.raw_queue,
            function=self.raw_reactions_queue_function)

    async def raw_reactions_queue_function(self, queue):
        # function used when recursively clearing raw reactions queue
        try:
            # get reaction message and channel
            # from payload gotten from raw event
            el = queue.pop(0)
            payload = el[0]
            reaction_type = el[1]
            dm = el[2]
            # if reaction is from DM, run the on dm functions
            if dm:
                for i in self.on_dm_reactions:
                    await i.on_dm_reaction(payload)
                return
            guild = discord.utils.get(
                client.guilds,
                id=payload.guild_id)
            if guild is None:
                return
            channel = discord.utils.get(
                guild.channels,
                id=payload.channel_id)
            if channel is None:
                return
            msg = await channel.fetch_message(payload.message_id)
            # onnly listen for reactions on bot's messages
            if msg.author.id == client.user.id:
                # if wastebin reaction and bot is msg author
                # and message is not pinned and message has an
                # embed or starts with help, delete it
                if (reaction_type == 'add' and
                    payload.emoji.name == waste_basket and
                        not msg.pinned and
                    (len(msg.embeds) > 0 or
                     msg.content.startswith('```Help: ')) and
                        msg.author.id == msg.guild.me.id):
                    edit_txt = 'Message has been deleted.'
                    await message_edit(msg, edit_txt)
                    await message_delete(msg, 3)
                elif payload.emoji.name != waste_basket:
                    for i in self.on_raw_reactions:
                        await i.on_raw_reaction(msg, payload)
        except Exception as error:
            await send_error(
                msg, error, 'bot.py -> raw_reactions_queue_function()')


bot = Bot(client)

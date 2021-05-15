import discord
from utils import *


class Managing_bot:
    def __init__(self, client):
        self.msg_queue = []
        self.raw_queue = []
        self.clearing_messages = False
        self.clearing_raw_reactions = False
        # dictionary containing all command objects as
        # values and their names as keys
        self.commands = {}
        # lists containing objects with special methods
        # that need to be processed seperately
        self.on_raw_reactions = []
        self.on_message = []

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

    async def push_msg_queue(self, msg, first_word):
        # push msgs that match command format to
        # the queue to be proccesed one by one
        self.msg_queue.append((msg, first_word))
        await self.clear_msg_queue(False)

    async def clear_msg_queue(self, ignore_running):
        # recursively clear the message que to avoid
        # multiple instances of commands
        try:
            if ((not self.clearing_messages or ignore_running) and
                    len(self.msg_queue) > 0):
                try:
                    self.clearing_messages = True
                    el = self.msg_queue.pop(0)
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
                            new_msg = await msg.channel.send(
                                await self.create_additional_help(
                                    cmd.command_info(), msg)
                            )
                            await message_react(
                                new_msg, list(emojis.keys())[-1])
                    else:
                        # else execute the command
                        # check if valid channel, permissions,...
                        if await self.check_if_valid(cmd, msg):
                            await cmd.execute_command(msg)
                    await self.clear_msg_queue(True)
                except Exception as error:
                    await send_error(msg, error, 'bot.py -> clear_msg_queue()')
                    await self.clear_msg_queue(True)
            else:
                self.clearing_messages = False
        except Exception as err:
            await send_error(msg, error, 'bot.py -> clear_msg_queue()')

    async def create_additional_help(self, info, msg):
        try:
            txt = ('```Help: {}``````\n{}\n\n{}``````' +
                   '\nRequired permissions:\n* Bot: [{}]').format(
                info[0], info[1], info[2], ', '.join(info[3]))
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

    async def push_raw_queue(self, payload, reaction_type):
        # push raw reaction info to queue only if
        # its emoji is in utils.emojis dictionary
        if payload.emoji.name in emojis:
            self.raw_queue.append((payload, reaction_type))
        await self.clear_raw_queue(False)

    async def clear_raw_queue(self, ignore_running):
        # recursively clear raw reaction events one by one
        if ((not self.clearing_raw_reactions or ignore_running) and
                len(self.raw_queue) > 0):
            try:
                # get reaction message and channel
                # from payload gotten from raw event
                self.clearing_raw_reactions = True
                el = self.raw_queue.pop(0)
                payload = el[0]
                reaction_type = el[1]
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
                        payload.emoji.name == list(emojis.keys())[-1] and
                            not msg.pinned and
                        (len(msg.embeds) > 0 or
                         msg.content.startswith('```Help: ')) and
                            msg.author.id == msg.guild.me.id):
                        edit_txt = 'Message has been deleted.'
                        await message_edit(msg, edit_txt)
                        await message_delete(msg, 3)
                    elif payload.emoji.name != list(emojis.keys())[-1]:
                        for i in self.on_raw_reactions:
                            await i.on_raw_reaction(msg, payload)
                await self.clear_raw_queue(True)
            except Exception as error:
                await send_error(msg, error, 'bot.py -> clear_raw_queue()')
        else:
            self.clearing_raw_reactions = False


managing_bot = Managing_bot(client)

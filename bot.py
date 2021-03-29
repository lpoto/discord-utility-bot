import discord
from utils import *


class Managing_bot:
    # dictionary containing all command objects as
    # values and their names as keys
    commands = {}

    def __init__(self, client):
        self.client = client
        self.default_prefix = DEFAULT_PREFIX
        self.msg_queue = []
        self.raw_queue = []
        self.clearing_messages = False
        self.clearing_raw_reactions = False

    @classmethod
    def add_command(cls, command):
        # add a command object to commands dictionary
        # this is called when initializing a
        # Command object
        cls.commands[command.name] = command

    @classmethod
    def return_commands(cls):
        return cls.commands

    async def push_msg_queue(self, msg, first_word):
        self.msg_queue.append((msg, first_word))
        await self.clear_msg_queue(False)

    async def clear_msg_queue(self, ignore_running):
        # recursively clear the message que to avoid
        # multiple instances of commands
        if ((not self.clearing_messages or ignore_running) and
                len(self.msg_queue) > 0):
            try:
                self.clearing_messages = True
                el = self.msg_queue.pop(0)
                msg = el[0]
                args = msg.content.split()
                first_word = el[1]
                # check if valid channel, permissions,...
                cmd = Managing_bot.commands[first_word]
                if await self.check_if_valid(cmd, msg):
                    # if 2nd word is help send additional info
                    if len(args) > 1 and args[1] == 'help':
                        new_msg = await msg.channel.send(
                            "```Help: {}``````\n{}\n\n{}```".format(
                                cmd.name,
                                cmd.description,
                                cmd.additional_info()))
                        await message_react(new_msg, emojis['waste_basket'])
                    else:
                        # else execute the command
                        await cmd.execute_command(msg)
                await self.clear_msg_queue(True)
            except Exception as error:
                await send_error(msg, error, 'bot.py -> clear_msg_queue()')
        else:
            self.clearing_messages = False

    async def push_raw_queue(self, payload, type):
        # push raw reaction info to queue
        self.raw_queue.append((payload, type))
        await self.clear_raw_queue(False)

    async def clear_raw_queue(self, ignore_running):
        # recursively clear raw reaction events one by one
        if ((not self.clearing_raw_reactions or ignore_running) and
                len(self.raw_queue) > 0):
            try:
                self.clearing_raw_reactions = True
                el = self.raw_queue.pop(0)
                payload = el[0]
                reaction_type = el[1]
                guild = None
                if payload.emoji.name not in emojis.values():
                    return await self.clear_raw_queue(True)
                for i in self.client.guilds:
                    if i.id == payload.guild_id:
                        guild = i
                channel = None
                for i in guild.channels:
                    if i.id == payload.channel_id:
                        channel = i
                msg = await channel.fetch_message(payload.message_id)
                # if wastebin reaction and bot is msg author
                # and message is not pinned, delete it
                if (reaction_type == 'add' and
                    payload.emoji.name == emojis['waste_basket'] and
                        not msg.pinned and
                    (len(msg.embeds) > 0 or
                     msg.content.startswith('```Help: ')) and
                        msg.author.id == msg.guild.me.id):
                    edit_txt = 'Message has been deleted.'
                    await message_edit(msg, edit_txt)
                    await message_delete(msg, 3)
                elif payload.emoji.name != emojis['waste_basket']:
                    for i in Managing_bot.commands.values():
                        await i.on_raw_reaction(msg, payload)
                await self.clear_raw_queue(True)
            except Exception as error:
                await send_error(msg, error, 'bot.py -> clear_raw_queue()')
        else:
            self.clearing_raw_reactions = False

    async def check_if_valid(self, command, msg):
        try:
            bot_perms = dict(iter(
                msg.guild.me.permissions_in(msg.channel)))
            user_perms = dict(iter(
                msg.author.permissions_in(msg.channel)))
            # check if command can be used in this type of channel
            if str(msg.channel.type) not in command.channel_types:
                if bot_perms['send_messages']:
                    await msg.reply(
                        'This command cannot be used in this channel type!')
                return False
            # check if bot has all the required permissions in the channel
            for perm in command.bot_permissions:
                if not bot_perms[perm]:
                    if bot_perms['send_messages']:
                        await msg.reply(
                            'I do not have the required permissions!')
                    return False
            required_roles = await get_required_roles(msg, command.name)
            user_roles = [i.name for i in msg.author.roles]
            if required_roles is not None:
                for i in required_roles:
                    if i in user_roles:
                        return True
            # check if user has all the required permissions
            for perm in command.user_permissions:
                if not user_perms[perm]:
                    if bot_perms['send_messages']:
                        await msg.reply(
                            'You do not have the required permissions!')
                    return False
            return True
        except Exception as err:
            await send_error(msg, err, 'bot.py -> check_if_valid()')

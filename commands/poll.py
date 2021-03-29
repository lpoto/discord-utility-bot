import discord
from command import Command
from utils import *


class Clear_chat(Command):
    def __init__(self):
        super().__init__('clear')
        self.description = 'Clears messages in chat.'
        self.bot_permissions = ['send_messages', 'manage_messages']
        self.user_permissions = ['send_messages', 'manage_messages']

    async def execute_command(self, msg):
        args = msg.content.split()
        try:
            if len(args) < 2:
                await msg.reply('How many messages do you want to delete?')
                return
            count = 0
            try:
                count = int(args[1])
            except Exception:
                await msg.reply('Argument must be a number between 0 and 50!')
                return
            else:
                count = int(args[1])
            if count >= 100:
                await msg.reply(
                    'You cannot delete more than 50 messages at once!')
                return
            if count <= 0:
                await msg.reply('You must delete at least 1 message!')
                return
            await msg.channel.purge(limit=count + 1)
        except Exception as err:
            print(err)
            await msg.reply('Something went wrong!')


Clear_chat()

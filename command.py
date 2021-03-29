import discord
from bot import Managing_bot
from utils import *


class Command:
    def __init__(
            self,
            name='help',
    ):
        self.name = name
        self.description = 'Get information about the commands.'
        self.bot_permissions = [
            'send_messages',
            'add_reactions']
        self.user_permissions = ['send_messages']
        self.channel_types = ['text']
        self.client = None
        self.add_command()

    def additional_info(self):
        return '* There is no additional information.'

    def add_command(self):
        # adds object to commands dictionary
        # in Managing_bot
        Managing_bot.add_command(self)

    def command_info(self):
        info = [
            self.description,
            self.bot_server_permissions,
            self.bot_glob_permissions,
            self.user_serverpermissions,
            self.channel_types
        ]
        return info

    async def execute_command(self, msg):
        commands = Managing_bot.return_commands()
        embed_var = discord.Embed(
            title='Help',
            color=random_color())
        for k, v in commands.items():
            if k == 'help':
                continue
            embed_var.add_field(
                name=k,
                value=v.description,
                inline=False)
        new_msg = await msg.channel.send(embed=embed_var)
        await message_react(new_msg, emojis['waste_basket'])

    async def on_raw_reaction(self, msg, payload):
        pass


Command()

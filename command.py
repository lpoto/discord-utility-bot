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
        # on init add the created object to
        # Managing_bot's commands dictionary
        self.add_command()

    def additional_info(self):
        # default additional info, overriden by
        # child classes' additional info
        return '* There is no additional information.'

    def add_command(self):
        # adds object to commands dictionary
        # in Managing_bot
        Managing_bot.add_command(self)

    def command_info(self):
        # detailed information about
        # the command
        info = [
            self.name,
            self.description,
            self.additional_info(),
            self.bot_permissions,
            self.user_permissions,
            self.channel_types
        ]
        return info

    async def execute_command(self, msg):
        # by default the Command object will
        # send info about all the commands,
        # classes extending default Command will
        # override this method
        prefix = await get_prefix(msg)
        commands = Managing_bot.return_commands()
        embed_var = discord.Embed(
            title='Help',
            description='current prefix: [{}]'.format(prefix),
            color=random_color())
        footer = '"{}command help" for details about the command.'.format(
                prefix)
        embed_var.set_footer(text=footer)
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

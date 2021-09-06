import discord
from utils.wrappers import EmbedWrapper, MemberWrapper
from utils.misc import random_color, delete_button
from commands.help import Help


class Games(Help):
    def __init__(self):
        super().__init__(name='games')
        self.description = 'Show all games.'

    async def execute_command(self, msg):
        embed_var = EmbedWrapper(discord.Embed(
            description='',
            color=random_color()),
            embed_type='GAMES',
            marks=EmbedWrapper.INFO,
            extra='Click on the game you want to play to start it.' +
            10 * '\u2000')
        components = []
        for k, v in self.bot.commands.items():
            if v.game:
                components.append(discord.ui.Button(label=k))
        components.append(delete_button())
        await msg.channel.send(
            embed=embed_var, components=components)

    async def on_button_click(self, button, msg, user):
        if button.label in self.bot.commands:
            user = MemberWrapper(user)
            await self.bot.commands[button.label].execute_command(
                msg, user)

    def additional_info(self, prefix):
        return ('* Click on the button with the name of the game ' +
                'you want to play.')

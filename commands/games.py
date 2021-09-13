import discord
from utils.wrappers import EmbedWrapper
from utils.misc import random_color, delete_button
from commands.help import Help


class Games(Help):
    def __init__(self):
        super().__init__(name='games')
        self.description = 'Show all games.'
        self.requires_database = True
        self.interactions_require_database = True
        self.synonyms = ['play']

    async def execute_command(self, msg):
        embed_var = EmbedWrapper(discord.Embed(
            description='',
            color=random_color()),
            embed_type='GAMES',
            marks=EmbedWrapper.INFO,
            info='Click on the game to start it.' +
            10 * '\u2000')
        components = []
        options = []
        for k, v in self.bot.games.items():
            options.append(discord.SelectOption(label=k))
            components.append(discord.ui.Button(label=k))
        components.append(delete_button())
        components.append(
                discord.ui.Select(
                    placeholder='See leaderboards.',
                    options=options))
        await msg.channel.send(
            embed=embed_var, components=components)

    async def on_button_click(self, button, msg, user, webhook):
        if not msg.is_games:
            return
        if button.label in self.bot.games:
            await self.bot.games[button.label].execute_game(
                msg, user, webhook)

    async def on_menu_select(self, interaction, msg, user, webhook):
        if not msg.is_games:
            return
        name = interaction.data['values'][0]
        embed = await self.bot.database.use_database(
                self.bot.games[name].leaderboard_embed, msg)
        if embed is None:
            await webhook.send(
                    content='No availible leaderboard.',
                    ephemeral=True)
            return
        await webhook.send(embed=embed, ephemeral=True)

    def additional_info(self, prefix):
        return ('* Click on the button with the name of the game ' +
                'you want to play.')

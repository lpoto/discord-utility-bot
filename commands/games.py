import discord
from utils.wrappers import EmbedWrapper
from utils.misc import colors, delete_button
import utils.decorators as decorators
from commands.help import Help


class Games(Help):
    def __init__(self):
        super().__init__(name='games')
        self.description = 'A menu for starting games and seeing leaderboards.'
        self.requires_database = True
        self.interactions_require_database = True
        self.synonyms = ['play']

    @decorators.ExecuteCommand
    async def send_game_menu_to_channel(self, msg, return_only=False):
        color = colors[list(self.bot.commands.keys()).index(
            self.name) % 9]
        embed_var = EmbedWrapper(discord.Embed(
            description='',
            color=color),
            embed_type='GAMES',
            marks=EmbedWrapper.INFO,
            info='Select a game you want to play, or a ' +
            'game\'s leaderboard you want to see.')
        options1 = []
        options2 = []
        for k, v in self.bot.games.items():
            options1.append(discord.SelectOption(
                label=k,
                description=v.description))
            options2.append(discord.SelectOption(
                label=k + ' - leaderboard'))
        components = [
            discord.ui.Select(
                placeholder='Select a game',
                options=options1),
            discord.ui.Select(
                placeholder='Select a leaderboard',
                options=options2),
            discord.ui.Button(label='help'),
            delete_button()
        ]
        if not return_only:
            await msg.channel.send(
                embed=embed_var, components=components)
            return
        return (embed_var, components)

    @decorators.ExecuteWithInteraction
    async def edit_message_to_game_menu(self, msg, user, webhook):
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        info = await self.send_game_menu_to_channel(self, msg, True)
        await msg.edit(embed=info[0], components=info[1])

    @decorators.OnMenuSelect
    async def start_game_or_leaderboard(self, interaction, msg, user, webhook):
        if not msg.is_games:
            return
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        name = interaction.data['values'][0]
        if ' - leaderboard' in name:
            name = name.replace(' - leaderboard', '', 1)
            embed = await self.bot.database.use_database(
                self.bot.games[name].leaderboard_embed, msg)
            if embed is None:
                await webhook.send(
                    content='No availible leaderboard.',
                    ephemeral=True)
            else:
                await webhook.send(embed=embed, ephemeral=True)
        await msg.edit(text='')

    def additional_info(self, prefix):
        return ('* Click on the button with the name of the game ' +
                'you want to play.')

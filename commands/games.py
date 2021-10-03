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
        # send a game menu to the channel
        # add a dropdown with all availible games, selecting one of them
        # will start the game
        # add a dropdown with all the games' leaderboards
        # selecting one of those will send you an ephemeral leaderboard
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
        # games menu can be oppened by clicking on a "games" button
        # on a bot's message (help message)
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        info = await self.send_game_menu_to_channel(self, msg, True)
        await msg.edit(embed=info[0], components=info[1])

    @decorators.OnMenuSelect
    async def start_game_or_leaderboard(self, interaction, msg, user, webhook):
        # determine whether a leaderboard was selected
        # if a game was selected, it will be started from that game's
        # decorators.@ExecuteWithInteraction method
        if not msg.is_games:
            return
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        name = interaction.data['values'][0]
        if ' - leaderboard' in name:
            name = name.replace(' - leaderboard', '', 1)
            embed = await self.bot.database.use_database(
                self.send_leaderboard, msg, name)
            if embed is None:
                await webhook.send(
                    content='No availible leaderboard.',
                    ephemeral=True)
            else:
                await webhook.send(embed=embed, ephemeral=True)
        await msg.edit(content='')

    async def send_leaderboard(self, cursor, msg, label):
        cursor.execute(
            "SELECT * FROM wins WHERE game = '{}' AND guild_id = '{}'"
            .format(label, msg.guild.id))
        fetched = cursor.fetchall()
        if fetched is None or len(fetched) == 0:
            return
        color = colors[list(self.bot.games.keys()).index(label) % 9]
        embed_var = EmbedWrapper(discord.Embed(
            title='Leaderboard',
            color=color),
            embed_type=self.bot.games[label].embed_type,
            marks=EmbedWrapper.INFO)
        users = {}
        for i in fetched:
            user = msg.guild.get_member(int(i[2]))
            if user is None:
                continue
            users[user] = i[3]
        users = {k: v for k, v in sorted(
            users.items(), key=lambda item: item[1], reverse=True)}
        i = 1
        for u, w in users.items():
            if i > 10:
                break
            name = u.name if not u.nick else u.nick
            embed_var.add_field(
                name='{}.  {}'.format(i, name), value=w, inline=False)
            i += 1
        return embed_var

    def additional_info(self, prefix):
        return ('* Click on the button with the name of the game ' +
                'you want to play.')

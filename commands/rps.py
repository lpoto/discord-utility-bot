import discord
from utils.misc import rps_emojis, random_color, delete_button
from utils.wrappers import EmbedWrapper
from commands.help import Help


class Rps(Help):
    def __init__(self):
        super().__init__(name='rock-paper-scissors')
        self.synonyms = ['rps']
        self.description = 'A game of rock-paper-scissors between two users.'
        self.embed_type = 'ROCK_PAPER_SCISSORS'
        self.game = True

    async def execute_command(self, msg, user=None):
        # show leaderboard
        if user is None:
            args = msg.content.split()
            if len(args) > 1 and (args[1] == 'leaderboard' or args[1] == 'lb'):
                await self.bot.database.use_database(
                    self.show_leaderboard, msg)
                return
            user = msg.author
        # send dm to the user who started the game and
        # wait for him to react with one of the options
        dm = await user.create_dm()
        dm_embed = EmbedWrapper(discord.Embed(
            description='Select one of the three options to start the game.',
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE)
        dm_embed.set_id(channel_id=msg.channel.id)
        components = [discord.ui.Button(emoji=i) for i in rps_emojis]
        await dm.send(
            embed=dm_embed,
            components=components)

    async def on_button_click(self, interaction, interaction_message):
        if not interaction_message.is_rps:
            return
        # check if rps dm message, then get channel id from
        # which the rps game was started
        # then send new embed to that channel and wait for another
        # opponent to join
        # edit chosen emoji to embed's title
        for i in interaction_message.components:
            for j in i.children:
                if j.custom_id == interaction.data['custom_id']:
                    if str(interaction_message.channel.type) == 'text':
                        await self.handle_button_click(
                            j, interaction_message, interaction.user)
                        return
                    await self.handle_dm_button_click(
                        j, interaction_message, interaction.user)
                    return

    async def handle_dm_button_click(self, button, interaction_msg, user):
        embed = interaction_msg.embeds[0]
        embed.mark(embed.ENDED)
        components = []
        embed.description = 'The game has been sent to the channel!'
        for i in rps_emojis:
            if str(i) == button.emoji.name:
                components.append(discord.ui.Button(
                    style=discord.ButtonStyle.green, emoji=i))
            else:
                components.append(discord.ui.Button(emoji=i))
        await interaction_msg.edit(
            embed=embed,
            components=components)
        # get channel id, message id from embed's footer
        info = embed.get_id()
        channel = self.bot.client.get_channel(info['channel_id'])
        # create game embed and send it to channel where game was started
        user = channel.guild.get_member(user.id)
        new_embed = EmbedWrapper(discord.Embed(
            title='{} is waiting for an opponent'.format(
                user.name if not user.nick else user.nick),
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE)
        # if user has nickname set up use nickname, else use username
        new_embed.description = (
            'Select one of the three options to join the game!')
        new_embed.set_id(message_id=interaction_msg.id, user_id=user.id)
        if user.avatar:
            new_embed.set_thumbnail(url=user.avatar)
        # add users profile picture to the embed
        await channel.send(
            embed=new_embed,
            components=[discord.ui.Button(emoji=i) for i in rps_emojis])

    async def handle_button_click(self, button, interaction_msg, user):
        # await for rock paper or scissors reaction on the running game
        # and get the user and the winner from the reaction
        info = interaction_msg.embeds[0].get_id()
        if str(user.id) == str(info['user_id']):
            return
        user = interaction_msg.guild.get_member(user.id)
        # rps embed has user id and dm msg id in footer
        # fetch the first msg from the dm and get first users choice from it
        user1 = interaction_msg.guild.get_member(int(info['user_id']))
        user2 = interaction_msg.guild.get_member(user.id)
        if user1 is None or user2 is None:
            return
        first_msg = await user1.fetch_message(
            int(info['message_id']))
        if first_msg is None or len(first_msg.embeds) != 1:
            return
        emoji1 = None
        for i in first_msg.components:
            for j in i.children:
                if j.style == discord.ButtonStyle.green:
                    emoji1 = j.emoji.name
        # compare the chosen options and get the winner of the game
        await self.game_results(
            user1, user2, emoji1, button.emoji.name,
            interaction_msg)

    async def add_winner(self, embed, msg,  info):
        embed.title = (
            '{} wins against {}!').format(
            info['winner_name'], info['loser_name'])
        embed.description = '{} against {}'.format(
            info['winner_emoji'], info['loser_emoji'])
        wins = await self.bot.database.use_database(
            self.wins_to_database, msg, info['winner_id'])
        if wins is not None:
            embed.description += '\n\n{} total wins: {}'.format(
                info['winner_name'], wins)
        embed.set_id()
        if info['winner_avatar']:
            embed.set_thumbnail(url=info['winner_avatar'])
        else:
            embed.set_thumbnail(url=discord.Embed.Empty)
        return embed

    async def game_results(self, user1, user2, emoji1, emoji2, msg):
        # find the winner of the game
        # edit the existing game message accordingly
        user_names = [user1.name, user2.name]
        if user1.nick:
            user_names[0] = user1.nick
        if user2.nick:
            user_names[1] = user2.nick
        # if same reactions -> draw
        if emoji1 == emoji2:
            new_embed = EmbedWrapper(discord.Embed(
                title='{} and {} draw with {} vs {}!'.format(
                    user_names[0], user_names[1], emoji1, emoji2)),
                embed_type=self.embed_type,
                marks=EmbedWrapper.ENDED)
            await msg.edit(embed=new_embed)
        else:
            info = {}
            # get winner
            if ((emoji1 == rps_emojis[0] and
                 emoji2 == rps_emojis[2]) or
                (emoji1 == rps_emojis[1] and
                    emoji2 == rps_emojis[0]) or
                    (emoji1 == rps_emojis[2] and
                        emoji2 == rps_emojis[1])):
                info['winner_name'] = user_names[0]
                info['winner_id'] = user1.id
                info['winner_emoji'] = emoji1
                info['winner_avatar'] = user1.avatar
                info['loser_name'] = user_names[1]
                info['loser_emoji'] = emoji2
            else:
                info['winner_name'] = user_names[1]
                info['winner_id'] = user2.id
                info['winner_emoji'] = emoji2
                info['winner_avatar'] = user2.avatar
                info['loser_name'] = user_names[0]
                info['loser_emoji'] = emoji1
            new_embed = await self.add_winner(msg.embeds[0], msg, info)
            new_embed.mark(new_embed.ENDED)
        components = []
        for i in rps_emojis:
            if i == emoji2:
                components.append(discord.ui.Button(
                    style=discord.ButtonStyle.green, emoji=i))
            else:
                components.append(discord.ui.Button(emoji=i))
        components.append(delete_button())
        await msg.edit(embed=new_embed, components=components)

    async def wins_to_database(self, cursor, msg, user_id):
        # add a win for the user to the database and return total win count
        cursor.execute((
            "SELECT * FROM rock_paper_scissors WHERE guild_id = '{}' AND" +
            " user_id = '{}'").format(msg.guild.id, user_id))
        fetched = cursor.fetchone()
        count = 1
        if fetched is None:
            cursor.execute(
                ("INSERT INTO rock_paper_scissors (guild_id, user_id, " +
                 "wins) VALUES ('{}', '{}', 1)").format(
                    msg.guild.id, user_id))
        else:
            count = fetched[2] + 1
            cursor.execute(
                ("UPDATE rock_paper_scissors SET wins = {} WHERE " +
                 "guild_id = '{}' and user_id = '{}'").format(
                     count, msg.guild.id, user_id))
        return count

    async def show_leaderboard(self, cursor, msg):
        # show guild members that played rps in order
        # best to worst
        cursor.execute(
            "SELECT * FROM rock_paper_scissors WHERE guild_id = '{}'"
            .format(msg.guild.id))
        fetched = cursor.fetchall()
        if fetched is None or fetched is []:
            await msg.channel.send(
                text='No availible leaderboard.',
                delete_after=5)
            return
        embed_var = EmbedWrapper(discord.Embed(
            title='Leaderboard',
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.INFO)
        users = {}
        for i in fetched:
            user = msg.guild.get_member(int(i[1]))
            if user is None:
                continue
            users[user] = i[2]
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
        await msg.channel.send(
            embed=embed_var)

    def additional_info(self, prefix):
        return '{}\n{}\n{}\n{}'.format(
            ('* Start the game with "{}rps", then react ' +
             'with your choice in DM.').format(prefix),
            '* Another user can join by reacting with one of three options.',
            '* A record of wins will be kept.',
            '* See leaderboard with "{}rps leaderboard"'.format(prefix))

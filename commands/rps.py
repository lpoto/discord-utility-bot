import discord
from utils.misc import rps_emojis, random_color, waste_basket
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
            description='React with your weapon of choice!',
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE)
        dm_embed.set_id(channel_id=msg.channel.id)
        await dm.send(
            embed=dm_embed,
            reactions=rps_emojis)

    async def on_dm_reaction(self, payload):
        # check if rps dm message, then get channel id from
        # which the rps game was started
        # then send new embed to that channel and wait for another
        # opponent to join
        if (payload.emoji.name not in rps_emojis
                or payload.event_type != 'REACTION_ADD'):
            return
        user = self.bot.client.get_user(int(payload.user_id))
        if user is None:
            return
        reaction_msg = await user.fetch_message(payload.message_id)
        if reaction_msg is None or not reaction_msg.is_rps:
            return
        # edit chosen emoji to embed's title
        embed = reaction_msg.embeds[0]
        embed.title = payload.emoji.name
        embed.mark(embed.ENDED)
        await reaction_msg.edit(
            text=reaction_msg.content,
            embed=embed)
        # get channel id, message id from embed's footer
        info = embed.get_id()
        channel = None
        try:
            channel = self.bot.client.get_channel(info['channel_id'])
            if channel is None:
                raise ValueError
            user = channel.guild.get_member(payload.user_id)
            if user is None:
                raise ValueError
        except ValueError:
            return
        # create game embed and send it to channel where game was started
        new_embed = EmbedWrapper(discord.Embed(
            title='{} is waiting for an opponent'.format(
                user.name if not user.nick else user.nick),
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE)
        # if user has nickname set up use nickname, else use username
        new_embed.description = 'React with {}, {} or {} to join!'.format(
            rps_emojis[0], rps_emojis[1], rps_emojis[2])
        new_embed.set_id(message_id=payload.message_id, user_id=user.id)
        # add users profile picture to the embed
        await channel.send(
            embed=new_embed,
            reactions=rps_emojis)

    async def on_raw_reaction(self, msg, payload):
        # await for rock paper or scissors reaction on the running game
        # and get the user and the winner from the reaction
        if (payload.emoji.name not in rps_emojis or
                payload.event_type != 'REACTION_ADD' or
                payload.member.bot or
                not msg.is_rps):
            return
        info = msg.embeds[0].get_id()
        if str(payload.user_id) == str(info['user_id']):
            return
        # rps embed has user id and dm msg id in footer
        # fetch the first msg from the dm and get first users choice from it
        user1 = msg.guild.get_member(int(info['user_id']))
        user2 = msg.guild.get_member(payload.user_id)
        if user1 is None or user2 is None:
            return
        first_msg = await user1.fetch_message(
            int(info['message_id']))
        if first_msg is None or len(first_msg.embeds) != 1:
            return
        emoji1 = first_msg.embeds[0].title
        # compare the chosen options and get the winner of the game
        await self.game_results(user1, user2, emoji1, payload.emoji.name, msg)

    async def add_winner(self, embed, msg,  info):
        embed.title = (
            '{} wins against {}!').format(
            info['winner_name'], info['loser_name'])
        embed.description = '{} against {}'.format(
            info['winner_emoji'], info['loser_emoji'])
        wins = await self.bot.database.use_database(
            self.wins_to_database, msg, info['winner_id'])
        embed.description += '\n\n{} total wins: {}'.format(
            info['winner_name'], wins)
        embed.set_id()
        if info['winner_avatar_url']:
            embed.set_thumbnail(url=info['winner_avatar_url'])
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
                title='{} draws against {}!'.format(
                    user_names[0], user_names[1])),
                embed_type=self.embed_type,
                marks=EmbedWrapper.ENDED)
            await msg.edit(embed=new_embed)
            return
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
            info['winner_avatar_url'] = user1.avatar_url
            info['loser_name'] = user_names[1]
            info['loser_emoji'] = emoji2
        else:
            info['winner_name'] = user_names[1]
            info['winner_id'] = user2.id
            info['winner_emoji'] = emoji2
            info['winner_avatar_url'] = user2.avatar_url
            info['loser_name'] = user_names[0]
            info['loser_emoji'] = emoji1
        new_embed = await self.add_winner(msg.embeds[0], msg, info)
        new_embed.mark(new_embed.ENDED)
        await msg.edit(embed=new_embed)

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
            embed=embed_var,
            reactions=waste_basket)

    def additional_info(self, prefix):
        return '{}\n{}\n{}\n{}'.format(
            ('* Start the game with "{}rps", then react ' +
             'with your choice in DM.').format(prefix),
            '* Another user can join by reacting with one of three options.',
            '* A record of wins will be kept.',
            '* See leaderboard with "{}rps leaderboard"'.format(prefix))

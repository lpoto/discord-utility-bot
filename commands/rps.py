import discord
from utils import *
from command import Command


class Rps(Command):
    options = ['🪨', '🗞️', '✂️']
    running_games = {}

    def __init__(self):
        super().__init__('rps')
        self.description = 'A game of rock-paper-scissors between two users.'

    async def execute_command(self, msg):
        try:
            # send dm to the user who started the game and
            # wait for him to react with one of the options
            dm = await msg.author.create_dm()
            dm_embed = discord.Embed(
                title='Rock-Paper-Scissors!',
                description='React with your weapon of choice!',
                color=random_color())
            dm_embed.set_footer(text=msg.channel.id)
            dm_message = await dm.send(embed=dm_embed)
            for i in self.options:
                await message_react(dm_message, i)
        except Exception as err:
            await send_error(msg, err, 'rps.py -> execute_command()')

    async def on_dm_reaction(self, payload):
        # check if rps dm message, then get channel id from
        # which the rps game was started
        # then send new embed to that channel and wait for another
        # opponent to join
        try:
            if payload.emoji.name not in self.options:
                return
            dm_channel = client.get_channel(payload.channel_id)
            if dm_channel is None:
                return
            reaction_msg = await dm_channel.fetch_message(payload.message_id)
            if reaction_msg is None or reaction_msg.embeds == []:
                return
            embed = reaction_msg.embeds[0]
            if embed is None or embed.title != 'Rock-Paper-Scissors!':
                return
            # edit chosen emoji to embed's title
            embed.title = 'Rock-Paper-Scissors!  ({})'.format(
                payload.emoji.name)
            await message_edit(
                reaction_msg, text=reaction_msg.content, embed=embed)
            # get channel id, message id from embed's footer
            info = embed.footer.text
            channel = None
            try:
                channel = client.get_channel(int(info))
            except Exception:
                return
            if channel is None:
                return
            user = channel.guild.get_member(payload.user_id)
            if user is None:
                return
            # create game embed and send it to channel where game was started
            new_embed = discord.Embed(
                title='Rock-Paper-Scissors!',
                color=random_color())
            # if user has nickname set up use nickname, else use username
            if user.nick:
                new_embed.description = user.nick
            else:
                new_embed.description = user.name
            new_embed.set_footer(
                text='React with {}, {} or {} to join!'.format(
                    self.options[0], self.options[1], self.options[2]))
            new_embed.description += ' is waiting for an opponent.'
            # add users profile picture to the embed
            if user.avatar_url:
                new_embed.set_thumbnail(url=user.avatar_url)
            new_msg = await channel.send(embed=new_embed)
            self.running_games[new_msg.id] = (
                payload.user_id, payload.emoji.name)
            for i in self.options:
                await message_react(new_msg, i)
        except Exception as err:
            await send_error(None, err, 'rps.py -> on_dm_reaction()')

    async def on_raw_reaction(self, msg, payload):
        try:
            if (payload.emoji.name not in self.options or
                    payload.event_type != 'REACTION_ADD' or
                    msg.embeds == [] or msg.id not in self.running_games or
                    msg.embeds[0].title != 'Rock-Paper-Scissors!' or
                    msg.content != '' or
                    self.running_games[msg.id][0] == payload.user_id):
                return
            game = [self.running_games[msg.id],
                    (payload.user_id, payload.emoji.name)]
            # compare the chosen options and get the winner of the game
            await self.game_results(game, msg)

        except Exception as err:
            await send_error(msg, err, 'rps.py -> on_raw_reaction()')

    async def game_results(self, game, msg):
        # find the winner of the game
        # edit the existing game message accordingly
        try:
            new_embed = discord.Embed(
                title='Rock-Paper-Scissors!',
                color=msg.embeds[0].color)
            user1 = msg.guild.get_member(game[0][0])
            user2 = msg.guild.get_member(game[1][0])
            user_names = [user1.name, user2.name]
            if user1.nick:
                user_names[0] = user1.nick
            if user2.nick:
                user_names[1] = user2.nick
            # if same reactions -> draw
            if game[0][1] == game[1][1]:
                new_embed.description = '{} draws agains {}!'.format(
                    user_names[0], user_names[1])
                await message_edit(msg, text='<@{}>, <@{}>'.format(
                    game[0][0], game[1][0]), embed=new_embed)
                return
            # get winner
            if ((game[0][1] == self.options[0] and
                 game[1][1] == self.options[2]) or
                (game[0][1] == self.options[1] and
                    game[1][1] == self.options[0]) or
                    (game[0][1] == self.options[2] and
                        game[1][1] == self.options[1])):
                new_embed.description = (
                    '{} wins against {} with {} against {}').format(
                    user_names[0], user_names[1], game[0][1], game[1][1])
                if user1.avatar_url:
                    new_embed.set_thumbnail(url=user1.avatar_url)
                new_embed = await self.wins_to_database(
                    user1.id, new_embed, user_names[0])
            else:
                new_embed.description = (
                    '{} wins against {} with {} against {}').format(
                    user_names[1], user_names[0], game[1][1], game[0][1])
                if user2.avatar_url:
                    new_embed.set_thumbnail(url=user2.avatar_url)
                new_embed = await self.wins_to_database(
                    user1.id, new_embed, user_names[0])
            await message_edit(msg, text='<@{}>, <@{}>'.format(
                game[0][0], game[1][0]), embed=new_embed)
            del self.running_games[msg.id]
        except Exception as err:
            await send_error(msg, err, 'rps.py -> game_results()')

    async def wins_to_database(self, user_id, embed, user_name):
        # add a win for the user to the database and return total win count
        try:
            if database.connected is False:
                return embed
            cursor = database.cnx.cursor(buffered=True)
            cursor.execute("SELECT * FROM rps WHERE user_id = '{}'".format(
                user_id))
            fetched = cursor.fetchone()
            count = 1
            if fetched is None:
                cursor.execute(("INSERT INTO rps (user_id, wins) VALUES " +
                                "('{}', {})")).format(user_id, 1)
            else:
                count = fetched[1] + 1
                cursor.execute(("UPDATE rps SET wins = {} WHERE " +
                                "user_id = '{}'").format(count, user_id))
            database.cnx.commit()
            cursor.close()
            embed.set_footer(text='{} total wins: {}'.format(
                user_name, count))
            return embed
        except Exception as err:
            await send_error(None, err, 'rps.py -> wins_to_databse()')
            return embed

    def additional_info(self):
        return '{}\n{}\n{}\n{}'.format(
            '* Start the game with "rps", then react with your choice in DM.',
            '* Another user can join by reacting with one of three options.',
            '* A record of wins will be kept.')


Rps()

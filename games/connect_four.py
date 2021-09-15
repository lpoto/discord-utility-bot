import discord
from threading import Timer
from datetime import datetime, timedelta
import asyncio
import utils.misc as utils
from utils.wrappers import EmbedWrapper
from commands.help import Help


class ConnectFour(Help):
    def __init__(self):
        super().__init__(name='connect_four')
        self.description = 'A game of connect_four between two users.'
        self.synonyms = ['cf']
        self.embed_type = 'CONNECT_FOUR'
        self.tokens = [utils.emojis[i] for i in range(7)]
        self.empty_grid_element = utils.black_circle
        self.timers = {}

    def clean_up(self):
        for timer in self.timers.values():
            if timer is not None and timer.is_alive():
                timer.cancel()
        self.timers = {}

    async def execute_game(self, msg, user, webhook):
        # if first word is lb or leaderboard show players with most wins
        embed_var = EmbedWrapper(discord.Embed(
            description='{}\n{}'.format(
                'Select a token to join or change the already selected token!',
                'Select "leave" to leave the game.'),
            color=utils.random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.INFO)
        components = [discord.ui.Button(
            emoji=token, row=0 if idx < 4 else 1
        ) for idx, token in enumerate(self.tokens)]
        components.append(discord.ui.Button(
            label='leave', row=1, style=discord.ButtonStyle.primary))
        m = await msg.channel.send(embed=embed_var, components=components)
        await self.select_tokens(
            m,
            user.id,
            user.name if not user.nick else user.nick,
            self.tokens[1])

    async def execute_command(self, msg):
        prefix = await self.bot.database.get_prefix(msg)
        await self.bot.handle_message(msg, 'games', prefix)

    async def on_button_click(self, button, msg, user, webhook):
        if not msg.is_connect_four:
            return
        if msg.is_info:
            if msg.id in self.timers and self.timers[
                    msg.id] is False:
                return
            if button.label and button.label == 'leave':
                await self.remove_selected_token(msg, user.id)
                return
            if button.emoji.name in self.tokens:
                await self.select_tokens(
                    msg, user.id,
                    user.name if not user.nick else user.nick,
                    button.emoji.name)
            return
        if (button.label == 'forfeit' or
                button.emoji.name in utils.number_emojis):
            await self.play_game(button, msg, user)

    async def select_tokens(self, msg, user_id, name, token):
        tks = msg.embeds[0].description.split('\n')
        start = False
        if len(tks) == 2:
            tks.append('{}: {}'.format(name, token))
            await self.bot.database.use_database(
                self.add_game, msg, user_id, None)
        else:
            x = await self.bot.database.use_database(
                self.get_game, msg)
            u1_id = x['user_id']
            tkn = tks[2].split(': ')[-1]
            if token == tkn:
                return
            if str(u1_id) == str(user_id):
                tks[2] = '{}: {}'.format(name, token)
            elif x['user2_id']:
                u2_id = str(x['user2_id'])
                if u2_id != str(user_id):
                    return
                tks[3] = '{}: {}'.format(name, token)
            else:
                tks.append('{}: {}'.format(name, token))
                await self.bot.database.use_database(
                    self.add_game, msg, x['user_id'], user_id)
                msg.embeds[0].title = 'Starting in 5 seconds'
                start = True
        msg.embeds[0].description = '\n'.join(tks)
        await msg.edit(embed=msg.embeds[0])
        if start:
            self.timers[msg.id] = Timer(7, self.start_game, args=(
                msg, x['user_id'], user_id))
            self.timers[msg.id].start()

    async def remove_selected_token(self, msg, user_id):
        x = await self.bot.database.use_database(
            self.get_game, msg)
        if (not x['user_id'] and not x['user2_id']):
            return
        if (msg.id in self.timers and
            self.timers[msg.id] is not None and
                self.timers[msg.id].is_alive()):
            self.timers[msg.id].cancel()
            del self.timers[msg.id]
        idx = None
        if str(user_id) == str(x['user_id']):
            idx = 0
            await self.bot.database.use_database(
                self.add_game, msg, x['user2_id'], None)
        elif str(user_id) == str(x['user2_id']):
            idx = 1
            await self.bot.database.use_database(
                self.add_game, msg, x['user_id'], None)
        if idx is None:
            return
        tks = msg.embeds[0].description.split('\n')
        del tks[idx + 2]
        msg.embeds[0].title = ''
        msg.embeds[0].description = '\n'.join(tks)
        await msg.edit(embed=msg.embeds[0])

    def start_game(self, msg, user1_id, user2_id):
        if msg.id in self.timers:
            self.timers[msg.id] = False
        tks = msg.embeds[0].description.split('\n')[1:]
        # create an empty grid and wait for players to start playing
        user1 = msg.guild.get_member(int(user1_id))
        user2 = msg.guild.get_member(int(user2_id))
        if user1 is None or user2 is None:
            return
        user1 = (user1.id, user1.name if not user1.nick else user1.nick)
        user2 = (user2.id, user2.name if not user2.nick else user2.nick)
        token1 = tks[1].split(': ')[-1]
        token2 = tks[2].split(': ')[-1]
        grid = self.empty_grid
        embed_var = self.build_embed(
            msg.embeds[0], user1, user2, token1, token2, [], grid, 1)
        x = asyncio.run_coroutine_threadsafe(msg.edit(
            embed=embed_var,
            components=[discord.ui.Button(
                emoji=utils.number_emojis[i], row=0 if i < 4 else 1
            ) for i in range(7)] +
            [discord.ui.Button(label='forfeit', row=1,
                               style=discord.ButtonStyle.primary)]),
            loop=self.bot.client.loop)
        x.result()
        if msg.id in self.timers:
            del self.timers[msg.id]

    async def play_game(self, button, msg, user):
        embed = msg.embeds[0]
        x = await self.bot.database.use_database(
            self.get_game, msg)
        if not x['user_id'] or not x['user2_id']:
            return
        user1 = msg.guild.get_member(int(x['user_id']))
        user2 = msg.guild.get_member(int(x['user2_id']))
        token = embed.description.split('\n')[0].split(': ')[-1]
        tks = embed.title.replace('!', '').split(' vs ')
        token1 = tks[0][-1]
        token2 = tks[1][-1]
        if (user1 is None or user2 is None or
                token == token1 and str(user1.id) != str(user.id) or
                token == token2 and str(user2.id) != str(user.id)):
            return
        move = 0
        if button.emoji and button.emoji.name in utils.number_emojis:
            move = utils.number_emojis.index(button.emoji.name) + 1
        moves = embed.description.split('\n')[-1][7:]
        moves = [int(i) for i in moves]
        if moves.count(move) >= 6:
            return
        moves.append(move)
        grid = msg.embeds[0].description.split('\n')[2:][:-3]
        grid = [self.split_line(i) for i in grid]
        completed = False
        turn = len(moves) % 2
        if move > 0:
            grid, completed, turn = self.play(moves, token1, token2, grid)
        user1 = (user1.id, user1.name if not user1.nick else user1.nick)
        user2 = (user2.id, user2.name if not user2.nick else user2.nick)
        embed_var = None
        if completed or button.label == 'forfeit':
            embed_var = await self.completed_embed(
                msg, user1, user2, token1, token2,
                moves, grid, turn, False, color=embed.color,
                forfeit=button.label == 'forfeit')
            await msg.edit(embed=embed_var, components=utils.delete_button())
        else:
            if len(moves) == 42:
                embed_var = await self.completed_embed(
                    msg, user1, user2, token1, token2,
                    moves, grid, turn,
                    True, color=embed.color)
                await msg.edit(
                    embed=embed_var, components=utils.delete_button())
            else:
                embed_var = self.build_embed(
                    msg.embeds[0], user1, user2, token1, token2,
                    moves, grid, turn)
        await msg.edit(
            embed=embed_var)

    def split_line(self, line):
        return (line.replace('\u2000', ''
                             ).replace('\u3000', '')).split()

    async def completed_embed(
            self,
            msg,
            user1,
            user2,
            token1,
            token2,
            moves,
            grid,
            on_move,
            draw,
            color,
            forfeit=False):
        users = (user1, user2) if on_move == 0 else (user2, user1)
        embed_var = EmbedWrapper(discord.Embed(
            description='Game completed\n\n{}'.format(self.grid_text(grid)),
            color=color),
            embed_type=self.embed_type,
            marks=EmbedWrapper.ENDED)
        if not forfeit:
            embed_var.title = '{} wins against {} with {}!'.format(
                users[0][1], users[1][1], token1 if on_move == 0 else token2)
        elif forfeit:
            embed_var.title = '{} {} forfeits agains {}!'.format(
                users[1][1], token2 if on_move == 0 else token1, users[0][1])
        if draw:
            embed_var.title = '{} draws against {}!'.format(user1[1], user2[1])
            moves.append(0)
        else:
            wins = await self.bot.database.use_database(
                self.wins_to_database, users[0][0], msg.guild.id)
            if wins is not None:
                embed_var.description += '\n\n{} total wins: {}'.format(
                    users[0][1], wins)
        if not forfeit:
            await self.bot.database.use_database(
                self.moves_to_database, ''.join([str(i) for i in moves]))
        await self.bot.database.use_database(
            self.delete_game, msg)
        return embed_var

    def build_embed(
            self,
            embed,
            user1,
            user2,
            token1,
            token2,
            moves,
            grid,
            on_move):
        embed.title = '{} {} vs {} {}!'.format(
            user1[1], token1, user2[1], token2)
        embed.description = 'On turn: {}\n\n{}\n\nMoves: {}'.format(
            token1 if on_move == 1 else token2,
            self.grid_text(grid),
            ''.join([str(i) for i in moves]))
        embed.mark(EmbedWrapper.NOT_DELETABLE)
        return embed

    def join_line(self, line):
        separator = ' '
        return str(3*'\u3000') + separator.join(line) + 3 * '\u3000'

    def grid_text(self, grid):
        txt = '\n'.join([self.join_line(i) for i in grid])
        txt += '\n' + 3*'\u3000' + ' '.join(utils.number_emojis)
        return txt

# the binary stuff
# get current grid by creating a bitmask from made moves
# xor with cur position to get opponent position

    @property
    def empty_grid(self):
        return [[self.empty_grid_element for _ in range(7)] for _ in range(6)]

    @property
    def overflow_mask(self):
        return 0x1020408102040

    def play(self, moves, token1, token2, grid=None):
        if grid is None:
            grid = self.empty_grid
        mask, position, turn = self.mask_position_turn(moves)
        completed = self.game_completed((position ^ mask) ^ mask)
        grid = self.add_token(
            grid, moves[-1] - 1, token1 if turn % 2 == 0 else token2)
        return (grid, completed, turn % 2)

    def mask_position_turn(self, moves):
        mask = 0
        position = 0
        for i in moves:
            mask = mask | (mask + (1 << ((i - 1) * 7)))
            position = position ^ mask
        turn = 0 if len(moves) == 0 else len(moves) - 1
        return (mask, position, turn)

    def game_completed(self, pos):
        # Horizontal check
        m = pos & (pos >> 7)
        if m & (m >> 14):
            return True
        # Diagonal \
        m = pos & (pos >> 6)
        if m & (m >> 12):
            return True
        # Diagonal /
        m = pos & (pos >> 8)
        if m & (m >> 16):
            return True
        # Vertical
        m = pos & (pos >> 1)
        if m & (m >> 2):
            return True
        # Nothing found
        return False

    def add_token(self, grid, move_idx, token):
        for i in range(6 - 1, -1, -1):
            if grid[i][move_idx] == self.empty_grid_element:
                grid[i][move_idx] = token
                break
        return grid

    async def get_game(self, cursor, msg):
        cursor.execute(("SELECT * FROM messages WHERE type = 'connect_Four'" +
                        " AND channel_id = '{}' AND message_id = '{}'").format(
            msg.channel.id, msg.id))
        fetched = cursor.fetchone()
        if fetched is None:
            return
        info = {
            'user_id': None if fetched[3] == 'None' else fetched[3],
            'user2_id': None if fetched[4] == 'None' else fetched[4]
        }
        return info

    async def delete_game(self, cursor, msg):
        cursor.execute(("UPDATE messages SET type = 'deleting' WHERE " +
                        "channel_id = '{}' AND message_id = '{}'").format(
            msg.channel.id, msg.id))

    async def add_game(self, cursor, msg, u1_id, u2_id):
        cursor.execute(("SELECT * FROM messages WHERE type = 'connect_four' " +
                        "AND channel_id = '{}' AND message_id = '{}'").format(
            msg.channel.id, msg.id))
        fetched = cursor.fetchone()
        if fetched is not None:
            cursor.execute(
                ("UPDATE messages SET user_id = '{}', info = '{}'" +
                 " WHERE channel_id = '{}' AND message_id = '{}'").format(
                    u1_id, u2_id, msg.channel.id, msg.id))
            return
        time = await self.bot.database.get_deletion_time(msg, self.name)
        cur_time = (datetime.now() + timedelta(hours=time + 0.5)
                    ).strftime('%d:%m:%H')
        cursor.execute(
            ("INSERT INTO messages " +
             "(type, channel_id, message_id, user_id, info, deletion_time)" +
             "VALUES ('connect_four', '{}', '{}', '{}', '{}', '{}')"
             ).format(msg.channel.id, msg.id, u1_id, u2_id, cur_time))
        await msg.delete(
                delay=time * 3600)

    async def wins_to_database(self, cursor, user_id, guild_id):
        # add a players win to database
        cursor.execute((
            "SELECT * FROM wins WHERE game = 'connect_four' AND" +
            " guild_id = '{}' AND user_id = '{}'").format(
                guild_id, user_id))
        fetched = cursor.fetchone()
        count = 1
        if fetched is None:
            cursor.execute(
                ("INSERT INTO wins (game, guild_id, user_id, " +
                 "wins) VALUES ('connect_four', '{}', '{}', 1)").format(
                    guild_id, user_id))
        else:
            count = fetched[3] + 1
            cursor.execute(
                ("UPDATE wins SET wins = {} WHERE " +
                 "game = 'connect_four' AND guild_id = '{}' " +
                 "AND user_id = '{}'").format(
                     count, guild_id, user_id))
        return count

    def moves_to_database(self, cursor, moves):
        cursor.execute(
            ("INSERT INTO connect_four_records (moves) VALUES ('{}')"
             ).format(moves))

    async def leaderboard_embed(self, cursor, msg):
        cursor.execute((
            "SELECT * FROM wins WHERE game = 'connect_four' " +
            "AND guild_id = '{}'"
        ).format(msg.guild.id))
        fetched = cursor.fetchall()
        if fetched is None or len(fetched) == 0:
            return
        embed_var = EmbedWrapper(discord.Embed(
            title='Leaderboard',
            color=utils.random_color()),
            embed_type=self.embed_type,
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
        return '* {}\n* {}\n* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Typing this command open a game menu.',
            'Clicking on this game in a game menu starts the game.',
            'Select a token you want to use in the game.',
            'Another user selects his token.',
            'You can leave the game in token selection.',
            'You can forfeit the game when it starts.',
            'A record of wins is kept.')

import discord
import utils
import random
from commands.help import Help


class ConnectFour(Help):
    def __init__(self):
        super().__init__(name='cf')
        self.description = 'A game of connect-four between two users.'
        self.game = True
        self.embed_type = 'CONNECT_FOUR'
        self.tokens = [utils.emojis[i] for i in range(7)]
        self.empty_grid_element = utils.black_circle

    async def execute_command(self, msg, user=None):
        # send a message and await second user to join with thumbs up reaction
        # if first word is lb or leaderboard show players with most wins
        if user is None:
            args = msg.content.split()
            if len(args) > 1 and args[1] in ['lb', 'leaderboard']:
                await self.show_leaderboard(msg)
                return
            user = msg.author
        name = user.name if not user.nick else user.nick
        embed_var = utils.EmbedWrapper(discord.Embed(
            description=('{} has challanged for a game of connect four.\n' +
                         'React with a token to join!\n').format(
                             name, utils.thumbs_up),
            color=utils.random_color()),
            embed_type=self.embed_type,
            marks=utils.EmbedWrapper.NOT_DELETABLE)
        embed_var.set_footer(text=user.id)
        await msg.channel.send(embed=embed_var, reactions=self.tokens)

    async def on_raw_reaction(self, msg, payload):
        # on added emoji if thumbs up join second user else if both users are
        # known start the game and await emoji number from 1 to 7, each
        # indicating a column in which the user drops a token
        if (payload.event_type != 'REACTION_ADD' or
                not msg.is_connect_four):
            return
        if not msg.is_fixed:
            # don't allow a user playing with himself
            # if msg.embeds[0].footer.text == str(payload.user_id):
            #    return
            starting_name = msg.embeds[0].description.split(
                ' has challanged for a game of connect four.')[0]
            if payload.emoji.name in self.tokens:
                await self.start_game(msg, payload.user_id,
                                      starting_name,
                                      payload.emoji.name)
            return
        if payload.emoji.name in utils.number_emojis:
            await self.play_game(
                msg, str(payload.user_id), payload.emoji.name)

    async def start_game(self, msg, user_id, name, token):
        tks = msg.embeds[0].description.split('\n')[2:]
        if len(tks) == 0:
            tks = ['', '']
        elif len(tks) == 1:
            tks.append('')
        if str(user_id) == msg.embeds[0].footer.text[:18]:
            if token == tks[1]:
                return
            tks[0] = token
        else:
            if (len(msg.embeds[0].footer.text) > 18 and
                    str(user_id) != msg.embeds[0].footer.text[18:] or
                    token == tks[0]):
                return
            tks[1] = token
            msg.embeds[0].set_footer(
                text=msg.embeds[0].footer.text + str(user_id))
        if any(i == '' for i in tks):
            msg.embeds[0].description = '\n'.join(
                msg.embeds[0].description.split('\n')[:2] + tks)
            await msg.edit(embed=msg.embeds[0])
            return
        # create an empty grid and wait for players to start playing
        user1 = msg.guild.get_member(int(msg.embeds[0].footer.text[:18]))
        user2 = msg.guild.get_member(int(msg.embeds[0].footer.text[18:]))
        if user1 is None or user2 is None:
            return
        user1 = (user1.id, user1.name if not user1.nick else user1.nick)
        user2 = (user2.id, user2.name if not user2.nick else user2.nick)
        token1 = tks[0]
        token2 = tks[1]
        start = random.randint(0, 1)
        if start == 1:
            x = user1
            user1 = user2
            user2 = x
            x = token1
            token1 = token2
            token2 = x
        grid = self.empty_grid
        embed_var = self.build_embed(user1, user2, token1, token2, [], grid, 1)
        for i in self.tokens:
            await msg.remove_reaction(
                emoji=i)
        await msg.edit(
            embed=embed_var,
            reactions=[utils.number_emojis[i] for i in range(7)])

    async def play_game(self, msg, user_id, emoji):
        move = utils.number_emojis.index(emoji) + 1
        embed = msg.embeds[0]
        moves = []
        # footer contains both users' id's and a record of moves
        moves = [int(i) for i in embed.footer.text.split(
            '\n')[0][7:]]
        if moves.count(move) >= 6:
            return
        ftr2 = embed.footer.text.split('\n')[1][9:]
        if len(ftr2) < 32:
            return
        user1 = msg.guild.get_member(int(ftr2[:18]))
        user2 = msg.guild.get_member(int(ftr2[18:]))
        token = embed.description.split('\n')[0].split(': ')[-1]
        tks = embed.title.replace('!', '').split(' vs ')
        token1 = tks[0][-1]
        token2 = tks[1][-1]
        if (user1 is None or user2 is None or
                token == token1 and str(user1.id) != user_id or
                token == token2 and str(user2.id) != user_id):
            return
        moves.append(move)
        grid = msg.embeds[0].description.split('\n')[2:][:-1]
        grid = [self.split_line(i) for i in grid]
        grid, completed, turn = self.play(moves, token1, token2, grid)
        await msg.remove_reaction(
            emoji=emoji, member=user1 if turn == 0 else user2)
        user1 = (user1.id, user1.name if not user1.nick else user1.nick)
        user2 = (user2.id, user2.name if not user2.nick else user2.nick)
        embed_var = None
        if completed:
            embed_var = self.completed_embed(
                msg, user1, user2, token1, token2,
                moves, grid, turn, False, color=embed.color)
        else:
            if len(moves) == 42:
                embed_var = self.completed_embed(
                    msg, user1, user2, token1, token2,
                    moves, grid, turn,
                    True, color=embed.color)
            else:
                embed_var = self.build_embed(
                    user1, user2, token1, token2,
                    moves, grid, turn, color=embed.color)
        await msg.edit(
            embed=embed_var)

    def split_line(self, line):
        return (line.replace('\u2000', ''
                             ).replace('\u3000', '')).split()

    def completed_embed(
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
            color):
        users = (user1, user2) if on_move == 0 else (user2, user1)
        embed_var = utils.EmbedWrapper(discord.Embed(
            title='{} wins against {} with {}!'.format(
                users[0][1], users[1][1], token1 if on_move == 0 else token2),
            description='Game completed\n\n{}'.format(self.grid_text(grid)),
            color=color),
            embed_type=self.embed_type,
            marks=utils.EmbedWrapper.ENDED)
        if draw:
            embed_var.title = '{} draws against {}!'.format(user1[1], user2[1])
            moves.append(0)
        else:
            embed_var.set_footer(text='{} total wins: {}'.format(
                users[0][1], self.wins_to_database(users[0][0], msg.guild.id)))
        self.moves_to_database(''.join([str(i) for i in moves]))
        return embed_var

    def build_embed(
            self,
            user1,
            user2,
            token1,
            token2,
            moves,
            grid,
            on_move,
            color=utils.random_color()):
        embed_var = utils.EmbedWrapper(discord.Embed(
            title='{} {} vs {} {}!'.format(
                user1[1], token1, user2[1], token2),
            description='On turn: {}\n\n{}'.format(
                token1 if on_move == 1 else token2, self.grid_text(grid)),
            color=color),
            embed_type=self.embed_type,
            marks=[utils.EmbedWrapper.FIXED, utils.EmbedWrapper.NOT_DELETABLE])
        embed_var.set_footer(text='Moves: {}\nGame_id: {}{}'.format(
            ''.join([str(i) for i in moves]), user1[0], user2[0]))
        return embed_var

    def join_line(self, line):
        separator = ' '
        return str(2*'\u3000') + separator.join(line)

    def grid_text(self, grid):
        txt = '\n'.join([self.join_line(i) for i in grid])
        txt += '\n' + 2*'\u3000' + ' '.join(utils.number_emojis)
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

    def wins_to_database(self, user_id, guild_id):
        # add a players win to database
        if self.bot.database.connected is False:
            return ''
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute((
            "SELECT * FROM four_in_line WHERE guild_id = '{}' AND" +
            " user_id = '{}'").format(guild_id, user_id))
        fetched = cursor.fetchone()
        count = 1
        if fetched is None:
            cursor.execute(
                ("INSERT INTO four_in_line (guild_id, user_id, " +
                 "wins) VALUES ('{}', '{}', 1)").format(
                    guild_id, user_id))
        else:
            count = fetched[2] + 1
            cursor.execute(
                ("UPDATE four_in_line SET wins = {} WHERE " +
                 "guild_id = '{}' and user_id = '{}'").format(
                     count, guild_id, user_id))
        self.bot.database.cnx.commit()
        cursor.close()
        return count

    def moves_to_database(self, moves):
        if self.bot.database.connected is False:
            return
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute(
            ("INSERT INTO four_in_line_records (moves) VALUES ('{}')"
             ).format(moves))
        self.bot.database.cnx.commit()
        cursor.close()

    async def show_leaderboard(self, msg):
        # show guild members that played fil in order
        # best to worst
        if self.bot.database.connected is False:
            await msg.channel.send(
                text='No database connection.',
                delete_after=5)
            return
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute(
            "SELECT * FROM four_in_line WHERE guild_id = '{}'"
            .format(msg.guild.id))
        fetched = cursor.fetchall()
        if fetched is []:
            await msg.channel.send(
                text='No availible leaderboard.',
                delete_after=5)
            return
        embed_var = utils.EmbedWrapper(discord.Embed(
            title='Leaderboard',
            color=utils.random_color()),
            embed_type=self.embed_type,
            marks=utils.EmbedWrapper.INFO)
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
        await msg.channel.send(embed=embed_var, reactions=utils.waste_basket)

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Start the game with "{}cf".'.format(prefix),
            'You and another user then react with preffered token.',
            'Play the game by reacting with numbers from 1 to 7.',
            'A record of moves and wins will be kept.',
            'See leaderboard with "{}cf leaderboard".'.format(prefix))

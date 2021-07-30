import discord
from collections import defaultdict
import utils
from commands.help import Help


class ConnectFour(Help):
    def __init__(self):
        super().__init__(name='cf')
        self.description = 'A game of 4 in a line between two users.'
        self.tokens = [utils.emojis[1], utils.emojis[2]]

    async def execute_command(self, msg):
        # send a message and await second user to join with thumbs up reaction
        # if first word is lb or leaderboard show players with most wins
        args = msg.content.split()
        if len(args) > 1 and args[1] in ['lb', 'leaderboard']:
            await self.show_leaderboard(msg)
            return
        name = msg.author.name if not msg.author.nick else msg.author.nick
        embed_var = utils.EmbedWrapper(discord.Embed(
            description=('{} has challanged for a game of 4 in a line.\n' +
                         'React with {} to join!').format(
                             name, utils.thumbs_up),
            color=utils.random_color()),
            embed_type='CONNECT_FOUR',
            marks=utils.mk.NOT_DELETABLE)
        embed_var.set_footer(text=msg.author.id)
        await msg.channel.send(embed=embed_var, reactions=utils.thumbs_up)

    async def on_raw_reaction(self, msg, payload):
        # on added emoji if thumbs up join second user else if both users are
        # known start the game and await emoji number from 1 to 7, each
        # indicating a column in which the user drops a token
        if (payload.event_type != 'REACTION_ADD' or
                not msg.is_connect_four()):
            return
        if len(msg.embeds[0].footer.text) == 18:
            # don't allow a user playing with himself
            if msg.embeds[0].footer.text == str(payload.user_id):
                return
            starting_name = msg.embeds[0].description.split(
                ' has challanged for a game of 4 in a line.')[0]
            if payload.emoji.name == utils.thumbs_up:
                await self.start_game(msg, payload.user_id, starting_name)
            return
        if payload.emoji.name in utils.number_emojis:
            await self.play_game(
                msg, str(payload.user_id), payload.emoji.name)

    async def start_game(self, msg, user_id, name):
        # create an empty grid and wait for players to start playing
        user = msg.guild.get_member(int(user_id))
        if user is None:
            return
        info = {
            'user0': {
                'id': msg.embeds[0].footer.text,
                'name': name},
            'user1': {
                'id': str(user_id),
                'name': user.name if not user.nick else user.nick}
        }
        info['title'] = self.title_text(info, 0)
        info['header'] = self.next_on_turn_text(info, 0)
        info['footer'] = '{}{}'.format(
            msg.embeds[0].footer.text, str(user_id))
        grid_text = self.update_grid()
        if grid_text is None:
            return
        info['grid_text'] = grid_text[0]
        embed_var = self.build_embed(info)
        await msg.remove_reaction(
            emoji=utils.thumbs_up)
        await msg.edit(
            embed=embed_var,
            reactions=[utils.number_emojis[i] for i in range(7)])

    async def play_game(self, msg, user_id, emoji):
        # gather info from message and add token into the grid
        # save a record of moves in the message
        move = utils.number_emojis.index(emoji) + 1
        embed = msg.embeds[0]
        info = {}
        info['moves'] = ''
        # footer contains both users' id's and a record of moves
        if len(embed.footer.text) > 36:
            info['moves'] = embed.footer.text.split(
                '\n')[1][7:] + str(move)
        else:
            info['moves'] = str(move)
        self.users_info(
            [embed.footer.text[:18], embed.footer.text[:36][18:]],
            msg.guild, info)
        # description contains x vs x! text, who is on the move and
        # the grid
        desc_lines = embed.description.split('\n')
        token = desc_lines[0].split()[-1][1:][:-1]
        for i in range(2):
            if token == self.tokens[i] and str(user_id) != info[
                    'user' + str(i)]['id']:
                return
        # insert a new token into the grid and update the grid text
        game = self.update_grid(move, token, desc_lines[2:][:-1])
        if not game:
            return
        info['grid_text'] = game[0]
        # if winner, end the game and send wins and a record of moves to
        # database
        if game[1] is not None:
            info['header'], info['title'] = self.winner_text(game[1], info)
            info['footer'] = ''
            if game[1] in [0, 1]:
                info['footer'] = await self.wins_to_database(
                    msg, info['user'+str(game[1])]['id'],
                    info['user'+str(game[1])]['name'], msg.guild.id)
            await self.moves_to_database(info['moves'])
        else:
            info['header'] = self.next_on_turn_text(
                info, (self.tokens.index(token) + 1) % 2)
            info['title'] = self.title_text(
                info, (self.tokens.index(token) + 1) % 2)
            info['footer'] = '{}{}\nMoves: {}'.format(
                info['user0']['id'], info['user1']['id'], info['moves'])
        embed_var = self.build_embed(info, msg.embeds[0].color)
        if game[1] is not None:
            embed_var.mark(embed_var.ENDED)
        await msg.edit(embed=embed_var)
        # if has permissions, remove players' utils.emojis for convenience
        await msg.remove_reaction(
            emoji=emoji, member=msg.guild.get_member(int(user_id)))

    def new_grid(self):
        # build a new empty grid for the game to be played on
        return [['\u2000 \u2000' for _ in range(7)] for _ in range(6)]

    def insert_token(self, move, token, grid):
        # insert a new token into the grid
        for i in range(len(grid) - 1, -1, -1):
            if not any(t in grid[i][move - 1] for t in self.tokens):
                grid[i][move-1] = token
                return (grid, True)
                break
        return (grid, False)

    def update_grid(self, move=None, token=None, grid=None):
        # if grid is None build a new grid
        # if move is not None, insert a new token to the index
        # of the move
        if move is not None:
            x = self.insert_token(
                move=move,
                token=token,
                grid=[(i[5:][:-3].split('.')) for i in grid])
            if x[1] is False:
                return False
            grid = x[0]
        else:
            grid = self.new_grid()
        # join the grid back into a text to be send to the channel
        grid_text = '\n'.join([('{}.{}.\u2000{}'.format(
            4*'\u2000', '.'.join(grid[i]), str(i + 1))
        ) for i in range(len(grid))])
        numbers = [str(i + 1) for i in range(len(grid[0]))]
        grid_text += '\n{}{}\u2000'.format(
            5*'\u2000', (2*'\u2000').join(numbers))
        # check for winner every time a new token is inserted
        return (grid_text,
                None if token is None else self.check_for_winner(grid))

    def check_for_pattern(self, pattern):
        # check if there is a winning combinatino in a
        # row, column or a diagonal
        for i in range(len(self.tokens)):
            if (4 * self.tokens[i]) in pattern:
                return i

    def check_for_winner(self, grid):
        diagonals = defaultdict(list)
        draw = True
        for col in range(len(grid[0])):
            # check the column
            cl = self.check_for_pattern(''.join([row[col] for row in grid]))
            if cl is not None:
                return cl
            # check the row
            if col < len(grid):
                ln = self.check_for_pattern(''.join(grid[col]))
                if ln is not None:
                    return ln
            if ln is not None:
                return ln
            # save diagonals into a defaultdict
            for row in range(len(grid)):
                # if all slots in the grid are filled up, => draw = True
                if draw is True and grid[row][col] not in self.tokens:
                    draw = False
                # ignore diagonals smaller than 4 (can't have 4 tokens in such
                # diagonals)
                if 9 > row - col + len(grid) > 2:
                    diagonals[row - col + len(grid)].append(grid[row][col])
                if 9 > row + col > 2:
                    diagonals[-(row + col)].append(grid[row][col])
        # 0 ->  first user wins, 1 -> second user wins, 2 -> draw
        if draw is True:
            return 2
        # check the diagonals for a winning combination
        for i in diagonals.values():
            x = self.check_for_pattern(''.join(i))
            if x is not None:
                return x

    def users_info(self, user_ids, guild, info):
        # fetch users from their id's and save them to info dict
        for i in range(len(user_ids)):
            user = guild.get_member(int(user_ids[i]))
            name = None
            if user is not None:
                name = user.name if not user.nick else user.nick
            info['user' + str(i)] = {
                'id': user_ids[i],
                'name': name}

    def winner_text(self, idx, info):
        # text displayed in header of description
        # at the end of the game
        if idx == 2:
            return ('Game completed', '{} draws {}!'.format(
                info['user1']['name'],
                info['user0']['name']))
        return ('Game completed', '{} wins against {} with {}!'.format(
            info['user'+str(idx)]['name'],
            info['user'+str((idx + 1) % 2)]['name'],
            self.tokens[idx]))

    def title_text(self, info, idx):
        return '{} vs {}'.format(
            info['user0']['name'],
            info['user1']['name'])

    def next_on_turn_text(self, info, idx):
        # header displayed in description during the
        # game
        return 'On turn: {} ({})'.format(
            info['user'+str(idx)]['name'],
            self.tokens[idx])

    def build_embed(self, info, color=utils.random_color()):
        # build embed from the info dict
        # header and grid in the description, id's and move records in
        # the footer
        embed_var = utils.EmbedWrapper(
            discord.Embed(title=info['title'], color=color),
            embed_type='CONNECT_FOUR',
            marks=utils.mk.NOT_DELETABLE)
        if info['footer'] is not None:
            embed_var.set_footer(text=info['footer'])
            embed_var.description = '{}\n\n{}'.format(
                info['header'], info['grid_text'])
        return embed_var

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
        embed_var = discord.Embed(
            title='4 in a line Leaderboard',
            color=utils.random_color())
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

    async def wins_to_database(self, msg, user_id, user_name, guild_id):
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
        return'{} total wins: {}'.format(
            user_name, count)

    async def moves_to_database(self, moves):
        if self.bot.database.connected is False:
            return
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute(
            ("INSERT INTO four_in_line_records (moves) VALUES ('{}')"
             ).format(moves))
        self.bot.database.cnx.commit()
        cursor.close()

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}'.format(
            ('Start the game with "{}fil", then wait ' +
             'for another player to join by reacting with thumbs up.').format(
                 prefix),
            ('Play in turns by reacting to the number of the column, ' +
             'where you want to drop your token.'),
            ('First user with 4 tokens together in a line, column or a ' +
             'diagonal wins.'),
            'A record of wins will be kept.',
            'See leaderboard with "{}fil leaderboard"'.format(prefix))

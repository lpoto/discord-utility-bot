import discord
from random import randint
from datetime import datetime, timedelta
from utils.misc import squares, circles, random_color, number_emojis
from utils.wrappers import EmbedWrapper
import utils.decorators as decorators
from commands.help import Help

# TODO
# 1. A player should be able to forfeit
# 2. When a user wins, other users are allowed to continue the game
# 3. When all players ready, wait 5 seconds before starting
# 4. Notify when 6 has been thrown twice in a row


class Ludo(Help):
    def __init__(self):
        super().__init__(name='ludo')
        self.description = 'A strategy game for 2 to 4 players.'
        self.synonyms = ['ld']
        self.embed_type = 'LUDO'
        self.dice_emoji = '🎲'
        self.background = [squares['white'], squares['black']]
        self.colors = ['red', 'blue', 'orange', 'green']
        self.alternatives = [number_emojis[i] for i in range(4)]
        self.colored_background = [squares[i] for i in self.colors]
        self.all_background = self.background + self.colored_background
        self.tokens = [circles[i] for i in self.colors]
        self.starting_fields = {
            self.colors[i]: k for i, k in enumerate(
                [(5, 1), (1, 7), (7, 11), (11, 5)])}
        self.paths = {
            k: self.path(*self.starting_fields[k]) for k in self.colors}
        self.next_on_turn = {k: self.colors[(i + 1) % 4] for i, k in enumerate(
            self.colors)}

    @decorators.ExecuteCommand
    async def send_game_menu(self, msg):
        # if ludo is called via command in the chat,
        # send a game menu from which you can start the rps game
        await self.bot.special_methods['ExecuteCommand']['games'][0](
            msg, False)

    @decorators.ExecuteWithInteraction
    async def collect_tokens_to_start_the_game(self, msg, user, webhook):
        # build an empty grid and auto add the user
        # who started the game, he can change his tokens by selecting
        # a different button, or leave by clicking on "leave"
        s_g = self.grid
        s_g = self.user_to_grid(s_g, self.colors[0])
        name = user.name if not user.nick else user.nick
        embed = EmbedWrapper(discord.Embed(
            title=('Waiting for players...\n\n' +
                   'Current players:\n{} {} (not ready)'.format(
                       self.tokens[0], name)),
            description='\n'.join([''.join(i) for i in s_g]),
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE,
            info='* Select your token to join.')
        components = [discord.ui.Button(emoji=i) for i in self.tokens]
        components.append(discord.ui.Button(label='ready', row=2))
        components.append(discord.ui.Button(
            label='leave', style=discord.ButtonStyle.blurple, row=2))
        m = await msg.channel.send(embed=embed, components=components)
        await self.bot.database.use_database(
            self.user_to_database, m, user.id,
            '0;0:-1,5;1:-2,5;2:-3,5;3:-4,5;d:-1')
        await self.bot.database.use_database(
            self.new_ludo_to_database, m)

    @decorators.OnButtonClick
    async def determine_game_state(self, button, msg, user, webhook):
        if not msg.is_ludo:
            return
        info = await self.get_info(msg)
        if info is None:
            return
        if msg.embeds[0].title.startswith('Waiting for players...'):
            if button.label == 'ready':
                for i in info.values():
                    if str(i['id']) == str(user.id):
                        await self.ready_player(msg, user, i['token'])
                return
            await self.add_users_to_ludo(button, msg, user)
            return
        if not msg.embeds[0].title.startswith('On turn:'):
            return
        embed = msg.embeds[0]
        on_turn_token = embed.title.split('turn: ')[1].split()[0]
        on_turn_color = self.colors[self.tokens.index(on_turn_token)]
        for i in info.values():
            if (str(user.id) == str(i['id']) and
                    on_turn_color != i['color']):
                return
        on_turn = info[on_turn_color]
        if button.emoji and button.emoji.name == self.dice_emoji:
            dice = randint(1, 6)
            # edit the game embed based on the thrown dice
            await self.play_game(msg, button, user, info, on_turn, dice)
            return
        dice = int(embed.title.split('threw ')[1].split('!')[0].replace(
            ' again', '', 1))
        if button.label and button.label == 'Pop from base':
            await self.selected_choice(button.label, msg, info, on_turn, dice)
        elif button.emoji and button.emoji.name in self.alternatives:
            await self.selected_choice(
                button.emoji.name, msg, info, on_turn, dice)

    # ------------------------------------------------------- GATHERING PLAYERS

    async def add_users_to_ludo(self, button, msg, user):
        u = await self.bot.database.use_database(
            self.fetch_game_from_database, msg)
        if u is None:
            return
        u_info = None
        for i in u:
            if i[3] == str(user.id):
                u_info = i
                break
        if button.label == 'leave':
            await self.user_leaves_the_grid(button, msg, user, u_info)
            return
        if u_info is None:
            await self.user_joins_the_grid(button, msg, user, u_info)
            return
        usrs = msg.embeds[0].title.split(
            'Current players:\n')[-1].split('\n')
        if any(i.startswith(button.emoji.name) for i in usrs):
            return
        g = [[i for i in k] for k in msg.embeds[0].description.split('\n')]
        inf = self.dict_from_database_info_string(u_info[4])
        g = self.user_from_grid(g, inf['color'])
        g = self.user_to_grid(
            g, self.colors[self.tokens.index(button.emoji.name)])
        for i, v in enumerate(usrs):
            if v.startswith(self.tokens[self.colors.index(inf['color'])]):
                usrs[i] = button.emoji.name + v[1:]
                break
        msg.embeds[0].title = (
            'Waiting for players... \n\nCurrent players:\n{}'
        ).format('\n'.join(usrs))
        msg.embeds[0].description = '\n'.join([''.join(i) for i in g])
        await msg.edit(embed=msg.embeds[0])
        await self.bot.database.use_database(
            self.user_to_database, msg, user.id,
            '{};0:-1,5;1:-2,5;2:-3,5;3:-4,5;d:-1'.format(self.tokens.index(
                button.emoji.name)))

    async def user_joins_the_grid(self, button, msg, user, u_info):
        usrs = None
        if msg.embeds[0].title == 'Waiting for players...':
            usrs = []
        else:
            usrs = msg.embeds[0].title.split(
                'Current players:\n')[-1].split('\n')
        if any(i.startswith(button.emoji.name) for i in usrs):
            return
        g = [[i for i in k] for k in msg.embeds[0].description.split('\n')]
        g = self.user_to_grid(
            g, self.colors[self.tokens.index(button.emoji.name)])
        usrs.append('{} {} (not ready)'.format(
            button.emoji.name, user.name if not user.nick else user.nick))
        msg.embeds[0].title = (
            'Waiting for players... \n\nCurrent players:\n{}'
        ).format('\n'.join(usrs))
        msg.embeds[0].description = '\n'.join([''.join(i) for i in g])
        await msg.edit(embed=msg.embeds[0])
        await self.bot.database.use_database(
            self.user_to_database, msg, user.id,
            '{};0:-1,5;1:-2,5;2:-3,5;3:-4,5;d:-1'.format(self.tokens.index(
                button.emoji.name)))

    async def user_leaves_the_grid(self, button, msg, user, u_info):
        if u_info is None:
            return
        usrs = msg.embeds[0].title.split(
            'Current players:\n')[-1].split('\n')
        g = [[i for i in k] for k in msg.embeds[0].description.split('\n')]
        inf = self.dict_from_database_info_string(u_info[4])
        clr = inf['color']
        g = self.user_from_grid(g, clr)
        msg.embeds[0].description = '\n'.join([''.join(i) for i in g])
        idx = None
        for i, v in enumerate(usrs):
            if v.startswith(self.tokens[self.colors.index(clr)]):
                idx = i
                break
        if idx is not None:
            del usrs[idx]
        if len(usrs) == 0:
            msg.embeds[0].title = 'Waiting for players...'
        else:
            msg.embeds[0].title = (
                'Waiting for players...\n\nCurrent players:\n{}'
            ).format('\n'.join(usrs))
        await msg.edit(embed=msg.embeds[0])
        await self.bot.database.use_database(
            self.delete_from_database, msg, user.id)

    def user_to_grid(self, g, color):
        for k in self.bases[color]:
            g[k[0]][k[1]] = self.tokens[self.colors.index(color)]
        return g

    def user_from_grid(self, g, color):
        for k in self.bases[color]:
            g[k[0]][k[1]] = self.background[1]
        return g

    async def ready_player(self, msg, user, token):
        embed = msg.embeds[0]
        users = embed.title.split('Current players:\n')[1].split('\n')
        ready = True
        for i, v in enumerate(users):
            if v.startswith(token):
                if v[::-1].startswith('(not ready)'[::-1]):
                    users[i] = (v[::-1].replace(
                        '(not ready)'[::-1], '(ready)'[::-1], 1))[::-1]
                elif v[::-1].startswith('(ready)'[::-1]):
                    users[i] = (v[::-1].replace(
                        '(ready)'[::-1], '(not ready)'[::-1], 1))[::-1]
                    ready = False
            elif ready is True:
                if v[::-1].startswith('(not ready)'[::-1]):
                    ready = False
        if ready is True and len(users) > 1:
            await self.start_the_game(msg)
            return
        embed.title = 'Waiting for players...\n\nCurrent players:\n{}'.format(
            '\n'.join(users))
        await msg.edit(embed=embed)

    # --------------------------------------------------------------- GAMEPLAY

    async def start_the_game(self, msg):
        # when all the users are gathered, start
        # the game and randomly select who starts
        info = await self.get_info(msg)
        if info is None:
            return
        embed = msg.embeds[0]
        embed.set_info(' vs '.join([i['name'] for i in info.values()]))
        rand_int = randint(0, len(info)-1)
        on_turn = info[list(info.keys())[rand_int]]
        embed.title = 'On turn: {} {}'.format(
            self.tokens[self.colors.index(on_turn['color'])], on_turn['name'])
        components = discord.ui.Button(emoji=self.dice_emoji)
        await msg.edit(embed=embed, components=components)

    async def play_game(self, msg, button, user, info, on_turn, dice):
        # select the next user (clockwise)
        # if dice is 6, the user can throw again
        clr = on_turn['color']
        next_color = self.next_on_turn[clr]
        while all(i['color'] != next_color for i in info.values()):
            next_color = self.next_on_turn[next_color]
        on_turn['next'] = info[next_color]
        embed = msg.embeds[0]
        g = [[k for k in i] for i in embed.description.split('\n')]
        # filter unmovable tokens from all of the users tokens
        # unmovable are those that are still in base or at
        # the end of the path or
        # moving forward would move them beyon the end, or they
        # have one of their tokens on their next spot
        indexes = [
            i for i in range(4) if (
                on_turn[i] not in self.bases[clr] and
                on_turn[i] not in self.paths[clr][-dice:] and self.next_token(
                    g, clr, on_turn[i], dice
                ) != on_turn['token'])]
        free_tokens = [on_turn[i] for i in indexes]
        if dice == 6 and len(free_tokens) == 0:
            # if all of the user's tokens are in the base
            # or unable to move and
            # he throws 6, automatically pop one of the tokens into the game
            if any(on_turn[i] in self.bases[clr] for i in range(4)):
                c = 0
                for i in range(4):
                    if on_turn[i] in self.bases[clr]:
                        c = i
                        break
                embed = await self.update_tokens(
                    msg, info, on_turn, c, dice)
        elif len(free_tokens) == 1 and (
                dice < 6 or
                (dice == 6 and
                    (free_tokens[0] == self.starting_fields[clr] or
                     all(on_turn[i] not in self.bases[clr
                                                      ] for i in range(4))))):
            # if there is only one token that can move and
            # user did not throw 6,  or the user threw 6 and the only
            # free token is at the starting spot or no tokens are in base,
            # automatically move that token
            # forward
            embed = await self.update_tokens(
                msg, info, on_turn, indexes[0], dice)
        elif len(free_tokens) >= 1:
            # if there are multiple free tokens, allow the user to make
            # a choice
            await self.choice(
                msg, free_tokens, dice, on_turn)
            return
        if embed is None:
            return
        if all(on_turn[i] in self.bases[on_turn['color'
                                                ]] for i in range(4)):
            x = embed.title.split('\n\n')
            if len(x) < 2:
                embed.title += '\n\n{} threw {}!'.format(on_turn['name'], dice)
            else:
                x = x[1].split('\n')
            if len(x) < 2:
                embed.title = '\n\n'.join(
                    [embed.title.split('\n\n')[0],
                     '\n'.join([
                         '{} threw {}'.format(on_turn['name'], dice),
                         '2 attempts left'])])
            elif x[1] == '2 attempts left':
                embed.title = '\n\n'.join(
                    [embed.title.split('\n\n')[0],
                     '\n'.join([
                         '{} threw {}'.format(on_turn['name'], dice),
                         '1 attempt left'])])
                await msg.edit(embed=embed)
                return
                embed = self.title_embed(msg, on_turn, dice, embed, False)
            elif x[1] == '1 attempt left':
                embed = self.title_embed(msg, on_turn, dice, embed)
        else:
            embed = self.title_embed(msg, on_turn, dice, embed)
        await msg.edit(embed=embed)

    async def choice(self, msg, free_tokens, dice, on_turn):
        embed = msg.embeds[0]
        g = [[k for k in i] for i in embed.description.split('\n')]
        components = []
        # filter out which tokens are movable
        # (those that are not in base and are not at the end of the path
        # and dont have one of their own tokens on
        # the spot that they should move to)
        replaced_indexes = []
        for i, v in enumerate(free_tokens):
            if v in self.paths[on_turn['color']][-dice:]:
                continue
            x = self.next_token(g, on_turn['color'], v, dice)
            if x == on_turn['token'] or x in self.alternatives:
                continue
            # switch movable tokens with alternative tokens, so user
            # can separate them
            g[v[0]][v[1]] = self.alternatives[i]
            components.append(discord.ui.Button(emoji=g[v[0]][v[1]]))
            replaced_indexes.append(i)
        # if dice is 6 and user has at least one token in base and there
        # are none of his tokens on his starting spot
        # allow user to pop out one of the tokens from the base
        if (dice == 6 and any(
                on_turn[i] in self.bases[on_turn['color']] for i in range(4))
                and all(on_turn[i] != self.starting_fields[
                    on_turn['color']] for i in range(4))):
            components.append(discord.ui.Button(
                label='Pop from base'))
        if len(components) == 0:
            components.append(discord.ui.Button(emoji=self.dice_emoji))
        embed.description = '\n'.join([''.join(i) for i in g])
        embed = self.title_embed(msg, on_turn, dice, embed, n=False)
        await msg.edit(embed=embed, components=components)
        s = on_turn['original_string']
        txt = s[::-1].replace(s.split('d:')[-1][::-1], '', 1)[::-1]
        txt += ''.join([str(i) for i in replaced_indexes])
        await self.bot.database.use_database(
            self.user_to_database, msg, on_turn['id'], txt)

    async def selected_choice(self, selected, msg, info, on_turn, dice):
        embed = msg.embeds[0]
        # change alternative tokens back to the user's token
        # save the index of the token that the user wants to move
        for e in self.alternatives:
            embed.description = embed.description.replace(
                e, on_turn['token'], 1)
        if selected == 'Pop from base':
            for i in range(4):
                if on_turn[i] in self.bases[on_turn['color']]:
                    embed = await self.update_tokens(
                        msg, info, on_turn, i, embed=embed, dice=dice)
                    break
        else:
            idx = self.alternatives.index(selected)
            replaced = [int(i) for i in on_turn['replaced']]
            embed = await self.update_tokens(
                msg, info, on_turn, replaced[idx], embed=embed, dice=dice)
        if embed is None:
            return
        # get the next user based on color (clockwise)
        next_color = self.next_on_turn[on_turn['color']]
        while all(i['color'] != next_color for i in info.values()):
            next_color = self.next_on_turn[next_color]
        on_turn['next'] = info[next_color]
        embed = self.title_embed(msg, on_turn, dice, embed)
        components = [discord.ui.Button(emoji=self.dice_emoji)]
        await msg.edit(embed=embed, components=components)

    def title_embed(self, msg, on_turn, dice, embed=None, n=True):
        embed = embed if embed is not None else msg.embeds[0]
        y = embed.title.split('\n\n')
        if n is False:
            embed.title = y[0] + '\n\n{} threw {}!'.format(
                on_turn['name'], dice)
            return embed
        if dice < 6:
            embed.title = 'On turn: {} {}\n\n{} threw {}!'.format(
                on_turn['next']['token'],
                on_turn['next']['name'],
                on_turn['name'], dice)
        if dice == 6:
            embed.title = 'On turn: {} {}\n\n{} threw {}!'.format(
                on_turn['token'], on_turn['name'],
                on_turn['name'], dice)
        return embed

    async def update_tokens(
            self, msg, info, on_turn, token, dice, eat=False, embed=None):
        # move the token to the next_spot
        # if it has been eaten, it's next spot is back in it's base
        # if the token is still in the base, move it to its starting point
        embed = embed if embed is not None else msg.embeds[0]
        next_spot = None
        idx = 0
        if eat is True:
            next_spot = self.bases[on_turn['color']][token]
        elif on_turn[token] not in self.bases[on_turn['color']]:
            idx = self.paths[on_turn['color']].index(on_turn[token]) + dice
            if idx >= len(self.paths[on_turn['color']]):
                return embed
            next_spot = self.paths[on_turn['color']][idx]
        else:
            next_spot = self.starting_fields[on_turn['color']]
        # remember on what field the token stood, so we can switch it back
        # when the token moves again
        g = [[i for i in k] for k in embed.description.split('\n')]
        g[on_turn[token][0]][on_turn[token][1]] = on_turn[
            str(token) + '_prev']
        next_grid_field = g[next_spot[0]][next_spot[1]]
        # if there is a token on the next field, move to it's spot and
        # send it back to its base
        if next_grid_field in self.tokens:
            opponent_color = self.colors[self.tokens.index(next_grid_field)]
            # don't eat yourself
            if opponent_color == on_turn['color']:
                return embed
            # find out which of the opponent's four tokens
            # is on your next field
            for i in range(4):
                if info[opponent_color][i] == next_spot:
                    # first send the opponent's token back to the base
                    # then repeat this method on the new grid
                    e = await self.update_tokens(
                        msg, info, info[opponent_color], i, 0, True)
                    await msg.edit(embed=e)
                    return await self.update_tokens(
                        msg, info, on_turn, token, dice, False)
        if next_grid_field not in self.all_background:
            return embed
        g[next_spot[0]][next_spot[1]] = on_turn['token']
        on_turn[token] = next_spot
        on_turn[str(token) + '_prev'] = next_grid_field
        embed.description = '\n'.join([''.join(i) for i in g])
        # if the user has all 4 tokens at the end of the path
        # he wins
        if all(g[i[0]][i[1]] == on_turn['token'] for i in (
                self.paths[on_turn['color']][-4:])):
            embed.title = '{} ({}) wins!'.format(
                on_turn['name'], on_turn['token'])
            wins = await self.bot.database.use_database(
                self.wins_to_database, msg, on_turn['id'])
            if wins is not None:
                info = embed.get_info()
                embed.set_info(info + '\n\n{} total wins: {}'.format(
                    on_turn['name'], wins))
            embed.mark(EmbedWrapper.ENDED)
            await msg.edit(embed=embed, components=[])
            await self.bot.database.use_database(
                self.delete_from_database, msg)
            return
        # save the move to database
        path = self.paths[on_turn['color']]
        idx = None
        if on_turn[token] in self.bases[on_turn['color']]:
            idx = self.bases[on_turn['color']].index(on_turn[token])
        else:
            idx = path.index(on_turn[token])
        prev = on_turn[str(token) + '_prev']
        if prev in self.background:
            prev = 4 + self.background.index(prev)
        else:
            prev = self.colored_background.index(prev)
        txt = on_turn['original_string'].split(str(token) + ':')
        txt1 = txt[0] + str(token) + ':' + str(idx) + ','
        txt2 = txt[1].replace(txt[1].split(';')[0], '', 1)
        txt = txt1 + str(prev) + txt2
        await self.bot.database.use_database(
            self.user_to_database, msg, on_turn['id'], txt)
        return embed

    async def get_info(self, msg):
        game_info = await self.bot.database.use_database(
            self.fetch_game_from_database, msg)
        if game_info is None:
            return
        info = {}
        for i in game_info:
            inf = self.dict_from_database_info_string(i[4])
            user = msg.guild.get_member(int(i[3]))
            if not user:
                continue
            inf['name'] = user.name if not user.nick else user.nick
            inf['id'] = user.id
            info[inf['color']] = inf
        return info

    def next_token(self, g, color, token, dice):
        path = self.paths[color]
        idx = path.index(token) + dice
        if idx >= len(path):
            return None
        return g[path[idx][0]][path[idx][1]]

    # --------------------------------------------------------- DATABASE STUFF

    async def fetch_game_from_database(self, cursor, msg):
        cursor.execute((
            "SELECT * FROM messages WHERE type = 'ludo' " +
            "AND channel_id = '{}' AND message_id = '{}' " +
            "AND user_id != 'None'"
        ).format(msg.channel.id, msg.id))
        return cursor.fetchall()

    def dict_from_database_info_string(self, string):
        d = {'color': None, 'token': None, 0: None,
             '0_prev': None, 1: None, '1_prev': None,
             2: None, ' 2_prev': None, 3: None, '3_prev': None,
             'replaced': None, 'original_string': string}
        for i in string.split(';'):
            x = i.split(':')
            if len(x) == 1:
                d['color'] = self.colors[int(x[0])]
                d['token'] = self.tokens[self.colors.index(
                    d['color'])]
                continue
            elif x[0] == 'd':
                if x[1] != '-1':
                    d['replaced'] = [int(i) for i in x[1]]
                continue
            for n in range(4):
                if x[0] == str(n):
                    z = x[1].split(',')
                    if int(z[0]) < 0:
                        d[n] = self.bases[d['color']][(abs(int(z[0])) - 1)]
                    else:
                        d[n] = self.paths[d['color']][int(z[0])]
                    square = None
                    if int(z[1]) >= 4:
                        square = self.background[int(z[1]) - 4]
                    else:
                        square = self.colored_background[int(z[1])]
                    d['{}_prev'.format(n)] = square
                    break
        return d

    async def user_to_database(self, cursor, msg, user_id, info):
        cursor.execute((
            "SELECT * FROM messages WHERE type = 'ludo' " +
            "AND channel_id = '{}' AND message_id = '{}'" +
            " AND user_id = '{}'"
        ).format(msg.channel.id, msg.id, user_id))
        fetched = cursor.fetchone()
        if fetched is not None:
            cursor.execute((
                "UPDATE messages SET info = '{}' WHERE " +
                "channel_id = '{}' AND message_id = '{}' " +
                "AND user_id = '{}'"
            ).format(info, msg.channel.id, msg.id, user_id))
            return
        cursor.execute((
            "INSERT INTO messages " +
            "(type, channel_id, message_id, user_id, info) " +
            "VALUES ('ludo', '{}', '{}', '{}', '{}')"
        ).format(msg.channel.id, msg.id, user_id, info))

    async def delete_from_database(self, cursor, msg, user_id=None):
        if user_id is not None:
            cursor.execute((
                'DELETE FROM messages WHERE type = \'ludo\' AND ' +
                "channel_id = '{}' and message_id = '{}' and user_id = '{}'"
            ).format(msg.channel.id, msg.id, user_id))
        else:
            cursor.execute((
                'DELETE FROM messages WHERE type = \'ludo\' AND ' +
                "channel_id = '{}' and message_id = '{}'"
            ).format(msg.channel.id, msg.id))

    async def new_ludo_to_database(self, cursor, msg):
        time = await self.bot.database.get_deletion_time(msg, self.name)
        cur_time = (datetime.now() + timedelta(hours=time + 0.5)
                    ).strftime('%d:%m:%H')
        cursor.execute(
            ("INSERT INTO messages " +
             "(type, channel_id, message_id, user_id, info, deletion_time) " +
             "VALUES ('{}', '{}', '{}', '{}', '{}', '{}')").format(
                'ludo', msg.channel.id, msg.id, None, None, cur_time))
        await msg.delete(
            delay=time * 3600)

    async def wins_to_database(self, cursor, msg, user_id):
        # add a win for the user to the database and return total win count
        cursor.execute((
            "SELECT * FROM wins WHERE game = 'ludo' AND" +
            " guild_id = '{}' AND user_id = '{}'").format(
                msg.guild.id, user_id))
        fetched = cursor.fetchone()
        count = 1
        if fetched is None:
            cursor.execute(
                ("INSERT INTO wins (game, guild_id, user_id, " +
                 "wins) VALUES ('ludo', '{}', '{}', 1)").format(
                    msg.guild.id, user_id))
        else:
            count = fetched[3] + 1
            cursor.execute(
                ("UPDATE wins SET wins = {} WHERE game = 'ludo' AND " +
                 "guild_id = '{}' and user_id = '{}'").format(
                     count, msg.guild.id, user_id))
        return count

    # ------------------------------------------------- BUILDING GRID AND PATHS

    @ property
    def bases(self):
        return {
            self.colors[0]: [(1, 1), (1, 3), (3, 1), (3, 3)],
            self.colors[1]: [(1, 9), (1, 11), (3, 9), (3, 11)],
            self.colors[2]: [(9, 9), (9, 11), (11, 9), (11, 11)],
            self.colors[3]: [(9, 1), (9, 3), (11, 1), (11, 3)],
        }

    @ property
    def grid(self):
        g = []
        for y in range(13):
            g.append([self.field(y, x) for x in range(13)])
        return g

    def field(self, y, x):
        if (all(i in {1, 2, 3, 9, 10, 11} for i in {x, y}) or
                (y == 6 and x not in {0, 12, 6}) or
                (x == 6 and y not in {0, 12, 6})):
            return self.background[1]
        if (x < 5 and y < 5) or (x == 1 and y == 5):
            return self.colored_background[0]
        if (x > 7 and y < 5) or (x == 7 and y == 1):
            return self.colored_background[1]
        if (x > 7 and y > 7) or (x == 11 and y == 7):
            return self.colored_background[2]
        if (x < 5 and y > 7) or (x == 5 and y == 11):
            return self.colored_background[3]
        return self.background[0]

    def path(self, y, x):
        cur_coords = (y, x)
        path = [cur_coords]
        for i in range(13):
            d = self.next_direction(*cur_coords)
            k = 4 if i == 0 else 5
            if i in {2, 5, 8}:
                k = 2
            elif i == 11:
                k = 1
            for _ in range(k):
                cur_coords = self.next_coordinate(*cur_coords, d)
                path.append(cur_coords)
        return path

    def next_direction(self, y, x):
        if (y, x) in {(5, 1), (0, 5), (5, 7), (6, 0), (5, 0)}:
            return 0
        if (y, x) in {(5, 5), (12, 6), (12, 5), (11, 5), (7, 0)}:
            return 3
        if (y, x) in {(12, 7), (7, 12), (7, 5), (7, 11), (6, 12)}:
            return 2
        if (y, x) in {(0, 6), (7, 7), (5, 12), (1, 7), (0, 7)}:
            return 1

    def next_coordinate(self, y, x, d):
        d = d + 2 if d < 2 else -d
        x = x if (abs(d) % 3) == 0 else x + (abs(d) // d)
        y = y if (abs(d) % 2) == 0 else y + (abs(d) // d)
        return (y, x)

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Typing this command open a game menu.',
            'Clicking on this game in a game menu starts the game.',
            'Select your tokens and wait for other players to join.',
            'When all players (>= 2) are ready, game will be started.',
            'The first user to have all of his tokens at the end ' +
            'of his path wins.',
            'A record of wins is kept.')

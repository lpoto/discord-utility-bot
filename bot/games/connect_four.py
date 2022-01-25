import nextcord

import bot.utils as utils
import bot.decorators as decorators


class ConnectFour:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['orange']
        self.description = 'A connection game between two players.'
        self.empty_grid_element = '⚫'
        self.tokens = tuple(('🔴', '🔵', '🟠', '🟢', '🟡', '🟤', '🟣'))
        self.tokens_set = set(self.tokens)
        self.numbers = tuple(('1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'))
        self.numbers_set = set(self.numbers)
        self.default_deletion_time = 24
        self.delete_button_author_check = True

    def is_cf(self, msg, data=None, init=False) -> bool:
        """
        Determine whether an interaction message is a valid
        connect four game.
        """
        if (len(msg.embeds) != 1):
            return False
        # if "init", we are checking Games menu, else rps message
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        type = embed.get_type()
        return type and (
            (init and type == 'Games') or (not init and (
                not data or 'values' in data and
                data['values'][0] == self.__class__.__name__)
            )
        )

    @decorators.MenuSelect
    async def start_the_game(self, msg, user, data, webhook):
        """
        Start a game of connect four, selected from the games menu.
        Add the user to the game with first token, save  the game
        to the database.
        """

        if not self.is_cf(msg=msg, data=data, init=True):
            return

        # reset games menu selected dropdown option
        await utils.reset_message_view(msg)

        self.client.logger.debug(
            msg=f'ConnectFour user: {str(user.id)}, token: {self.tokens[0]}'
        )

        # build view (buttons) with connect four tokens
        components = [nextcord.ui.Button(emoji=i) for i in self.tokens]
        components[0].style = nextcord.ButtonStyle.green
        components.append(utils.delete_button())

        view = utils.build_view(components)
        if view is None:
            return

        # create initial embed sent to the user as an ephemeral message
        embed = utils.UtilityEmbed(
            version=self.client.version,
            color=self.color,
            type=self.__class__.__name__,
            description='{}\n{}\n\n{} {}'.format(
                'Select a token to join or change the already selected token!',
                'Click on the selected token to leave the game.',
                user.name if not user.nick else user.nick,
                components[0].emoji.name
            )
        )
        m = await msg.channel.send(embed=embed, view=view)

        # set up deletion time from config or default if not set up
        deletion_time = await self.client.database.Config.get_option(
            name=self.__class__.__name__ + '_deletion',
            guild_id=m.guild.id
        )
        if not deletion_time or len(deletion_time.get('info')) == 0:
            deletion_time = self.default_deletion_time * 3600
        elif deletion_time:
            deletion_time = int(deletion_time.get('info')[0]) * 3600
        deletion_timestamp = utils.delta_seconds_timestamp(deletion_time)

        # save to database
        await self.client.database.Messages.add_message(
            id=m.id,
            channel_id=m.channel.id,
            type=self.__class__.__name__,
            author_id=user.id,
            info=[
                {
                    'name': 'cf_choice',
                    'info': self.tokens[0],
                    'user_id': user.id
                },
                {
                    'name': 'deletion_time',
                    'info': deletion_timestamp
                }
            ]
        )

    @decorators.ButtonClick
    async def token_selection(self, msg, user, button, webhook):
        if (
                not self.is_cf(msg) or
                not button.emoji or
                button.emoji.name not in self.tokens_set
        ):
            return
        msg_info = await self.client.database.Messages.get_message(
            id=msg.id,
            info=True
        )
        user_info = [
            i for i in msg_info.get('info')
            if str(i.get('name')) == 'cf_choice'
        ]

        # game can have only 2 players
        if (len(user_info) == 2 and all(
            str(i.get('user_id')) != str(user.id) for i in user_info
        )):
            return

        # if user already has selected token update his token or remove it
        # else add another user to the game
        x = list(filter(
            lambda i: str(i.get('user_id')) == str(user.id),
            msg_info['info']
        ))
        if len(x) == 1:
            idx = msg_info['info'].index(x[0])
            if str(x[0].get('info')) == str(button.emoji.name):
                msg_info['info'].remove(x[0])
                msg.embeds[0].title = ''
            else:
                if any(
                    str(i.get('info')) == str(button.emoji.name)
                    for i in msg_info['info']
                ):
                    # if that token already selected
                    return
                msg_info['info'][idx]['info'] = button.emoji.name
        else:
            if any(
                str(i.get('info')) == str(button.emoji.name)
                for i in msg_info['info']
            ):
                # if that token already selected
                return
            msg_info['info'].append(
                {
                    'name': 'cf_choice',
                    'info': button.emoji.name,
                    'user_id': user.id}
            )

        # rebuild the new buttons
        components = []
        for i in self.tokens:
            button = nextcord.ui.Button(emoji=i)
            if any(
                    str(j.get('info')) == str(i) for j in msg_info.get('info')
            ):
                button.style = nextcord.ButtonStyle.green
            components.append(button)

        await self.client.database.Messages.delete_message(msg.id)
        await self.client.database.Messages.add_message(
            id=msg.id,
            channel_id=msg.channel.id,
            type=self.__class__.__name__,
            info=msg_info.get('info')
        )
        embed = msg.embeds[0]
        embed.description = '{}\n{}\n\n'.format(
            'Select a token to join or change the already selected token!',
            'Click on the selected token to leave the game.')
        for i in msg_info['info']:
            if str(i.get('name')) == 'cf_choice':
                u = msg.guild.get_member(int(i.get('user_id')))
                embed.description += '{} {}\n'.format(
                    u.name if not u.nick else u.nick,
                    i.get('info')
                )
        x = list(filter(
            lambda i: str(i.get('name')) == 'cf_choice',
            msg_info.get('info')
        ))
        author_id = None if len(x) == 0 else x[0].get('user_id')

        await self.client.database.Messages.update_message_author(
            id=msg.id,
            author_id=author_id
        )

        if len(x) == 2:
            embed.title = 'Click "start" button to start the game'
            components.append(
                nextcord.ui.Button(
                    label='Start', style=nextcord.ButtonStyle.blurple)
            )
        components.append(utils.delete_button())

        await msg.edit(embed=embed, view=utils.build_view(components))

    @decorators.ButtonClick
    async def start_game(self, msg, user, button, webhook):
        """
        send an embed with empty connect_four grid and wait
        for further interactions
        """
        if (
                not self.is_cf(msg) or
                not button.label or
                button.label != 'Start'
        ):
            return
        msg_info = await self.client.database.Messages.get_message(
            id=msg.id,
            info=True
        )
        if all(
                str(i.get('user_id')) != str(user.id)
                for i in msg_info.get('info')
        ):
            return
        user_info = [
            i for i in msg_info.get('info') if i.get('name') == 'cf_choice'
        ]
        if len(user_info) != 2:
            return
        # create an empty grid and wait for players to start playing
        user1 = msg.guild.get_member(int(user_info[0].get('user_id')))
        user2 = msg.guild.get_member(int(user_info[1].get('user_id')))
        if user1 is None or user2 is None:
            return
        user1 = (user1.id, user1.name if not user1.nick else user1.nick)
        user2 = (user2.id, user2.name if not user2.nick else user2.nick)
        token1 = user_info[0].get('info')
        token2 = user_info[1].get('info')
        grid = self.empty_grid
        embed_var = self.build_embed(
            msg.embeds[0], user1, user2, token1, token2, [], grid, 1)
        components = (
            [
                nextcord.ui.Button(
                    emoji=self.numbers[i], row=0 if i < 4 else 1
                ) for i in range(7)
            ] + [
                nextcord.ui.Button(
                    label='forfeit',
                    row=1,
                    style=nextcord.ButtonStyle.primary)
            ]
        )
        await msg.edit(
            embed=embed_var,
            view=utils.build_view(components)
        )

    @decorators.ButtonClick
    async def play_game(self, msg, user, button, webhook):
        """
        insert the token in to the selected column
        and check for winner or draw
        """
        if (
            not self.is_cf(msg) or
            (
                button.emoji and
                button.emoji.name not in self.numbers_set
            ) or
            (
                button.label and
                button.label != 'forfeit'
            )
        ):
            return
        msg_info = await self.client.database.Messages.get_message(
            id=msg.id,
            info=True
        )
        if all(
                str(i.get('user_id')) != str(user.id)
                for i in msg_info.get('info')
        ):
            return
        user_info = [
            i for i in msg_info.get('info') if i.get('name') == 'cf_choice'
        ]
        user1 = msg.guild.get_member(int(user_info[0].get('user_id')))
        user2 = msg.guild.get_member(int(user_info[1].get('user_id')))
        embed = msg.embeds[0]
        token = embed.description.split('\n')[0].split(': ')[-1]
        token1 = user_info[0].get('info')
        token2 = user_info[1].get('info')
        if (user1 is None or user2 is None or
                token == token1 and str(user1.id) != str(user.id) or
                token == token2 and str(user2.id) != str(user.id)):
            return
        user1 = (user1.id, user1.name if not user1.nick else user1.nick)
        user2 = (user2.id, user2.name if not user2.nick else user2.nick)
        move = 0
        if button.emoji and button.emoji.name in self.numbers_set:
            move = self.numbers.index(button.emoji.name) + 1
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
        embed_var = None
        if completed or button.label == 'forfeit':
            embed_var = await self.completed_embed(
                msg, user1, user2, token1, token2,
                moves, grid, turn, False, color=embed.color,
                forfeit=button.label == 'forfeit')
            await msg.edit(
                embed=embed_var,
                view=utils.build_view([utils.delete_button()])
            )
        else:
            if len(moves) == 42:
                embed_var = await self.completed_embed(
                    msg, user1, user2, token1, token2,
                    moves, grid, turn,
                    True, color=embed.color)
                await msg.edit(
                    embed=embed_var,
                    view=utils.build_view([utils.delete_button()])
                )
            else:
                embed_var = self.build_embed(
                    msg.embeds[0], user1, user2, token1, token2,
                    moves, grid, turn)
                await msg.edit(
                    embed=embed_var
                )

    def build_embed(
            self, embed, user1, user2, token1, token2, moves, grid, on_move
    ) -> utils.UtilityEmbed:
        embed.title = '{} {}  vs  {} {}!'.format(
            user1[1], token1, user2[1], token2)
        embed.description = 'On turn: {}\n\n{}\n\nMoves: {}'.format(
            token1 if on_move == 1 else token2,
            self.grid_text(grid),
            ''.join([str(i) for i in moves]))
        return embed

    async def completed_embed(
            self, msg, user1, user2, token1, token2, moves,
            grid, on_move, draw, color, forfeit=False
    ):
        # the embed once the game has finished
        # show in title who won agains who
        # if database connection show wins of the winner in the footer info
        users = (user1, user2) if on_move == 0 else (user2, user1)
        embed_var = utils.UtilityEmbed(
            description=f'Game completed\n\n{self.grid_text(grid)}',
            type=self.__class__.__name__,
            version=self.client.version,
            color=self.color)
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
            wins = await self.update_wins(users[0][0], msg.guild.id)
            name1 = f'**{users[0][1]}**'
            name = name1 + "'s" if users[0][1][-1] != 's' else name1 + "'"
            embed_var.description += '\n\n{} total wins: {}'.format(
                name, wins)
        return embed_var

    async def update_wins(self, user_id, guild_id) -> int:
        """
        Increment a user's wins in the database by 1 and return the
        the new win count.
        """
        wins = await self.client.database.Users.get_user_info(
            id=int(user_id),
            guild_id=guild_id,
            name=self.__class__.__name__ + '_wins'
        )
        if not wins:
            await self.client.database.Users.add_user_info(
                id=int(user_id),
                guild_id=guild_id,
                name=self.__class__.__name__ + '_wins',
                info=1
            )
            return 1
        wins = int(wins) + 1
        await self.client.database.Users.update_user_info(
            id=int(user_id),
            guild_id=guild_id,
            name=self.__class__.__name__ + '_wins',
            info=wins
        )
        return wins

    # UTILS

    def split_line(self, line):
        return (line.replace('\u2000', ''
                             ).replace('\u3000', '')).split()

    def join_line(self, line):
        separator = ' '
        return str(3 * '\u3000') + separator.join(line) + 3 * '\u3000'

    def grid_text(self, grid):
        txt = '\n'.join([self.join_line(i) for i in grid])
        txt += '\n' + 3 * '\u3000' + ' '.join(self.numbers)
        return txt

    # GAME MECHANICS

    @ property
    def empty_grid(self):
        return [[self.empty_grid_element for _ in range(7)] for _ in range(6)]

    @ property
    def overflow_mask(self):
        return 0x1020408102040

    def play(self, moves, token1, token2, grid=None):
        # get current grid by creating a bitmask from made moves
        # xor with cur position to get opponent position
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

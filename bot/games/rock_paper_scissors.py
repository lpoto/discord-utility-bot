import nextcord

import bot.utils as utils
import bot.decorators as decorators


class RockPaperScissors:
    def __init__(self, client):
        self.client = client
        self.description = 'A simple game of choice between two players.'
        self.color = utils.colors['brown']
        # rock, paper, scissors tokens
        self.tokens = (
            u'\U0001FAA8',
            u'\U0001F5DE\U0000FE0F',
            u'\U00002702\U0000FE0F'
        )
        self.default_deletion_time = 24

    def is_rps(self, msg, data=None, init=False) -> bool:
        """
        Determine whether an interaction message is a valid
        rock, paper,scissors message.
        """
        if (len(msg.embeds) != 1):
            return False
        # if "init", we are checking Games menu, else rps message
        embed = self.client.embed(embed=msg.embeds[0])
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
        Start a game of rock paper scissors, selected from the games menu.
        Allow the first user to choose in an ephemeral message.
        """

        if not self.is_rps(msg=msg, data=data, init=True):
            return

        self.client.logger.debug(
            msg=f'RockPaperScissors ephemeral selection: {str(user.id)}')

        # build view (buttons) with rock paper scissors emojis
        components = [nextcord.ui.Button(emoji=i) for i in self.tokens]
        view = utils.build_view(components)
        if view is None:
            return
        # create initial embed sent to the user as an ephemeral message
        embed = self.client.embed(
            color=self.color,
            type=self.__class__.__name__,
            description='Choose one of the options to **start** the game.')
        await webhook.send(embed=embed, view=view, ephemeral=True)

    @decorators.ButtonClick
    async def user_selection(self, msg, user, button, webhook):
        """
        Add a user's choice to the game. Determine whether the user is
        first or second to join, a player cannot play with himself.
        """
        # if message is ephemeral, it means the first user is making his choice
        # if the message is not ephemeral, the first user has already chosen
        # and the second user, that is not the same as the first user, must
        # make his choice
        if not self.is_rps(msg) or button.emoji.name not in self.tokens:
            return
        selection = 1 if ('ephemeral', True) in msg.flags else 2

        self.client.logger.debug(
            msg='RockPaperScissors: user: {}, msg: {}, selection: {}'.format(
                user.id, msg.id, selection
            )
        )

        if selection == 1:
            await self.first_user_selection(button, msg, user, webhook)
            return
        elif selection == 2:
            await self.second_user_selection(button, msg, user, webhook)

    async def first_user_selection(self, button, msg, user, webhook):
        """
        Save the first user's choice to database and send a new
        message to the channel where another user can join the game.
        """

        embed = self.client.embed(embed=msg.embeds[0])

        # edit the ephemeral message through webhook
        # change the selected button to green
        components = []
        idx = None
        for i, v in enumerate(self.tokens):
            if v == button.emoji.name:
                idx = i
            components.append(nextcord.ui.Button(emoji=v))
        components[idx].style = nextcord.ButtonStyle.green
        embed.set_type_and_version(
            type=self.__class__.__name__ + '_selected',
            version=self.client.version
        )
        embed.description = f'You picked {button.emoji.name}'
        await webhook.edit_message(
            message_id=msg.id,
            embed=msg.embeds[0],
            view=utils.build_view(components))

        # send a non ephemeral message to the channel so another user can join
        new_embed = self.client.embed(
            title='{} is waiting for an opponent...'.format(
                user.name if not user.nick else user.nick),
            color=utils.random_color(),
            type=self.__class__.__name__,
            description='Select one of the options to **join** the game.'
        )

        # if user has nickname set up use nickname, else use username
        components[idx].style = nextcord.ButtonStyle.gray
        new_msg = await msg.channel.send(
            embed=new_embed,
            view=utils.build_view(components))

        # save the message and the first user's choice to database
        deletion_time = await self.client.database.Config.get_option(
            name=self.__class__.__name__ + '_deletion',
            guild_id=msg.guild.id
        )
        if not deletion_time or len(deletion_time.get('info')) == 0:
            deletion_time = self.default_deletion_time * 3600
        elif deletion_time:
            deletion_time = int(deletion_time.get('info')[0]) * 3600
        deletion_timestamp = utils.delta_seconds_timestamp(deletion_time)
        await self.client.database.Messages.add_message(
            id=new_msg.id, channel_id=new_msg.channel.id,
            type=self.__class__.__name__, info=[
                {
                    'name': 'choice1',
                    'info': button.emoji.name,
                    'user_id': user.id
                },
                {
                    'name': 'deletion_time',
                    'info': deletion_timestamp
                }
            ]
        )

    async def second_user_selection(self, button, msg, user, webhook):
        """
        Determine a game's result based on 2nd user's choice.
        """
        # Both users have selected their choices.
        # get the info from database and determine winner, save the winner's
        # wins to database

        # get the game's info from database
        msg_info = await self.client.database.Messages.get_message_info(
            id=msg.id, name="choice1"
        )
        # can't continue if no info exists
        if not msg_info or len(msg_info) < 1:
            return

        msg_info = msg_info[0]

        if (
                not msg_info.get('user_id') or
                str(msg_info.get('user_id')) == str(user.id)
        ):
            # user cannot play with himself
            return

        game_results = self.winner(
            msg_info.get('user_id'),
            msg_info.get('info'),
            str(user.id),
            str(button.emoji.name)
        )
        if not game_results or any(i is None for i in game_results.values()):
            return

        user1 = msg.guild.get_member(int(game_results.get('user1_id')))
        user2 = msg.guild.get_member(int(game_results.get('user2_id')))
        if not user1 or not user2:
            return
        name1 = user1.name if not user1.nick else user1.nick
        name2 = user2.name if not user2.nick else user2.nick

        embed = self.client.embed(embed=msg.embeds[0])

        if not game_results.get('winner'):
            embed.title = 'Draw!'
            embed.description = '**{}**  vs  **{}**'.format(
                name1, name2
            )
        else:
            embed.title = '{}  wins against  {}!'.format(
                name1, name2
            )
            wins = await self.update_wins(user1.id, msg.guild.id)
            name1 = f'**{name1}**'
            name = name1 + "'s" if name1[-1] != 's' else name1 + "'"
            embed.description = '{} total wins: {}'.format(
                name, wins)

        # make the selected button green, add delete button
        components = []
        red_idx = None
        green_idx = None
        for i, v in enumerate(self.tokens):
            if v == game_results.get('option1'):
                green_idx = i
            if v == game_results.get('option2'):
                red_idx = i
            components.append(nextcord.ui.Button(emoji=v))
        if red_idx == green_idx:
            components[green_idx].style = nextcord.ButtonStyle.blurple
        else:
            components[green_idx].style = nextcord.ButtonStyle.green
            components[red_idx].style = nextcord.ButtonStyle.red
        embed.set_type_and_version(
            type=self.__class__.__name__ + '_ended',
            version=self.client.version
        )
        components.append(utils.delete_button())
        await msg.edit(embed=embed, view=utils.build_view(components))

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

    def winner(self, user1_id, option1, user2_id, option2) -> dict:
        """
        Determine the game's winner from the selected options
        """
        # if options are equal or any option is invalid, return a draw
        if any(
                not i for i in {user1_id, option1, user2_id, option2}
        ) or option1 == option2:
            return {
                'winner': False,
                "user1_id": user1_id,
                "user2_id": user2_id,
                "option1": option1,
                "option2": option2
            }
        if (
            (option1 == self.tokens[0] and option2 == self.tokens[2]) or
            (option1 == self.tokens[1] and option2 == self.tokens[0]) or
            (option1 == self.tokens[2] and option2 == self.tokens[1])
        ):
            # winner is user1
            return {
                'winner': True,
                "user1_id": user1_id,
                "user2_id": user2_id,
                "option1": option1,
                "option2": option2
            }
        else:
            # winner is user2
            return {
                'winner': True,
                "user1_id": user2_id,
                "user2_id": user1_id,
                "option1": option2,
                "option2": option1
            }

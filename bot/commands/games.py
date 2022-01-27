import nextcord

import bot.decorators as decorators
import bot.utils as utils


class Games:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['yellow']
        self.description = 'A menu for starting games and seeing leaderboards.'
        self.delete_button_author_check = True

    @decorators.MenuSelect
    async def determine_menu_select_type(self, msg, user, data, webhook):
        embed = self.client.embed(embed=msg.embeds[0])
        type = embed.get_type()
        if (
                type not in {
                    self.__class__.__name__,
                    self.client.default_type
                }
        ):
            return
        if (
                data == self.client.back_button_click or
                'values' in data and len(data['values']) > 0 and
                data['values'][0] == self.__class__.__name__
        ):
            await self.send_game_menu_to_channel(msg, user)
        elif 'values' not in data or len(data['values']) < 1:
            return
        elif ' - leaderboard' in data['values'][0]:
            name = data['values'][0].replace(' - leaderboard', '', 1).strip()
            await self.send_leaderboard(msg, user, name, webhook)
            await utils.reset_message_view(msg)
        elif data['values'][0] in self.client.games:
            await self.client.call_menu_select_methods(
                msg, data['values'][0], user, data, webhook
            )
            await utils.reset_message_view(msg)

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def send_game_menu_to_channel(self, msg, user):

        self.client.logger.debug(
            msg=f'Games: message: {str(msg.id)}, main menu'
        )

        embed = self.client.embed(
            type=self.__class__.__name__,
            color=self.color,
            author=user
        )
        components = [
            nextcord.ui.Button(label='New poll'),
            utils.home_button(),
            utils.help_button(),
            utils.delete_button()]
        options1 = [nextcord.SelectOption(
            label=k,
            description=v.description)
            for k, v in self.client.games.items()]
        options2 = [nextcord.SelectOption(
            label=k + ' - leaderboard')
            for k, v in self.client.games.items()]
        components = [
            nextcord.ui.Select(
                placeholder='Select a game',
                options=options1),
            nextcord.ui.Select(
                placeholder='Select a leaderboard',
                options=options2),
            utils.home_button(),
            utils.help_button(),
            utils.delete_button()
        ]
        await msg.edit(embed=embed, view=utils.build_view(components))

    async def send_leaderboard(self, msg, user, name, webhook):
        if self.client.logger.level < 10:
            self.client.logger.debug(
                msg='Games: guild: {}, leaderboard: {}'.format(
                    msg.guild.id, name
                )
            )
        fetched = await self.client.database.Users.get_info(
            guild_id=msg.guild.id, name=name + '_wins')

        if fetched is None or len(fetched) == 0:
            await webhook.send(
                f'No leaderboard data for {name} in this server',
                ephemeral=True
            )
            return

        embed_var = self.client.embed(
            type=self.__class__.__name__,
            title=name,
            color=utils.random_color()
        )
        users = {}
        for i in fetched:
            user = msg.guild.get_member(int(i.get('user_id')))
            if user is None:
                continue
            users[user] = int(i.get('info'))
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
        await webhook.send(embed=embed_var, ephemeral=True)

    @decorators.Help
    def additional_info(self):
        return '\n'.join((
            '* Select a game to start that game.',
            "* Select a game's leaderboard to see other members' wins",
            '\n* Games will be automatically deleted after 24h.'
        ))

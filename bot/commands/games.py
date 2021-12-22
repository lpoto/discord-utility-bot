import nextcord

import bot.decorators as decorators
import bot.utils as utils


class Games:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['yellow']
        self.description = 'A menu for starting games and seeing leaderboards.'

    @decorators.MenuSelect
    @decorators.CheckPermissions
    async def send_game_menu_to_channel(self, msg, user, data, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if (embed.get_type() not in {
            self.client.default_type, self.__class__.__name__}
                or 'values' in data and
                data['values'][0] != self.__class__.__name__):
            return

        self.client.logger.debug(msg=f'Games main menu: {str(msg.id)}')

        embed = utils.UtilityEmbed(
            type=self.__class__.__name__,
            version=self.client.version,
            description='',
            color=self.color)
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
        await self.client.database.Messages.update_message_author(
            id=msg.id, author_id=None)

    @decorators.MenuSelect
    async def send_leaderboard(self, msg, user, data, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if (embed.get_type() != self.__class__.__name__ or
                'values' not in data or
                ' - leaderboard' not in data['values'][0]):
            return
        name = data['values'][0].split(' - ')[0]

        fetched = await self.client.database.Users.get_info(
            guild_id=msg.guild.id, name=name + '_wins')
        if fetched is None or len(fetched) == 0:
            return

        self.client.logger.debug(
            msg='Leaderboard for {} in guild {}'.format(
                name, msg.guild.id))

        embed_var = utils.UtilityEmbed(
            type=self.__class__.__name__,
            version=self.client.version,
            title=data['values'][0],
            color=utils.random_color())
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
            "* Select a game's leaderboard to see other members' wins"
        ))

import nextcord

import bot.decorators as decorators
import bot.utils as utils

# TODO


class Config:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['red']
        self.description = "Manage bot's configurations in this server."

    @decorators.MenuSelect
    @decorators.CheckPermissions
    async def edit_message_to_config_message(self, msg, user, data, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if (embed.title and 'values' in data or
            embed.get_type() not in {
                self.client.default_type, self.__class__.__name__}
                or 'values' in data and
                data['values'][0] != self.__class__.__name__):
            return

        self.client.logger.debug(msg=f'Config menu: {str(user.id)}')

        info = self.general_embed
        await msg.edit(embed=info[0], view=utils.build_view(info[1]))

    @property
    def options(self) -> dict:
        return {
            'roles': (
                'Which roles are allowed to use a command.',
                self.roles_embed
            ),
            'Deletion time': (
                'Time before the auto-deleting messages are deleted.',
                self.deletion_time_embed
            ),
        }

    @property
    def general_embed(self) -> utils.UtilityEmbed:
        embed_var = utils.UtilityEmbed(
            description='',
            color=self.color,
            type=self.__class__.__name__,
            version=self.client.version)
        opts = self.options
        options = [nextcord.SelectOption(
            label=k, description=v[0]) for k, v in opts.items()]
        components = [
            nextcord.ui.Select(
                placeholder='Select an option', options=options),
            utils.home_button(4),
            utils.help_button(4),
            utils.delete_button(4)
        ]
        return (embed_var, components)

    def valid_config(self, msg, title=None):
        if len(msg.embeds) != 1:
            return False
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if embed.get_type() != self.__class__.__name__:
            return False
        return ((title is None and not embed.title) or
                (title is not None and embed.title == title))

    @decorators.MenuSelect
    async def modify_from_dropdown(self, msg, user, data, webhook):
        if not self.valid_config(msg):
            return

        name = data['values'][0]
        for k, v in self.options.items():
            if k == name:
                self.client.logger.debug(
                    msg='Selected config option {} on message {}'.format(
                        name, msg.id))

                return await v[1](name, msg)

    async def deletion_time_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        embed.description = (
            'Select a message type to modify its deletion time.'
        )
        options = [nextcord.SelectOption(
            label=k) for k in self.client.default_deletion_times.keys()]
        components = [
            nextcord.ui.Select(
                placeholder='Select a type of message.',
                options=options),
            utils.back_button(),
            utils.delete_button(),
        ]
        await msg.edit(embed=embed, view=utils.build_view(components))

    async def roles_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        embed.description = (
            'Select a command to modify the roles allowed to use it.'
        )
        options = []
        for k, v in self.client.commands.items():
            if k in self.risky_labels:
                k = '_' + k
            options.append(nextcord.SelectOption(
                label=k, description=v.description))
        components = [
            nextcord.ui.Select(
                placeholder='Select a command',
                options=options),
            utils.back_button(),
            utils.delete_button(),
        ]
        await msg.edit(embed=embed, view=utils.build_view(components))

    @decorators.Help
    def additional_info(self):
        return '\n'.join((
            '* Select an option you want to modify',
            '* Selected option will provide more info.'))

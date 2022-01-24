import nextcord

import bot.decorators as decorators
import bot.utils as utils


class Config:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['red']
        self.description = "Manage which roles are allowed to use a command"
        self.delete_button_author_check = True

    @decorators.MenuSelect
    async def determine_menu_type(self, msg, user, data, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        type = embed.get_type()
        if (
                type == self.client.default_type or
                type == self.__class__.__name__ and data and
                data == '@back_button_click'
        ):
            await self.edit_message_to_config_message(msg, user)
        elif (
                type == self.__class__.__name__ and
                data and 'values' in data and len(data['values']) > 0
        ):
            if data['values'][0] in self.client.commands:
                await self.command_selection(msg, user, data['values'][0])
            else:
                await self.roles_selection(msg, user, data['values'])

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def edit_message_to_config_message(self, msg, user):

        self.client.logger.debug(msg=f'Config menu: {str(user.id)}')

        embed = utils.UtilityEmbed(
            title='Select a command to modify the roles allowed to use it',
            description='',
            version=self.client.version,
            type=self.__class__.__name__
        )
        options = [
            nextcord.SelectOption(
                label=k, description=v.description)
            for k, v in self.client.commands.items()
        ]
        components = [
            nextcord.ui.Select(
                placeholder='Select a command',
                options=options),
            utils.home_button(),
            utils.help_button(),
            utils.delete_button(),
        ]
        await msg.edit(embed=embed, view=utils.build_view(components))

    def valid_config(self, msg, title=None):
        if len(msg.embeds) != 1:
            return False
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if embed.get_type() != self.__class__.__name__:
            return False
        return ((title is None and not embed.title) or
                (title is not None and embed.title == title))

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def command_selection(self, msg, user, command):

        self.client.logger.debug(
            msg=f'Config for {command} in server: {str(msg.guild.id)}'
        )

        embed = msg.embeds[0]
        embed.title = command

        required_roles = await self.client.database.Config.get_option(
            guild_id=msg.guild.id, name=self.__class__.__name__)

        if required_roles and required_roles.get('info'):
            embed.description = ', '.join(
                [f'`{i}`' for i in required_roles.get('info')]
            )
        else:
            embed.description = ''

        await msg.edit(embed=embed, view=utils.build_view(
            self.get_role_dropdown_components(msg, 0, 25, command)
        ))

    def get_role_dropdown_components(self, msg, i, j, command) -> list:
        options = []
        buttons = []
        if i > 0:
            buttons.append(nextcord.ui.Button(
                label=f"page {str(i // 25)} of roles")
            )
        idx = 0
        guild_roles = msg.guild.roles[::-1]
        for r in guild_roles:
            if idx >= i:
                if r.is_default():
                    continue
                if idx >= j:
                    buttons.append(
                        nextcord.ui.Button(
                            label="page {} of roles".format(
                                (i // 25) + 2
                            )
                        ))
                    break
                options.append(nextcord.SelectOption(label=r.name))
            idx += 1
        label = f"Select roles for {command}"
        if i > 0:
            label += f' (page {str(i // 25 + 1)})'
        components = [
            nextcord.ui.Select(
                placeholder=label,
                options=options,
                max_values=len(options) if len(options) <= 20 else 20,
            )
        ] + buttons
        components += [
            utils.back_button(),
            nextcord.ui.Button(label='clear'),
            nextcord.ui.Button(label='commit')
        ]
        return components

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def roles_selection(self, msg, user, roles):
        embed = msg.embeds[0]
        new_roles = set(roles)
        desc_roles = set()
        if embed.description and len(embed.description) > 2:
            desc_roles = set(
                i[1:][:-1] for i in embed.description.split(', ')
            )
        roles_to_remove = new_roles.intersection(desc_roles)
        new_roles = new_roles.union(desc_roles).difference(roles_to_remove)
        embed.description = ', '.join([f'`{i}`' for i in new_roles])
        await msg.edit(embed=embed)

    @decorators.ButtonClick
    async def determine_button_type(self, msg, user, button, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if embed.get_type() != self.__class__.__name__:
            return
        label = button.label
        if label == 'clear':
            await self.clear_roles(msg, user)
        elif label == 'commit':
            await self.commit_roles(msg, user, webhook)
        elif label.startswith('page '):
            try:
                page = (int(label.split()[1].strip()) - 1) * 25
                await self.change_roles_page(
                    msg, user, page, page + 25
                )
            except Exception:
                return

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def clear_roles(self, msg, user):
        msg.embeds[0].description = ''
        await msg.edit(embed=msg.embeds[0])

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def change_roles_page(self, msg, user, i, j):
        await msg.edit(
            view=utils.build_view(
                self.get_role_dropdown_components(
                    msg, i, j, msg.embeds[0].title)
            )
        )

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def commit_roles(self, msg, user, webhook):
        if len(msg.embeds) != 1 or not msg.embeds[0].title:
            return
        if (
                not msg.embeds[0].description or
                len(msg.embeds[0].description) < 3
        ):
            await self.client.database.Config.delete_option(
                guild_id=msg.guild.id, name=msg.embeds[0].title
            )

            self.client.logger.debug(
                msg='Removed required roles: command: {}, guild: {}'.format(
                    msg.embeds[0].title,
                    msg.guild.id
                )
            )
            await webhook.send(
                f'Removed roles for {msg.embeds[0].title}',
                ephemeral=True
            )

            return

        roles = [
            i[1:][:-1] for i in msg.embeds[0].description.split(', ')
        ]
        await self.client.database.Config.add_option(
            guild_id=msg.guild.id,
            name=msg.embeds[0].title,
            info=roles
        )
        self.client.logger.debug(
            msg='Changed required roles: command: {}, guild: {}'.format(
                msg.embeds[0].title,
                msg.guild.id
            )
        )

        await webhook.send(
            'Changed roles for {} to `{}`'.format(
                msg.embeds[0].title, ', '.join(roles)
            ),
            ephemeral=True
        )

    @decorators.Help
    def additional_info(self):
        return '\n'.join((
            '* Select a command in a dropdown.',
            '* For the selected command, select the roles in a dropdown.'
            '* Selected roles will be allowed to use those commands.'
        ))

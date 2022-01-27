import nextcord

import bot.decorators as decorators
import bot.utils as utils


class Roles:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['blue']
        self.description = 'Add or remove roles with button clicks.'
        self.author_check = {'MenuSelect', 'DeleteButton'}

    @decorators.MenuSelect
    async def determine_menu_select_type(self, msg, user, data, webhook):
        embed = self.client.embed(embed=msg.embeds[0])
        type = embed.get_type()
        if (
                type == self.client.default_type or
                type == self.__class__.__name__ and data and
                data == self.client.back_button_click
        ):
            await self.start_command(msg, user)
        elif self.valid_roles_message(msg):
            await self.add_roles_to_embed(msg, user, data, webhook)

    @decorators.CheckPermissions
    async def start_command(self, msg, user):

        self.client.logger.debug(msg=f'Roles main menu: {str(msg.id)}')

        embed = self.client.embed(
            type=self.__class__.__name__,
            title=self.description,
            color=self.color,
            author=user
        )
        components = [
            nextcord.ui.Button(label='New roles message'),
            utils.home_button(),
            utils.help_button(),
            utils.delete_button()]
        await msg.edit(embed=embed, view=utils.build_view(components))

    @decorators.ButtonClick
    async def empty_roles_message_to_channel(self, msg, user, button, webhook):
        if (button.label != 'New roles message' or
                msg.embeds[0].title and
                msg.embeds[0].title != self.description):
            return

        if await self.client.validate_author(msg.id, user.id) is False:
            return

        self.client.logger.debug(
            msg=f'Roles: message: {str(msg.id)}, new message'
        )

        # send a message to the channel, containing the
        # information on how to add roles to the message
        info = await self.starting_embed(msg)
        if info is None:
            return
        info[0].set_author(msg.guild.get_member(user.id))
        await msg.edit(embed=info[0], view=utils.build_view(info[1]))

    def valid_roles_message(self, msg):
        if (len(msg.embeds) != 1 or
                not isinstance(msg.channel, nextcord.TextChannel)):
            return False
        embed = self.client.embed(embed=msg.embeds[0])
        return ((not embed.title) and
                (embed.get_type() == self.__class__.__name__))

    async def starting_embed(self, msg, start=0, end=25, embed=None):
        # add a dropdown of guild roles that can be added
        # add buttons for switching between pages of roles if there are over
        # 25 addable roles
        # add clear button that clears all added roles and
        # commit button that removes the dropdown and turn roles into buttons
        if embed is None:
            embed = self.client.embed(
                description=self.additional_info(self),
                color=utils.random_color(),
                type=self.__class__.__name__
            )
        guild_roles = []
        for r in msg.guild.roles:
            x = await self.valid_role(role=r, msg=msg)
            if x:
                guild_roles.append(x.name)
        guild_roles = guild_roles[::-1]
        options = []
        for i in range(start, end):
            if i >= len(guild_roles):
                break
            options.append(nextcord.SelectOption(label=guild_roles[i]))
        x = 'Select roles'
        if start > 0 or len(guild_roles) > end:
            x = 'Select roles (page {})'.format(start // 25 + 1)
        components = [
            nextcord.ui.Select(
                placeholder=x,
                options=options,
                max_values=len(options) if len(options) <= 20 else 20),
        ]
        if start > 0:
            components.append(nextcord.ui.Button(
                label='page {} of roles'.format(start // 25)))
        if len(guild_roles) > end:
            components.append(nextcord.ui.Button(
                label='page {} of roles'.format((start // 25) + 2)))
        components.append(utils.back_button())
        components.append(nextcord.ui.Button(label='clear'))
        components.append(nextcord.ui.Button(label='commit'))
        return embed, components

    @decorators.CheckPermissions
    async def add_roles_to_embed(self, msg, user, data, webhook):
        # add the selected roles from the dropdown to the description
        # when commiting, these roles will turn into buttons

        if self.client.logger.level < 10:
            self.client.logger.debug(
                msg=f'Roles: message: {str(msg.id)}, changing roles'
            )

        embed = msg.embeds[0]
        if not embed.description or embed.description[0] != '`':
            embed.description = ', '.join(
                ['`{}`'.format(r) for r in data['values']])
        else:
            rls = [x[1:][:-1] for x in embed.description.split(', ')]
            for role in data['values']:
                if role in rls:
                    rls.remove(role)
                else:
                    rls.append(role)
            if len(rls) > 20:
                await msg.channel.warn(
                    'There can be only 20 roles in a single message!',
                    webhook=webhook)
                return
            if len(rls) == 0:
                embed.description = nextcord.Embed.Empty
            else:
                embed.description = ', '.join(
                    ['`{}`'.format(x) for x in rls])
        await msg.edit(embed=embed)

    @decorators.ButtonClick
    @decorators.CheckPermissions
    async def handle_roles_editing(self, msg, user, button, webhook):
        if not self.valid_roles_message(msg):
            return
        embed = msg.embeds[0]
        if (button.label == 'clear' and embed.description and
                len(embed.description) > 0):

            if self.client.logger.level < 10:
                self.client.logger.debug(
                    msg=f'Roles: message: {str(msg.id)}, clear'
                )

            # clear all roles from description
            embed.description = nextcord.Embed.Empty
            await msg.edit(embed=embed)
            return
        if (button.label == 'commit' and embed.description and
                len(embed.description) > 0):
            # turn roles from description into buttons
            # and remove dropdown menu, and footer info
            if not embed.description:
                return

            if self.client.logger.level < 10:
                self.client.logger.debug(
                    msg=f'Roles: message: {str(msg.id)}, commit'
                )

            components = [
                nextcord.ui.Button(
                    label=i[1:][:-1]) for i in embed.description.split(', ')
            ]
            embed.description = nextcord.Embed.Empty
            await msg.edit(embed=embed, view=utils.build_view(components))
            await self.client.database.Messages.update_message_author(
                id=msg.id, author_id=None)
            return
        # if page in button, switch pages of roles (when there are over 25
        # addable roles)
        if button.label.startswith('page '):
            x = int(button.label.replace('page ', '', 1).split()[0])

            if self.client.logger.level < 10:
                self.client.logger.debug(
                    msg=f'Roles: message: {str(msg.id)}, roles page: {x}'
                )

            x -= 1
            info = await self.starting_embed(
                msg, x * 25, x * 25 + 25, embed)
            await msg.edit(embed=info[0], view=utils.build_view(info[1]))

    @decorators.ButtonClick
    async def add_remove_role(self, msg, user, button, webhook):
        if (not self.valid_roles_message(msg) or
                msg.embeds[0].description or
                len(msg.embeds[0].description) > 0):
            return
        # if user has the role remove it, else add the role
        r = button.label
        role = await self.valid_role(
            role_name=r, msg=msg)
        if role is None:
            return
        rl = user.get_role(role.id)

        if self.client.logger.level < 10:
            self.client.logger.debug(
                msg='Roles: role: {}, user: {}, add: {}'.format(
                    role.id, user.id, rl is None
                )
            )

        txt = None
        # notify the user about the added or removed role
        # with an ephemeral message
        if rl is None:
            await user.add_roles(role)
            txt = 'Added role `{}`'.format(role.name)
        else:
            await user.remove_roles(role)
            txt = 'Removed role `{}`'.format(role.name)
        if txt is None:
            return
        await webhook.send(content=txt, ephemeral=True)

    @decorators.Reply
    @decorators.CheckPermissions
    async def reedit_roles_message(self, msg, user, referenced_msg):
        # replying "edit" on a commited roles message should reopen
        # it for editing
        if (not self.valid_roles_message(referenced_msg) or
                msg.content not in {'edit', 'change', 'reedit', 'modify'} or
                referenced_msg.embeds[0].description):
            return

        self.client.logger.debug(
            msg=f'Roles: message: {str(msg.id)}, reedit'
        )

        x = []
        embed = referenced_msg.embeds[0]
        color = embed.color
        for i in sum([i.children for i in referenced_msg.components], []):
            if isinstance(i, nextcord.Button):
                x.append('`{}`'.format(i.label))
        info = await self.starting_embed(referenced_msg, embed=embed)
        info[0].color = color
        if len(x) > 0:
            info[0].description = ', '.join(x)
        await referenced_msg.edit(
            embed=info[0], view=utils.build_view(info[1]))
        await self.client.database.Messages.update_message_author(
            id=referenced_msg.id, author_id=user.id)

    async def valid_role(self, msg, role_name=None, role=None):
        # check if role exists and if bot can add such a role
        if not role:
            role = next(
                filter(lambda i: i.name == role_name, msg.guild.roles),
                None)
        if role is None:
            return
        # don't sent default (@everyone) or integration roles
        if (role.is_integration() or role.is_default() or
                not role.is_assignable()):
            return
        position = False
        # don't allow roles higher than bot's highest role
        for i in msg.guild.me.roles:
            if i.position > role.position:
                position = True
                break
        if not position:
            return
        # roles with these permissions not allowed
        if (role.permissions.administrator or
            role.permissions.manage_guild or
            role.permissions.manage_channels or
            role.permissions.manage_roles or
            role.permissions.manage_webhooks or
            role.permissions.manage_nicknames or
            role.permissions.manage_messages or
            role.permissions.ban_members or
            role.permissions.kick_members or
            role.permissions.deafen_members or
                role.permissions.move_members):
            return
        return role

    @decorators.Help
    def additional_info(self):
        return '\n'.join((
            'Add roles to the message by selecting them in the dropdown.',
            'Selecting an already added role will remove it.',
            'Clicking `clear` will remove all the roles in the message.',
            'Clicking `commit` will change the menu into role buttons.',
            'Clicking on a button will give or remove the role.',
            'You can edit the roles in a message by replying `edit`.'))

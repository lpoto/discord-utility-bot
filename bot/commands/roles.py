import nextcord

import bot.decorators as decorators
import bot.utils as utils


class Roles:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['blue']
        self.description = 'Add or remove roles with button clicks.'
        self.risky_labels = {'delete', 'help', 'home', 'back'}

    @decorators.MenuSelect
    @decorators.CheckPermissions
    async def start_command(self, msg, user, data, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if (embed.get_type() not in {
            self.client.default_type, self.__class__.__name__}
                or 'values' in data and
                data['values'][0] != self.__class__.__name__):
            return

        self.client.logger.debug(msg=f'Roles main menu: {str(msg.id)}')

        embed = utils.UtilityEmbed(
            type=self.__class__.__name__,
            version=self.client.version,
            title=self.description,
            description='',
            color=self.color)
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

        self.client.logger.debug(msg=f'New roles message: {str(msg.id)}')

        # send a message to the channel, containing the
        # information on how to add roles to the message
        info = await self.starting_embed(msg)
        if info is None:
            return
        await msg.edit(embed=info[0], view=utils.build_view(info[1]))

    def valid_roles_message(self, msg):
        if (len(msg.embeds) != 1 or
                not isinstance(msg.channel, nextcord.TextChannel)):
            return False
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        return ((not embed.title) and
                (embed.get_type() == self.__class__.__name__))

    async def starting_embed(self, msg, start=0, end=25, embed=None):
        # add a dropdown of guild roles that can be added
        # add buttons for switching between pages of roles if there are over
        # 25 addable roles
        # add reset button that clears all added roles and
        # commit button that removes the dropdown and turn roles into buttons
        if embed is None:
            embed = utils.UtilityEmbed(
                description=self.additional_info(self),
                color=utils.random_color(),
                version=self.client.version,
                type=self.__class__.__name__)
        guild_roles = []
        for r in msg.guild.roles:
            x = await self.valid_role(role=r, msg=msg)
            if x:
                name = x.name
                if name in self.risky_labels:
                    guild_roles.append('_' + name)
                else:
                    guild_roles.append(name)
        guild_roles = guild_roles[::-1]
        options = []
        for i in range(start, end):
            if i >= len(guild_roles):
                break
            options.append(nextcord.SelectOption(label=guild_roles[i]))
        x = 'Select roles'
        if start > 0 or len(guild_roles) > end:
            x = 'Select roles (page {})'.format(start // 21 + 1)
        components = [
            nextcord.ui.Select(
                placeholder=x,
                options=options,
                max_values=len(options) if len(options) <= 20 else 20),
            nextcord.ui.Button(label='reset'),
            nextcord.ui.Button(label='commit')
        ]
        if start > 0:
            components.append(nextcord.ui.Button(
                label='page {} of roles'.format(start // 25)))
        if len(guild_roles) > end:
            components.append(nextcord.ui.Button(
                label='page {} of roles'.format((start // 25) + 2)))
        return embed, components

    @decorators.MenuSelect
    @decorators.CheckPermissions
    async def add_roles_to_embed(self, msg, user, data, webhook):
        # add the selected roles from the dropdown to the description
        # when commiting, these roles will turn into buttons
        if not self.valid_roles_message(msg):
            return

        self.client.logger.debug(
            msg=f'Changing roles in message: {str(msg.id)}')

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
        if (button.label == 'reset' and embed.description and
                len(embed.description) > 0):

            self.client.logger.debug(
                msg='Resetting roles in message: ' + str(msg.id))

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

            self.client.logger.debug(
                msg='Commiting roles in message: ' + str(msg.id))

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
            x = int(button.label.replace('page ', '', 1).split()[0]) - 1
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
        if r[0] == '_' and r[1:] in self.risky_labels:
            r = r[1:]
        role = await self.valid_role(
            role_name=r, msg=msg)
        if role is None:
            return
        rl = user.get_role(role.id)

        self.client.logger.debug(
            msg='Add role {} to user {}: {}'.format(
                role.id, user.id, rl is None))

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

        self.client.logger.debug(msg='Reediting roles message: ' + str(msg.id))

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
            'Clicking `reset` will remove all the roles in the message.',
            'Clicking `commit` will change the menu into role buttons.',
            'Clicking on a button will give or remove the role.',
            'You can edit the roles in a message by replying `edit`.'))

from commands.help import Help
import discord
from utils.misc import random_color
from utils.wrappers import EmbedWrapper
import utils.decorators as decorators


class Roles(Help):
    def __init__(self):
        super().__init__(name='roles')
        self.description = 'Add or remove roles with button clicks.'
        self.bot_permissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['manage_roles']
        self.risky_labels = ['delete', 'config', 'help', 'games']

    @decorators.ExecuteCommand
    async def empty_roles_message_to_channel(self, msg):
        # send a message to the channel, containing the
        # information on how to add roles to the message
        # name of the message can be added to the command (prefixroles <name>)
        args = msg.content.split()
        title = None
        if len(args) > 1:
            title = msg.content.replace('{} '.format(args[0]), '', 1)
            if len(title) > 60:
                await msg.channel.warn(
                    'Cannot add titles longer than 60 characters!')
                return
        info = await self.starting_embed(title=title, msg=msg)
        if info is None:
            return
        await msg.channel.send(embed=info[0], components=info[1])

    async def starting_embed(self, title, msg, start=0, end=25, embed=None):
        # add a dropdown of guild roles that can be added
        # add buttons for switching between pages of roles if there are over
        # 25 addable roles
        # add reset button that clears all added roles and
        # commit button that removes the dropdown and turn roles into buttons
        if embed is None:
            m = EmbedWrapper.NOT_DELETABLE
            text = 'ROLES' if title is None else 'ROLES - {}'.format(title)
            embed = EmbedWrapper(discord.Embed(
                color=random_color()),
                info='* {}\n* {}\n* {}\n* {}'.format(
                    'Select the roles you want to add (max 20).',
                    'Clicking on an already added role will remove it, ' +
                    'clicking "reset" will remove all roles.',
                    'Click on commit once you added all the roles.',
                    'You can later edit the message  by replying "edit".'),
                embed_type='{}{}{}'.format(
                    text, (60 - len(text + m)) * '\u2000', m))
        guild_roles = []
        for r in msg.guild.roles:
            x = await self.valid_role(role=r, msg=msg, reply=False)
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
            options.append(discord.SelectOption(label=guild_roles[i]))
        x = 'Select roles'
        if start > 0 or len(guild_roles) > end:
            x = 'Select roles (page {})'.format(start // 21 + 1)
        components = [
            discord.ui.Select(
                placeholder=x,
                options=options,
                max_values=len(options) if len(options) <= 20 else 20),
            discord.ui.Button(label='reset'),
            discord.ui.Button(label='commit')
        ]
        if start > 0:
            components.append(discord.ui.Button(
                label='page {} of roles'.format(start // 25)))
        if len(guild_roles) > end:
            components.append(discord.ui.Button(
                label='page {} of roles'.format((start // 25) + 2)))
        return embed, components

    @decorators.OnMenuSelect
    async def add_roles_to_embed(self, interaction, msg, user, webhook):
        # add the selected roles from the dropdown to the description
        # when commiting, these roles will turn into buttons
        if not msg.is_roles:
            return
        # make sure the user has the required permissions
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        embed = msg.embeds[0]
        if not embed.description:
            embed.description = ', '.join(
                ['`{}`'.format(r) for r in interaction.data['values']])
        else:
            rls = [x[1:][:-1] for x in embed.description.split(', ')]
            for role in interaction.data['values']:
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
                embed.description = discord.Embed.Empty
            else:
                embed.description = ', '.join(
                    ['`{}`'.format(x) for x in rls])
        await msg.edit(embed=embed)

    @decorators.OnButtonClick
    async def handle_button_clicks(self, button, msg, user, webhook):
        # check if message is still being edited or
        # if role should be added or removed
        if not msg.is_roles:
            return
        # if there is no info on how to add roles in footer, add or remove the
        # role of the user who pressed the button
        if not msg.embeds[0].footer.text:
            await self.add_remove_role(button, msg, user, webhook)
            return
        # else make sure the user editing the message has the
        # required permissions
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        embed = msg.embeds[0]
        if button.label == 'reset':
            # clear all roles from description
            embed.description = discord.Embed.Empty
            await msg.edit(embed=embed)
            return
        if button.label == 'commit':
            # turn roles from description into buttons
            # and remove dropdown menu, and footer info
            if not embed.description:
                return
            components = [
                discord.ui.Button(
                    label=i[1:][:-1]) for i in embed.description.split(', ')
            ]
            embed.set_footer(text=discord.Embed.Empty)
            embed.description = discord.Embed.Empty
            await msg.edit(embed=embed, components=components)
        # if page in button, switch pages of roles (when there are over 25
        # addable roles)
        if button.label.startswith('page '):
            x = int(button.label.replace('page ', '', 1).split()[0]) - 1
            title = None
            if embed.author.name.startswith('ROLES - '):
                title = embed.author.name.replace('ROLES - ')
                title = title[:-len(title.split()[-1])].strip()
            info = await self.starting_embed(
                title, msg, x * 25, x * 25 + 25, embed)
            await msg.edit(embed=info[0], components=info[1])
            return

    async def add_remove_role(self, button, msg, user, webhook):
        # if user has the role remove it, else add the role
        r = button.label
        if r[0] == '_' and r[1:] in self.risky_labels:
            r = r[1:]
        role = await self.valid_role(
            role_name=r, msg=msg, reply=False)
        if role is None:
            return
        rl = user.get_role(role.id)
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
        perms = msg.channel.permissions(msg.guild.me, 'send_messages')
        if perms is None or perms[0] is False:
            return
        await webhook.send(content=txt, ephemeral=True)

    @decorators.OnReply
    async def reedit_roles_message(self, msg, referenced_msg):
        # replying "edit" on a commited roles message should reopen
        # it for editing
        # mage sure user editing the message has the required permissions
        if await self.bot.check_if_valid(self, msg, msg.author) is False:
            return
        if (not referenced_msg.is_roles or msg.content not in [
                'edit', 'change', 'reedit', 'modify'] or
                referenced_msg.embeds[0].footer.text):
            return
        x = []
        embed = referenced_msg.embeds[0]
        for i in referenced_msg.components:
            for i2 in i.children:
                if isinstance(i2, discord.Button):
                    x.append('`{}`'.format(i2.label))
        title = None
        if embed.author.name.startswith('ROLES - '):
            title = embed.author.name.replace('ROLES - ', '', 1)
            title = title[:-len(title.split()[-1])].strip()
        info = await self.starting_embed(title, referenced_msg)
        if len(x) > 0:
            info[0].description = ', '.join(x)
        await referenced_msg.edit(embed=info[0], components=info[1])

    async def valid_role(self, msg, role_name=None, role=None, reply=True):
        # check if role exists and if bot can add such a role
        if not role:
            for i in msg.guild.roles:
                if i.name == role_name:
                    role = i
                    break
        if role is None:
            if reply is True:
                await msg.channel.warn(
                    content='Role `{}` does not exist!'.format(role_name))
            return
        # don't sent default (@everyone) or integration roles
        if role.is_integration() or role.is_default():
            if reply is True:
                await msg.channel.warn(
                    content='Cannot add integration or default roles!')
            return
        position = False
        # don't allow roles higher than bot's highest role
        for i in msg.guild.me.roles:
            if i.position > role.position:
                position = True
                break
        if not position:
            if reply is True:
                await msg.channel.warn((
                    'Role `{}` has higher position than my highest role!'
                ).format(role.name))
            return
        # roles with these permissions not allowed
        not_allowed = [
            'administrator', 'manage_guild',
            'manage_channels', 'manage_messages',
            'manage_nicknames', 'manage_webhooks',
            'manage_roles', 'ban_members', 'kick_members',
            'deafen_members', 'move_members'
        ]
        for i in not_allowed:
            if dict(iter(role.permissions))[i]:
                await msg.channel.warn(
                    content='Cannot manage roles with `{}` permission.'.format(
                        i))
                return
        return role

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}\n* {}\n* {}'.format(
            ('Initialize roles message with "{}roles <optional: title>"'
             ).format(prefix),
            'Add roles to the message by selecting them in a dropdown menu.',
            'Selecting an already added role will remove it.',
            '"reset" button will remove all the roles in the message.',
            '"commit" button will remove the menu and turn ' +
            'roles into buttons.',
            'Clicking on a button will give you the role, ' +
            'clicking again will remove it.',
            'You can edit the roles in a message by replying "edit".')

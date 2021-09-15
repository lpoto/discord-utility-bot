from commands.help import Help
import discord
from utils.misc import random_color
from utils.wrappers import EmbedWrapper
from utils.decorators import OnReply, OnButtonClick, ExecuteCommand

# TODO when sending a new roles message, it should have a dropdown
#      with all of the guild's roles, selecting them will add them
#      to the message, and then commiting will remove the dropdown
#      replying can reopen the dropdown


class Roles(Help):
    def __init__(self):
        super().__init__(name='roles')
        self.description = 'Add or remove roles with button clicks.'
        self.bot_permissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['manage_roles']

    @ExecuteCommand
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
        embed_var = await self.starting_embed(title=title, msg=msg)
        if embed_var is None:
            return
        await msg.channel.send(embed=embed_var)

    async def starting_embed(self, title, msg):
        m = EmbedWrapper.NOT_DELETABLE
        text = 'ROLES' if title is None else 'ROLES - {}'.format(title)
        embed_var = EmbedWrapper(discord.Embed(
            color=random_color()),
            info='* {}\n* {}\n{}'.format(
                'Reply with a role to add it to the message.',
                'You can add multiple at once, separated with ";".',
                'Example: "role1;role2;role3"'),
            embed_type='{}{}{}'.format(
                text, (60 - len(text + m)) * '\u2000', m))
        return embed_var

    @OnReply
    async def manage_roles_in_message(self, msg, roles_message):
        if not roles_message.is_roles:
            return
        # multiple replies can be added at once separated with ";"
        for i in msg.content.split(';'):
            # do not allow empty responses
            if len(i) == 0:
                continue
            try:
                await self.roles_existing_message(
                    i.strip(), roles_message.channel, roles_message.id)
            except ValueError as err:
                if str(err) == 'could not find open space for item':
                    await msg.channel.warn(
                        'There can be only 5 rows of buttons!')
                    return
                else:
                    raise ValueError(err)

    async def roles_existing_message(self, arg, channel, msg_id):
        msg = await channel.fetch_message(int(msg_id))
        if not msg:
            return
        if arg.startswith('remove '):
            await self.remove_role_from_msg(msg, arg)
            return
        rl = await self.valid_role(arg, msg)
        if rl is None:
            return
        components = []
        for i in msg.components:
            for j in i.children:
                if j.label == rl.name:
                    return
                components.append(discord.ui.Button(label=j.label))
        components.append(discord.ui.Button(label=rl.name))
        if msg.embeds[0].footer.text:
            msg.embeds[0].set_footer(text=discord.Embed.Empty)
            await msg.edit(embed=msg.embeds[0], components=components)
        else:
            await msg.edit(components=components)

    @OnButtonClick
    async def add_remove_role(self, button, msg, user, webhook):
        if not msg.is_roles:
            return
        role = await self.valid_role(button.label, msg, False)
        if role is None:
            return
        rl = user.get_role(role.id)
        txt = None
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

    async def valid_role(self, pot_role, msg, reply=True):
        # check if role exists and if bot can add such a role
        role = None
        for i in msg.guild.roles:
            if i.name == pot_role:
                role = i
                break
        if role is None and not reply:
            return
        if role is None:
            await msg.channel.warn(
                content='Role `{}` does not exist!'.format(pot_role))
            return
        # don't sent default (@everyone) or integration roles
        if role.is_integration() or role.is_default():
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
            await msg.channel.warn(
                'Role `{}` has higher position than my highest role!'.format(
                    role.name))
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

    async def remove_role_from_msg(self, msg, arg):
        if len(msg.embeds[0].fields) == 1:
            await msg.channel.warn(
                content='Cannot remove the only role in the message!')
            return
        args = arg.split()
        if len(args) < 2:
            await msg.channel.warn(
                content='Please provide a role you want to remove.')
            return
        name = arg.replace('{} '.format(args[0]), '', 1)
        found = False
        components = []
        for i in msg.components:
            for j in i.children:
                if j.label == name:
                    found = True
                else:
                    components.append(discord.ui.Button(label=j.label))
        if found is False:
            await msg.channel.warn(
                content='There is no role `{}` in the message.'.format(name))
            return
        await msg.edit(components=components)

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}'.format(
            ('Initialize roles message with "{}roles <optional: title>"'
             ).format(prefix),
            'Add roles to the message by replying (examle in the message).',
            'Clicking on the role adds the role or removes it if you  ' +
            'already have it.',
            'Remove role from the message by replying "remove <role_name>"')

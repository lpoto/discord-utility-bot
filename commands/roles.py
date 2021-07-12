import discord
from command import Command
from utils import *


class Roles(Command):
    def __init__(self):
        super().__init__('roles')
        self.description = 'Add or remove roles.'
        self.bot_ermissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['send_messages', 'manage_roles']

    async def execute_command(self, msg):
        try:
            args = msg.content.split()
            # check if valid arguments in message content
            role_channel = await self.check_valid_arguments(msg, args)
            if role_channel is None:
                return
            existing_msg = await self.check_existing_message(
                msg, args, role_channel)
            idx = 0
            if existing_msg is not None:
                args = args[:(len(args) - 1)]
                idx = existing_msg[1]
                existing_msg = existing_msg[0]
                if args[1] == 'remove' or args[1] == 'delete':
                    return await self.remove_role_from_msg(
                        msg, args, existing_msg)
            content = ''
            # add multiple roles at once, separated with ;
            roles = ' '.join(args[1:]).split(';')
            if (len(roles) + idx >= len(emojis.keys()) - 1):
                txt = 'Cannot add that many at once!'
                await message_delete(msg, 5, txt)
                return
            r_emojis = []
            existing_content = None
            for i in range(len(roles)):
                rl = await self.valid_role(roles[i].strip(), msg)
                # cannot manage roles with certain permissions,
                # or roles higher than bot's highest role
                if rl is None:
                    return
                roles[i] = str(rl)
                r_emojis.append(list(emojis.keys())[i + idx])
                if existing_msg is not None:
                    # if editing existing message, check for hidden text
                    # that containts indexes of removed emojis, that can be
                    # reused. Indexes are separated with "a"
                    if existing_content is None:
                        existing_content = existing_msg.content.split('\n')
                    hidden_txt = existing_content[0][3:]
                    if hidden_txt != '':
                        hidden_txt = hidden_txt.split('a')
                        r_emojis[i] = list(emojis.keys())[int(hidden_txt[0])]
                        hidden_txt = 'a'.join(hidden_txt[1:])
                    existing_content[0] = '```{}'.format(hidden_txt)
                # add emoji and role to the new content
                content += '```\n{} {} ```'.format(
                    r_emojis[i], str(rl))
            # send the name of the roles to che role-managing channel
            if existing_msg is None:
                existing_msg = await role_channel.send(content)
                await msg.channel.send('Added `{}` to `{}`.'.format(
                    ', '.join(roles),
                    role_channel.name))
            else:
                await message_edit(
                    existing_msg, '\n'.join(existing_content) + content)
                await msg.channel.send(
                    'Added `{}` to an existing message in `{}`.'.format(
                        ', '.join(roles),
                        role_channel.name))
            for i in range(len(roles)):
                await message_react(existing_msg, r_emojis[i])
        except Exception as err:
            await send_error(msg, err, 'roles.py -> execute_command()')

    async def check_valid_arguments(self, msg, args):
        if len(args) < 2:
            txt = 'You need to provide a role!'
            await message_delete(msg, 5, txt)
            return None
        # fetch role-managing channel from database
        role_channel = await get_roleschannel(msg)
        if role_channel is None:
            txt = 'Role managing channel is not set up!'
            await message_delete(msg, 5, txt)
        return role_channel

    async def check_existing_message(self, msg, args, role_channel):
        # if message id added at the end, edit that message instead of
        # creating a new one
        try:
            existing_msg = await role_channel.fetch_message(args[-1])
            if existing_msg is None:
                return None
            if existing_msg.author.id != client.user.id:
                return None
            return (existing_msg, len(existing_msg.content.split('``````')))
        except Exception:
            return None

    async def on_raw_reaction(self, msg, payload):
        # listen for raw events and add or remove the role that matches
        # content of the message in the role-managing channel
        try:
            if payload.emoji.name not in emojis:
                return
            roles_channel = await get_roleschannel(msg)
            if roles_channel is None or msg.channel.id != roles_channel.id:
                return
            role = None
            rls = msg.content.replace('`', '').strip().split('\n')
            role = self.get_role(msg, rls, payload.emoji.name)
            if role is None:
                return
            # fetch user that reacted to the role message
            user = await msg.guild.fetch_member(payload.user_id)
            if user is None:
                return
            try:
                if payload.event_type == 'REACTION_ADD':
                    await user.add_roles(role)
                else:
                    await user.remove_roles(role)
            except Exception as err:
                if str(err.code) != '50013':
                    await send_error(
                        msg, err,
                        'roles.py -> execute_command() -> add/remove role')
        except Exception as err:
            await send_error(msg, err, 'roles.py -> on_raw_reaction()')

    def get_role(self, msg, rls, emoji):
        rl_name = None
        if len(rls) == 1:
            if emoji != list(emojis.keys())[0]:
                return None
            if rls[0].startswith(emoji):
                rl_name = rls[0].replace(emoji, '', 1).strip()
            else:
                rl_name = rls[0].strip()
        else:
            for i in rls:
                if i.startswith(emoji):
                    rl_name = i.replace(emoji, '', 1).strip()
                    break
        for i in msg.guild.roles:
            if rl_name == i.name:
                return i
        return None

    async def valid_role(self, pot_role, msg):
        try:
            role = None
            # search existing roles in server
            for i in range(len(msg.guild.roles)):
                if msg.guild.roles[i].name.lower() == pot_role.lower():
                    role = msg.guild.roles[i]
                    break
            if role is None:
                txt = 'Role `{}` does not exist!'.format(pot_role)
                await message_delete(msg, 5, txt)
                return None
            # don't sent default (@everyone) or integration roles
            if role.is_integration() or role.is_default():
                txt = 'Cannot add integration or default roles!'
                await message_delete(msg, 5, txt)
                return None
            position = False
            # don't allow roles higher than bot's highest role
            for i in msg.guild.me.roles:
                if i.position > role.position:
                    position = True
                    break
            if not position:
                txt = 'This roles has higher position than my highest role!'
                await message_delete(msg, 5, txt)
                return None
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
                    txt = 'Cannot manage roles with `{}` permission.'.format(i)
                    await message_delete(msg, 5, txt)
                    return None
            return role
        except Exception as err:
            await send_error(msg, err, 'roles.py -> valid_role()')

    async def remove_role_from_msg(self, msg, args, existing_msg):
        try:
            roles = existing_msg.content.split('\n')
            hidden_txt = roles[0][3:]
            roles = '\n'.join(roles[1:])[:-3].split('``````')
            if len(roles) == 1:
                txt = 'Cannot remove the only role in the message!'
                await message_delete(msg, 5, txt)
                return
            n = args[2]
            try:
                n = int(n)
            except ValueError:
                txt = ('You can only remove roles from message by their ' +
                       'indexes in the message (starting with 0)')
                await message_delete(msg, 5, txt)
                return
            if 0 > n or n >= len(roles):
                txt = 'Indexes in the message go from 0 to {}'.format(
                    len(roles) - 1)
                await message_delete(msg, 5, txt)
                return
            emoji = roles[n].split()[0]
            del roles[n]
            await existing_msg.remove_reaction(emoji, client.user)
            if hidden_txt != '':
                hidden_txt = '{}a{}'.format(
                    hidden_txt, list(emojis.keys()).index(emoji))
            else:
                hidden_txt = list(emojis.keys()).index(emoji)
            await message_edit(existing_msg, '```{}\n{}```'.format(
                hidden_txt,  '``````'.join(roles)))
        except Exception as err:
            await send_error(msg, err, 'roles.py -> remove_role_from_msg()')

    def additional_info(self, prefix):
        return '{}\n{}\n{}\n{}\n{}\n{}'.format(
            ('* "{}roles ROLE-NAME" will send the name of the role to ' +
             'role-managing channel (it must be defined with ' +
             'config command).').format(prefix),
            '* Multiple roles can be added at once, separated with ";".',
            '* Reacting to that message with the same reaction that the ' +
            'bot reacted with, will give you that role (or remove it when ' +
            'removing the reaction).',
            '* Adding <msg_id> at the end of the command message will "' +
            'add roles to the existing message, instead of sending another.',
            ('* "{}roles remove <index> <msg_id>" ' +
                'removes role from message.').format(prefix),
            '* This only works on existing roles that that bot is ' +
            'allowed to manage.')


Roles()

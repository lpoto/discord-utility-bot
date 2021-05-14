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
            if len(args) < 2:
                txt = 'You need to provide a role!'
                await message_delete(msg, 5, txt)
                return
            # if first argument new or add create new role
            if args[1] == 'new' or args[1] == 'add':
                return await self.create_role(' '.join(args[2:]), msg)
            # fetch role-managing channel from database
            role_channel = await get_roleschannel(msg)
            if role_channel is None:
                txt = 'Role managing channel is not set up!'
                await message_delete(msg, 5, txt)
                return
            existing_msg = await self.check_existing_message(
                msg, args, role_channel)
            idx = 0
            if existing_msg is not None:
                args = args[:(len(args) - 2)]
                idx = existing_msg[1]
                existing_msg = existing_msg[0]
            content = ''
            # add multiple roles at once, separated with ;
            roles = ' '.join(args[1:]).split(';')
            if (len(roles) + idx >= len(emojis.keys()) - 1):
                txt = 'Cannot add that many at once!'
                await message_delete(msg, 5, txt)
                return
            for i in range(len(roles)):
                rl = await self.valid_role(roles[i].strip(), msg)
                # cannot manage roles with certain permissions,
                # or roles higher than bot's highest role
                if rl is None:
                    txt = 'Invalid role!'
                    await message_delete(msg, 5, txt)
                    return
                if rl is False:
                    return
                roles[i] = str(rl)
                content += '```\n{} {} ```'.format(
                    list(emojis.keys())[i + idx], str(rl))
            # sent the name of the roles to che role-managing channel
            # react to it with default emoji
            if existing_msg is None:
                existing_msg = await role_channel.send(content)
            else:
                await message_edit(
                    existing_msg, existing_msg.content + content)
            for i in range(len(roles)):
                await message_react(existing_msg, list(emojis.keys())[i + idx])
            await msg.channel.send('Added `{}` to `{}`.'.format(
                ', '.join(roles),
                role_channel.name))
        except Exception as err:
            await send_error(msg, err, 'roles.py -> execute_command()')

    async def check_existing_message(self, msg, args, role_channel):
        # if message id added at the end, edit that message instead of
        # creating a new one
        try:
            if (args[-2] != 'msg' and args[-2] == 'msg:' and
                    args[-2] == 'message'):
                return None
            existing_msg = await role_channel.fetch_message(args[-1])
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

    async def create_role(self, name, msg):
        try:
            # a name for the role must be provided
            if name is None or name == '':
                txt = 'Please provide a name of the new role!'
                await message_delete(msg, 5, txt)
                return
            # check if role with the same name exists
            for i in range(len(msg.guild.roles)):
                if msg.guild.roles[i].name.lower() == name.lower():
                    txt = 'This role already exists!'
                    await message_delete(msg, 5, txt)
                    return
            await msg.guild.create_role(name=name)
            await msg.channel.send('Created new role: `{}`'.format(name))
        except Exception as err:
            await send_error(msg, err, 'roles.py -> create_role()')

    async def valid_role(self, pot_role, msg):
        try:
            role = None
            # search existing roles in server
            for i in range(len(msg.guild.roles)):
                if msg.guild.roles[i].name.lower() == pot_role.lower():
                    role = msg.guild.roles[i]
                    break
            # don't sent default (@everyone) or integration roles
            if role is None or role.is_integration() or role.is_default():
                return None
            position = False
            # don't allow roles higher than bot's highest role
            for i in msg.guild.me.roles:
                if i.position > role.position:
                    position = True
                    break
            if not position:
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
                    return False
            return role
        except Exception as err:
            await send_error(msg, err, 'roles.py -> valid_role()')

    def additional_info(self):
        return '{}\n{}\n{}\n{}\n{}'.format(
            '* "roles ROLE-NAME" will send the name of the role to ' +
            'role-managing channel (it must be defined with config command).',
            '* Multiple roles can be added at once, separated with ";".',
            '* Reacting to that message with the same reaction that the ' +
            'bot reacted with will give you that role (or remove it when ' +
            'removing the reaction).',
            '* This only works on existing roles that that bot is ' +
            'allowed to manage.',
            '* Create new role with "roles new ROLE-NAME".')


Roles()

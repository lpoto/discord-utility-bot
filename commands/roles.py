import discord
from command import Command
from utils import *


class Roles(Command):
    def __init__(self):
        super().__init__('roles')
        self.description = 'Add or remove roles.'
        self.bot_permissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['send_messages', 'manage_roles']

    async def execute_command(self, msg):
        try:
            args = msg.content.split()
            if len(args) < 2:
                txt = 'You need to provide a role!'
                await message_delete(msg, 5, txt)
                return
            role = await self.valid_role(' '.join(args[1:]), msg)
            if role is None:
                txt = 'Invalid role!'
                await message_delete(msg, 5, txt)
                return
            role_channel = await get_roleschannel(msg)
            if role_channel is None:
                txt = 'Role managing channel is not set up!'
                await message_delete(msg, 5, txt)
                return
            new_msg = await role_channel.send('`{}`'.format(role.name))
            await message_react(new_msg, emojis['white_circle'])
            await msg.channel.send('Added `{}` to `{}`.'.format(
                role.name,
                role_channel.name))
        except Exception as err:
            await send_error(msg, err, 'roles.py -> execute_command()')

    async def on_raw_reaction(self, msg, payload):
        try:
            if payload.emoji.name != emojis['white_circle']:
                return
            roles_channel = await get_roleschannel(msg)
            if roles_channel is None or msg.channel.id != roles_channel.id:
                return
            role = None
            for i in msg.guild.roles:
                if msg.content[1:][:-1] == i.name:
                    role = i
            if role is None:
                return
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

    async def valid_role(self, pot_role, msg):
        try:
            role = None
            for i in range(len(msg.guild.roles)):
                if msg.guild.roles[i].name.lower() == pot_role.lower():
                    role = msg.guild.roles[i]
                    break
            if role is None or role.is_integration() or role.is_default():
                return None
            position = False
            for i in msg.guild.me.roles:
                if i.position > role.position:
                    position = True
            if not position:
                return None
            not_allowed = [
                'administrator', 'manage_guild',
                'manage_channels', 'manage_messages',
                'manage_nicknames', 'manage_webhooks',
                'manage_roles', 'ban_members', 'kick_members',
                'deafen_members', 'move_members'
            ]
            for i in not_allowed:
                if dict(iter(role.permissions))[i]:
                    return None
            return role
        except Exception as err:
            await send_error(msg, err, 'roles.py -> valid_role()')

    def additional_info(self):
        return '{}\n{}'.format(
            '* deleting messages older than 14 days takes longer.',
            '* Pinned messages will not be deleted.')


Roles()

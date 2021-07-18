import discord
from command import Command
from utils import *


class Roles(Command):
    def __init__(self):
        super().__init__('roles')
        self.description = 'Add or remove roles.'
        self.bot_ermissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['send_messages', 'manage_roles']
        self.roles_queue = {}

    async def execute_command(self, msg):
        try:
            args = msg.content.split()
            if len(args) < 2:
                txt = 'You need to provide a role!'
                await message_delete(msg, 5, txt)
                return
            # check if added roles (one or multiple
            # separated with ;)
            # are valid roles, and if they are, send them to the channel
            # and react with emojis (max 20)
            roles = []
            x = ' '.join(args[1:]).split(';')
            for i in range(len(x)):
                rl = await self.valid_role(x[i], msg)
                if rl is None:
                    continue
                roles.append("\n{} {}".format(emojis[i], rl))
                if len(roles) >= len(emojis):
                    break
            if roles == []:
                return
            # every role message should start with '```roles'
            new_msg = await msg.channel.send('```roles{}```'.format(
                '``````'.join(roles)))
            for i in range(len(roles)):
                await message_react(new_msg, emojis[i])
        except Exception as err:
            await send_error(msg, err, 'roles.py -> execute_command()')

    async def on_message(self, msg, bot):
        # edit an existing message with roles by replying to it
        # replying a new role will add another role
        # replying remove <idx> will remove role with idx from message
        # multiple command at once separated by ';'
        try:
            if not await bot.check_if_valid(
                    bot.commands[self.name], msg):
                return
            # message must be a reply to a roles message
            if msg.reference is None or not msg.reference.message_id:
                return
            roles_message = await msg.channel.fetch_message(
                msg.reference.message_id)
            if (roles_message is None or
                    roles_message.author.id != client.user.id or
                    not roles_message.content.startswith('```roles')):
                return
            if roles_message.id not in []:
                self.roles_queue[roles_message.id] = []
            for i in msg.content.split(';'):
                self.roles_queue[roles_message.id].append((
                    i, roles_message))
            # process the commands in a queue, to avoid multiple edits
            # that might negate each other
            await clear_queue(
                'roles_messages({})'.format(roles_message.id),
                False,
                self.roles_queue[roles_message.id],
                self.roles_existing_message)
            if self.roles_queue[roles_message.id] == []:
                del self.roles_queue[roles_message.id]
        except Exception as err:
            await send_error(None, err, 'roles.py -> on_message()')

    async def roles_existing_message(self, queue):
        # function to process queue, editing existing message with roles
        try:
            info = queue.pop(0)
            arg = info[0].strip()
            msg = info[1]
            # if arg starts with remove remove role with index args[1]
            # from message, else add a new role to the message
            if arg.startswith('remove '):
                await self.remove_role_from_msg(msg, arg)
                return
            rl = await self.valid_role(arg, msg)
            if rl is None:
                txt = 'Role `{}` does not exist!'.format(arg)
                await message_delete(msg, 3, txt)
                return
            x = msg.content[:-3].split('\n')
            hidden_txt = x[0][8:]
            roles = ('\n' + '\n'.join(x[1:])).split('``````')
            if len(roles) >= len(emojis):
                txt = 'There can be only `{}` roles in one message!'.format(
                    len(emojis))
                await message_delete(msg, 5, txt)
                return
            emoji = emojis[len(roles)]
            # hidden txt (```roles<hidden_txt>\n) contains info
            # about removed emojis so they can be reused
            # emoji indexes separated with 'a'
            if hidden_txt != '':
                hidden_txt = hidden_txt.split('a')
                emoji = emojis[int(hidden_txt[0])]
                del hidden_txt[0]
                hidden_txt = 'a'.join(hidden_txt)
            roles.append('\n{} {}'.format(emoji, rl))
            await message_edit(msg, '```roles{}```'.format(
                '``````'.join(roles)))
            await message_react(msg, emoji)
        except Exception as err:
            await send_error(None, err, 'roles.py -> roles_existing_msg()')

    async def on_raw_reaction(self, msg, payload):
        # listen for raw events and add or remove the role that matches
        # content of the roles message
        try:
            if (payload.emoji.name not in emojis or
                    not msg.content.startswith('```roles')):
                return
            role = None
            roles = (msg.content.replace('`', '')).replace(
                'roles', '').strip().split('\n')
            role = self.get_role(msg, roles, payload.emoji.name)
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

    def get_role(self, msg, roles, emoji):
        # find the role in the message in the guild's roles
        rl_name = None
        if len(roles) == 1:
            if emoji != emojis[0]:
                return None
            if roles[0].startswith(emoji):
                rl_name = roles[0].replace(emoji, '', 1).strip()
            else:
                rl_name = roles[0].strip()
        else:
            for i in roles:
                if i.startswith(emoji):
                    rl_name = i.replace(emoji, '', 1).strip()
                    break
        for i in msg.guild.roles:
            if rl_name == i.name:
                return i
        return None

    async def valid_role(self, pot_role, msg):
        # check if role exists and if bot can add such a role
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

    async def remove_role_from_msg(self, msg, arg):
        # remove role from message
        # save the removed reaction index in the hidden text,
        # so it can be reused
        try:
            args = arg.split()
            x = msg.content[:-3].split('\n')
            hidden_txt = x[0][8:]
            roles = ('\n' + '\n'.join(x[1:])).split('``````')
            if len(roles) == 1:
                txt = 'Cannot remove the only role in the message!'
                await message_delete(msg, 5, txt)
                return
            n = args[1]
            # role can be removed by it's index in the message
            try:
                n = int(n)
                if 0 > n or n >= len(roles):
                    raise ValueError
            except ValueError:
                txt = ('Roles can only be removed by indexes from ' +
                       '`{}` to `{}`.').format(0, len(roles) - 1)
                await message_delete(msg, 5, txt)
                return
            emoji = roles[n].split()[0]
            del roles[n]
            # remove the bot's reaction the belongs to the removed role
            await message_remove_reaction(msg, emoji, client.user, True)
            if hidden_txt != '':
                hidden_txt = '{}a{}'.format(
                    hidden_txt, emojis.index(emoji))
            else:
                hidden_txt = emojis.index(emoji)
            await message_edit(msg, '```roles{}{}```'.format(
                hidden_txt,  '``````'.join(roles)))
        except Exception as err:
            await send_error(msg, err, 'roles.py -> remove_role_from_msg()')

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}'.format(
            ('"{}roles role1;role2;role3;..." sends a message with ' +
             'role1, role2, ... to the channel.').format(prefix),
            'Reacting to a role will give you the role, removing the ' +
            'reaction will remove that role from you.',
            'Replying to a message containing roles with a role will ' +
            'add that role to the message.',
            'Replying "remove <idx>" will remove role with index <idx> ' +
            'from the message.',
            'You can reply with multiple commands at once, separated ' +
            'with ";" ("role1;role2;remove 0;role3;...")')

        pass


Roles()

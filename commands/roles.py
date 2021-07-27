from commands.help import Help
from utils import emojis


class Roles(Help):
    def __init__(self):
        super().__init__(name='roles')
        self.description = 'Add or remove roles.'
        self.bot_permissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['send_messages', 'manage_roles']
        self.roles_queue = {}

    async def execute_command(self, msg):
        args = msg.content.split()
        if len(args) < 2:
            await msg.channel.send(
                text='You need to provide a role!',
                delete_after=5)
            return
        # check if added roles (one or multiple
        # separated with ;)
        # are valid roles, and if they are, send them to the channel
        # and react with emojis (max 20)
        roles = []
        x = msg.content.replace('{} '.format(args[0]), '', 1).split(';')
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
        await msg.channel.send(
            text='```roles{}```'.format(
                '``````'.join(roles)),
            reactions=[emojis[i] for i in range(len(roles))])

    async def on_reply(self, msg, roles_message):
        # edit an existing message with roles by replying to it
        # replying a new role will add another role
        # replying remove <idx> will remove role with idx from message
        # multiple command at once separated by ';'
        if not roles_message.content.startswith('```roles'):
            return
        for i in msg.content.split(';'):
            await self.bot.queue.add_to_queue(
                queue_id=roles_message.id,
                item=(i, roles_message.channel.id, roles_message.id),
                function=self.roles_existing_message)

    async def roles_existing_message(self, item):
        # function to process queue, editing existing message with roles
        arg = item[0].strip()
        channel_id = item[1]
        msg_id = item[2]
        channel = self.bot.client.get_channel(int(channel_id))
        if channel is None:
            return
        msg = await channel.fetch_message(int(msg_id))
        if msg is None:
            return
        # if arg starts with remove remove role with index args[1]
        # from message, else add a new role to the message
        if arg.startswith('remove '):
            await self.remove_role_from_msg(msg, arg)
            return
        rl = await self.valid_role(arg, msg)
        if rl is None:
            await msg.channel.send(
                text='Role `{}` does not exist!'.format(arg),
                delete_after=5)
            return
        x = msg.content[:-3].split('\n')
        hidden_txt = x[0][8:]
        roles = ('\n' + '\n'.join(x[1:])).split('``````')
        if len(roles) >= len(emojis):
            await msg.channel.send(
                text='There can be only `{}` roles in one message!'.format(
                    len(emojis)),
                delete_after=5)
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
        await msg.edit(
            text='```roles{}```'.format('``````'.join(roles)),
            reactions=emoji)

    async def on_raw_reaction(self, msg, payload):
        # listen for raw events and add or remove the role that matches
        # content of the roles message
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
        if payload.event_type == 'REACTION_ADD':
            await user.add_roles(role)
        else:
            await user.remove_roles(role)

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
        role = None
        # search existing roles in server
        for i in range(len(msg.guild.roles)):
            if msg.guild.roles[i].name.lower() == pot_role.lower():
                role = msg.guild.roles[i]
                break
        if role is None:
            await msg.channel.send(
                text='Role `{}` does not exist!'.format(pot_role),
                delete_after=5)
            return
        # don't sent default (@everyone) or integration roles
        if role.is_integration() or role.is_default():
            await msg.channel.send(
                text='Cannot add integration or default roles!',
                delete_after=5)
            return
        position = False
        # don't allow roles higher than bot's highest role
        for i in msg.guild.me.roles:
            if i.position > role.position:
                position = True
                break
        if not position:
            await msg.channel.send(
                text='This roles has higher position than my highest role!',
                delete_after=5)
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
                await msg.channel.send(
                    text='Cannot manage roles with `{}` permission.'.format(i),
                    delete_after=5)
                return
        return role

    async def remove_role_from_msg(self, msg, arg):
        # remove role from message
        # save the removed reaction index in the hidden text,
        # so it can be reused
        args = arg.split()
        x = msg.content[:-3].split('\n')
        hidden_txt = x[0][8:]
        roles = ('\n' + '\n'.join(x[1:])).split('``````')
        if len(roles) == 1:
            await msg.channel.send(
                text='Cannot remove the only role in the message!',
                delete_after=5)
            return
        n = args[1]
        # role can be removed by it's index in the message
        try:
            n = int(n)
            if 0 > n or n >= len(roles):
                raise ValueError
        except ValueError:
            await msg.channel.send(
                text=('Roles can only be removed by indexes from ' +
                      '`{}` to `{}`.').format(0, len(roles) - 1),
                delete_after=5)
            return
        emoji = roles[n].split()[0]
        del roles[n]
        # remove the bot's reaction the belongs to the removed role
        await msg.remove_reaction(emoji=emoji)
        if hidden_txt != '':
            hidden_txt = '{}a{}'.format(
                hidden_txt, emojis.index(emoji))
        else:
            hidden_txt = emojis.index(emoji)
        await msg.edit(
            text='```roles{}{}```'.format(hidden_txt,  '``````'.join(roles)))

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

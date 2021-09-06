from commands.help import Help
import discord
from utils.misc import emojis, random_color


class Roles(Help):
    def __init__(self):
        super().__init__(name='roles')
        self.description = 'Add or remove roles with button clicks.'
        self.bot_permissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['send_messages', 'manage_roles']
        self.roles_queue = {}

    async def execute_command(self, msg):
        args = msg.content.split()
        title = None
        if len(args) > 1:
            title = msg.content.replace('{} '.format(args[0]), '', 1)
        embed_var = await self.starting_embed(title=title, msg=msg)
        if embed_var is None:
            return
        await msg.channel.send(
            embed=embed_var,
            reactions=[emojis[i] for i in range(len(embed_var.fields))])

    async def starting_embed(self, title, msg):
        embed_var = discord.Embed(
                color=random_color(),
                description='* {}\n* {}\n{}'.format(
                    'Reply with a role to add it to the message.',
                    'You can add multiple at once, separated with ";".',
                    'Example: "role1;role2;role3"'))
        text = 'ROLES'
        if title:
            text += ' - ' + title
        text = text + (70 - len(text)) * '\u2000' + 'ND'
        embed_var.set_footer(text=text)
        return embed_var

    async def on_reply(self, msg, roles_message):
        if not roles_message.is_roles:
            return
        for i in msg.content.split(';'):
            await self.bot.queue.add_to_queue(
                queue_id='rolesmessage:{}'.format(roles_message.id),
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
        msg.embeds[0].description = None
        await msg.edit(embed=msg.embeds[0], components=components)

    async def on_button_click(self, button, msg, user):
        if not msg.is_roles:
            return
        role = await self.valid_role(button.label, msg)
        if role is None:
            return
        rl = user.get_role(role.id)
        components1 = []
        components2 = []
        for i in msg.components:
            for j in i.children:
                components1.append(
                        discord.ui.Button(label=j.label))
                if j.label != button.label:
                    components2.append(discord.ui.Button(
                        label=j.label))
                elif rl is None:
                    components2.append(discord.ui.Button(
                        label=j.label,
                        style=discord.ButtonStyle.green))
                else:
                    components2.append(discord.ui.Button(
                        label=j.label,
                        style=discord.ButtonStyle.red))
        if rl is None:
            await user.add_roles(role)
        else:
            await user.remove_roles(role)
        await msg.edit(embed=msg.embeds[0], components=components2)
        await msg.edit(embed=msg.embeds[0], components=components1)

    async def valid_role(self, pot_role, msg):
        # check if role exists and if bot can add such a role
        role = None
        # search existing roles in server
        for i in msg.guild.roles:
            if i.name == pot_role:
                role = i
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
        if len(msg.embeds[0].fields) == 1:
            await msg.channel.send(
                text='Cannot remove the only role in the message!',
                delete_after=5)
            return
        args = arg.split()
        if len(args) < 2:
            await msg.channel.send(
                text='Please provide a role you want to remove.',
                delete_after=5)
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
            await msg.channel.send(
                text='There is no role `{}` in the message.'.format(name),
                delete_after=5)
            return
        await msg.edit(embed=msg.embeds[0], components=components)

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}'.format(
            ('Initialize roles message with "{}roles <optional: title>"'
             ).format(prefix),
            'Add roles to the message by replying (examle in the message).',
            'Clicking on the role adds the role or removes it if you  ' +
            'already have it.',
            'Remove role from the message by replying "remove <role_name>"')

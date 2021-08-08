from commands.help import Help
import discord
from utils.misc import emojis, random_color
from utils.wrappers import EmbedWrapper


class Roles(Help):
    def __init__(self):
        super().__init__(name='roles')
        self.description = 'Add or remove roles.'
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
        embed_var = EmbedWrapper(
            discord.Embed(
                color=random_color(),
                description='* {}\n* {}\n{}'.format(
                    'Reply with a role to add it to the message.',
                    'You can add multiple at once, separated with ";".',
                    'Example: "role1;role2;role3"')),
            embed_type='ROLES',
            marks=EmbedWrapper.NOT_DELETABLE)
        if title is not None:
            embed_var.title = title
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
        idx = 0
        if len(msg.embeds[0].fields) > 0:
            idx = emojis.index(msg.embeds[0].fields[-1].value) + 1
        emoji = emojis[idx]
        if idx >= len(emojis):
            await msg.channel.send(
                text='Cannot add any more roles to the message!',
                delete_after=5)
            return
        msg.embeds[0].add_field(name=str(rl), value=emoji, inline=True)
        msg.embeds[0].description = None
        await msg.edit(embed=msg.embeds[0], reactions=emoji)

    async def on_raw_reaction(self, msg, payload):
        if not msg.is_roles:
            return
        # listen for raw events and add or remove the role that matches
        # content of the roles message
        role = None
        for i in msg.embeds[0].fields:
            if i.value == payload.emoji.name:
                role = await self.valid_role(i.name, msg)
                break
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

    async def valid_role(self, pot_role, msg):
        # check if role exists and if bot can add such a role
        role = None
        # search existing roles in server
        for i in range(len(msg.guild.roles)):
            if msg.guild.roles[i].name == pot_role:
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
        index = None
        emoji = None
        for i in range(len(msg.embeds[0].fields)):
            if msg.embeds[0].fields[i].name == name:
                index = i
                emoji = msg.embeds[0].fields[i].value
                break
        if index is None:
            await msg.channel.send(
                text='There is no role `{}` in the message.'.format(name),
                delete_after=5)
            return
        msg.embeds[0].remove_field(index)
        await msg.edit(embed=msg.embeds[0])
        await msg.remove_reaction(emoji)

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}'.format(
            ('Initialize roles message with "{}roles <optional: title>"'
             ).format(prefix),
            'Add roles to the message by replying (examle in the message).',
            'Reacting adds the role, removing the reaction removes the role.',
            'Remove role from the message bt replying "remove <role_name>"')

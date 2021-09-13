from commands.help import Help
import discord
from utils.misc import random_color


class Roles(Help):
    def __init__(self):
        super().__init__(name='roles')
        self.description = 'Add or remove roles with button clicks.'
        self.bot_permissions = ['send_messages', 'manage_roles']
        self.user_permissions = ['manage_roles']
        self.roles_queue = {}

    async def execute_command(self, msg):
        args = msg.content.split()
        title = None
        if len(args) > 1:
            title = msg.content.replace('{} '.format(args[0]), '', 1)
        embed_var = await self.starting_embed(title=title, msg=msg)
        if embed_var is None:
            return
        await msg.channel.send(embed=embed_var)

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

    def is_roles(self, msg):
        if (not len(msg.embeds) == 1 or
                not str(msg.channel.type) == 'text' or not
                msg.channel.guild.me.id == msg.author.id or
                msg.embeds[0].title or not msg.embeds[0].footer
                or not msg.embeds[0].footer.text or
                msg.embeds[0].footer.text.split()[-1] != 'ND' or
                msg.embeds[0].footer.text.split()[0] != 'ROLES'):
            return False
        return True

    async def on_reply(self, msg, roles_message):
        if not self.is_roles(roles_message):
            return
        # multiple replies can be added at once separated with ";"
        for i in msg.content.split(';'):
            # do not allow empty responses
            if len(i) == 0:
                continue
            # process adding resonses and such in a queue to avoid
            # missing any of the edits
            try:
                await self.bot.queue.add_to_queue(
                    queue_id='rolesmessage:{}'.format(roles_message.id),
                    item=(i, roles_message.channel.id, roles_message.id),
                    function=self.roles_existing_message)
            except ValueError as err:
                if str(err) == 'could not find open space for item':
                    await msg.channel.warn(
                        'There can be only 5 rows of buttons!')
                    return
                else:
                    raise ValueError(err)

    async def roles_existing_message(self, item):
        # function that is processed in a queue
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
        if msg.embeds[0].description:
            msg.embeds[0].description = None
            await msg.edit(embed=msg.embeds[0], components=components)
        else:
            await msg.edit(components=components)

    async def on_button_click(self, button, msg, user, webhook):
        if not self.is_roles(msg):
            return
        # process buttons in queue aswell
        await self.bot.queue.add_to_queue(
            queue_id='rolesmessage:{}'.format(msg.id),
            item=(msg.channel, msg.id, button, user, webhook),
            function=self.handle_button_clicks)

    async def handle_button_clicks(self, item):
        channel = item[0]
        msg = await channel.fetch_message(item[1])
        if not msg or not msg.guild:
            return
        button = item[2]
        user = item[3]
        webhook = item[4]
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
                text='Role `{}` does not exist!'.format(pot_role))
            return
        # don't sent default (@everyone) or integration roles
        if role.is_integration() or role.is_default():
            await msg.channel.warn(
                text='Cannot add integration or default roles!')
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
                    text='Cannot manage roles with `{}` permission.'.format(i))
                return
        return role

    async def remove_role_from_msg(self, msg, arg):
        if len(msg.embeds[0].fields) == 1:
            await msg.channel.warn(
                text='Cannot remove the only role in the message!')
            return
        args = arg.split()
        if len(args) < 2:
            await msg.channel.warn(
                text='Please provide a role you want to remove.')
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
                text='There is no role `{}` in the message.'.format(name))
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

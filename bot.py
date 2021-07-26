import discord
from utils import *


class Bot:
    def __init__(self, client):
        self.client = client
        self.database = None
        self.ready = False
        # dictionary containing all command objects as
        # values and their names as keys
        self.commands = {}
        self.on_reply_commands = []
        self.on_raw_reaction_commands = []
        self.on_dm_reaction_commands = []

    def add_command(self, command):
        # add a command object to commands dictionary
        # this is called when initializing a
        # Command object
        self.commands[command.name] = command
        # if commands have on raw reaction or on message
        # methods, add them to list
        if hasattr(command, 'on_reply'):
            self.on_reply_commands.append(command)
        if hasattr(command, 'on_raw_reaction'):
            self.on_raw_reaction_commands.append(command)
        if hasattr(command, 'on_dm_reaction'):
            self.on_dm_reaction_commands.append(command)

    async def handle_message(self, msg, cmd, prefix):
        args = msg.content.split()
        cmd = self.commands[cmd]
        # if 2nd word is help send additional info
        # about the command
        if len(args) > 1 and args[1] == 'help':
            await msg_send(
                channel=msg.channel,
                embed=await self.create_additional_help(
                    cmd.command_info(prefix), msg, prefix),
                reactions=waste_basket)
        else:
            # else execute the command
            # check if valid channel, permissions,...
            if await self.check_if_valid(cmd, msg):
                await cmd.execute_command(msg)

    async def handle_raw_reactions(self, payload, reaction_type, dm):
        if dm:
            # iterate through those commands that have
            # on dm reaction function
            for i in self.on_dm_reaction_commands:
                await i.on_dm_reaction(payload)
            return
        guild = discord.utils.get(
            self.client.guilds,
            id=payload.guild_id)
        if guild is None:
            return
        channel = discord.utils.get(
            guild.channels,
            id=payload.channel_id)
        if channel is None:
            return
        msg = await channel.fetch_message(payload.message_id)
        # onnly listen for reactions on bot's messages
        if msg.author.id != self.client.user.id:
            return
        # if wastebin reaction and bot is msg author
        # and message is not pinned and message has an
        # embed or starts with help, delete it
        if payload.emoji.name == waste_basket:
            if reaction_type == 'REACTION_ADD':
                await self.waste_basket_delete(msg)
            return
        # iterate through those commands that have
        # on raw reaction functinon
        for i in self.on_raw_reaction_commands:
            await i.on_raw_reaction(msg, payload)

    async def waste_basket_delete(self, msg):
        if (not msg.pinned and len(msg.embeds) > 0 and
                msg.author.id == msg.guild.me.id):
            edit_txt = 'Message has been deleted.'
            await msg_edit(
                msg=msg,
                text='Message has been deleted.',
                delete_after=3)

    async def check_if_valid(self, command, msg):
        # check if command can be used in this type of channel
        if str(msg.channel.type) not in command.channel_types:
            await msg_send(
                text='This command cannot be used in this channel type!',
                delete_after=5)
            return False
        # check for required permissions
        # and roles
        return await self.check_permissions(command, msg)

    async def check_permissions(self, command, msg):
        # check if bot has all the required permissions in the channel
        p = has_permissions(
            msg.guild.me, msg.channel, command.bot_permissions)
        if p is not True:
            await msg_send(
                text=('I need `{}` permission to use this command.'
                      ).format(p),
                delete_after=5)
            return False
        if has_permissions(msg.author, msg.channel, 'administrator'):
            return True
        # if command has required roles set up, override default
        # required permissions
        required_roles = await get_required_roles(
            msg, command.name, self.database)
        user_roles = [i.name for i in msg.author.roles]
        if required_roles is not None:
            for i in required_roles:
                if i in user_roles:
                    return True
            await msg_send(
                text=(
                    'This command can be used by the following roles:\n{}'
                ).format(', '.join(required_roles)),
                delete_after=5)
            return False

        # check if user has all the required permissions
        p = has_permissions(
            msg.author, msg.channel, command.user_permissons)
        if p is not True:
            await msg_send(
                text=(
                    'You need `{}` permission to use this command.'
                ).format(p),
                delete_after=5)
            return False
        return True

    async def create_additional_help(self, info, msg, prefix):
        idx = list(self.commands.keys()).index(info[0])
        embed_var = discord.Embed(
            title='Help: {}{}'.format(prefix, info[0]),
            description=info[1],
            color=colors[idx])
        embed_var.add_field(
            name='Additional info',
            value=info[2],
            inline=False)
        embed_var.add_field(
            name='Required permissions for bot',
            value='[{}]'.format(', '.join(info[3])),
            inline=False)
        roles = await get_required_roles(msg, info[0], self.database)
        if roles is None:
            embed_var.add_field(
                name='Required permissions for user',
                value='[{}]'.format(', '.join(info[4])),
                inline=False)
        else:
            embed_var.add_field(
                name='Roles that can use the command',
                value='[{}]'.format(', '.join(roles)),
                inline=False)
            embed_var.add_field(
                name='Allowed channel types',
                value='[{}]'.format(', '.join(info[5])),
                inline=False)
        return embed_var

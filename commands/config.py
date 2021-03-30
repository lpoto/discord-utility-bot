import discord
from command import Command
from bot import Managing_bot
from utils import *


class Config(Command):
    def __init__(self):
        super().__init__('config')
        self.description = "Change bot's settings."
        self.user_permissions = ['administrator']

    async def execute_command(self, msg):
        try:
            args = msg.content.split()
            if len(args) < 2:
                txt = 'No arguments provided.'
                await message_delete(msg, 5, txt)
                return
            if args[1] not in ['init', 'prefix', 'command', 'roleschannel']:
                txt = 'Invalid arguments.'
                await message_delete(msg, 5, txt)
                return
            channel = discord.utils.get(
                msg.guild.channels,
                name='bot-config')

            # if init, if bot-config text channel does not exist
            # and bot has manage_channels perms,
            # create a private channel
            # Add default settings to the channel
            if args[1] == 'init':
                await self.init_config(msg, channel)
                return
            if len(args) < 3:
                txt = 'No argument to option: `{}`.'.format(args[1])
                await message_delete(msg, 5, txt)
                return
            if channel is None:
                txt = 'There is no config channel.'
                await message_delete(msg, 5, txt)
                return
            settings = await channel.history(limit=3).flatten()
            prefix = None
            roleschannel = None
            commands = None

            # else edit configurations
            if args[1] == 'prefix':
                await self.set_prefix(msg, settings, args[2])
                return
            if args[1] == 'roleschannel':
                await self.set_roleschannel(msg, settings, args[2])
                return
            if args[1] == 'command':
                if len(args) < 4:
                    txt = 'Too few arguments.'
                    await message_delete(msg, 5, txt)
                    return
                await self.set_command(
                    msg,
                    settings,
                    args[2],
                    ' '.join(msg.content.split()[3:]))
                return
        except Exception as err:
            await send_error(msg, err, 'config.py -> execute_command()')

    def find_option(self, msg, settings, name):
        for m in settings:
            if (m.author.id == msg.guild.me.id and
                    m.content.startswith(name)):
                return m
        return None

    async def set_prefix(self, msg, settings, new_prefix):
        try:
            prefix_msg = self.find_option(msg, settings, '`PREFIX`')
            if prefix_msg is None:
                txt = 'No prefix option in config chanel'
                await message_delete(msg, 5, txt)
                return
            await message_edit(prefix_msg, '`PREFIX`\n{}'.format(new_prefix))
            await msg.channel.send(
                'Prefix changed to [{}].'.format(new_prefix))
        except Exception as err:
            await send_error(msg, err, 'config.py -> set_prefix()')

    async def set_roleschannel(self, msg, settings, x):
        try:
            new_channel = None
            for chnl in msg.guild.channels:
                if ((str(chnl.id) == x or x == chnl.name) and
                        str(chnl.type) == 'text'):
                    new_channel = chnl.name
            if new_channel is None:
                txt = 'Invalid channel.'
                await message_delete(msg, 5, txt)
                return
            roles_msg = self.find_option(msg, settings, '`ROLES CHANNEL`')
            if roles_msg is None:
                txt = 'No prefix option in config chanel.'
                await message_delete(msg, 5, txt)
                return
            await message_edit(
                roles_msg, '`ROLES CHANNEL`\n{}'.format(new_channel))
            await msg.channel.send(
                'Roles channel changed to [{}].'.format(new_channel))
        except Exception as err:
            await send_error(msg, err, 'config.py -> set_roleschannel()')

    async def set_command(self, msg, settings, cmd, new_roles):
        try:
            if cmd not in Managing_bot.commands:
                txt = 'Invalid command!'
                await message_delete(msg, 5, txt)
                return
            if new_roles != 'remove':
                guild_roles = [i.name for i in msg.guild.roles]
                roles = await self.valid_roles(msg, new_roles, guild_roles)
                if roles is None:
                    return
            roles_message = self.find_option(msg, settings, '`COMMANDS`')
            if roles_message is None:
                txt = 'No commands option in config channel.'
                await message_delete(msg, 5, txt)
                return
            content = roles_message.content.split('\n')
            if new_roles != 'remove':
                for i in content:
                    if i == '/' or i.startswith('`{}`'.format(cmd)):
                        content.remove(i)
                content.append('{}, {}'.format(
                    '`{}`'.format(cmd),
                    ', '.join(roles)))
                await message_edit(roles_message, '\n'.join(content))
                await msg.channel.send(
                    'Roles for `{}` changed to `{}`'
                    .format(cmd, ', '.join(roles)))
            else:
                for i in content:
                    if i.startswith('`{}`'.format(cmd)):
                        content.remove(i)
                if len(content) == 1:
                    content.append('/')
                await msg.channel.send(
                    'Removed roles for `{}`'
                    .format(cmd))
                await message_edit(roles_message, '\n'.join(content))
        except Exception as err:
            await send_error(msg, err, 'config.py -> set_command()')

    async def valid_roles(self, msg, new_roles, guild_roles):
        try:
            roles = []
            for i in new_roles.split(','):
                i = i.strip().lower()
                x = list(map(str.lower, guild_roles))
                if i not in x:
                    txt = 'Invalid role: {}'.format(i)
                    await message_delete(msg, 5, txt)
                    return None
                roles.append(guild_roles[x.index(i)])
            return roles
        except Exception as err:
            await send_error(msg, err, 'config.py -> valid_roles()')

    async def init_config(self, msg, channel):
        try:
            bot_perms = dict(iter(
                msg.guild.me.guild_permissions))
            if channel is None:
                if not bot_perms['manage_channels']:
                    txt = 'I need manage_channels permission!'
                    await message_delete(msg, 5, txt)
                    return
                overwrites = {
                    msg.guild.default_role: discord.PermissionOverwrite(
                        view_channel=False),
                    msg.guild.me: discord.PermissionOverwrite(
                        view_channel=True)
                }
                channel = await msg.guild.create_text_channel(
                    'bot-config',
                    overwrites=overwrites)
            await channel.send('`COMMANDS`\n/')
            await channel.send('`PREFIX`\n{}'.format(DEFAULT_PREFIX))
            await channel.send('`ROLES CHANNEL`\n/')
            new_msg = await msg.channel.send('Created default config!')
        except Exception as err:
            await send_error(msg, err, 'config.py -> init_config()')

    def additional_info(self):
        return "{}\n{}\n{}\n{}\n{}\n{}\n{}".format(
            '* Config required "bot-config" text channel.',
            '    - create it with "config init" (if the bot does not have ' +
            '"manage_channels" , manually create the channel first),',
            '    - config channel should only be used by the bot, as it ' +
            'will only read the last 3 messages in that channel,',
            '* "config prefix <key>" -> changes the key used before commands,',
            '* "config rolechannel <channel-name>" -> ' +
            'changes the channel used for managing roles,',
            '* "config command <command-name> <roles-seperated-with-comma>" ' +
            '-> sets which roles can use the command,',
            '* "config command <command-name> remove" -> ' +
            'removes roles for the command.'
        )


Config()

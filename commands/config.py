import discord
from command import Command
from bot import bot
from utils import *


class Config(Command):
    def __init__(self):
        super().__init__('config')
        self.description = "Change bot's settings."
        self.user_permissions = ['administrator']

    async def execute_command(self, msg):
        try:
            # check if database connected
            if not database.connected:
                txt = 'This command requires database connection!'
                await message_delete(msg, 5, txt)
                return
            args = msg.content.split()
            if len(args) < 2:
                txt = 'No arguments provided.'
                await message_delete(msg, 5, txt)
                return
            opts = {
                'prefix': self.set_prefix,
                'command': self.set_command,
                'welcome': self.set_welcome,
            }
            if args[1] not in list(opts.keys()):
                txt = 'Invalid arguments.'
                await message_delete(msg, 5, txt)
                return
            if len(args) < 3:
                txt = 'No argument to option: `{}`.'.format(args[1])
                await message_delete(msg, 5, txt)
                return
            # else edit configurations
            await self.edit_config(opts[args[1]], msg, args)
        except Exception as err:
            await send_error(msg, err, 'config.py -> execute_command()')

    async def edit_config(self, function, msg, args):
        await function(msg, args)

    async def set_prefix(self, msg, args):
        try:
            new_prefix = args[2]
            if len(new_prefix) > 5:
                txt = 'Prefix cannot be longer than 5 signs!'
                await message_delete(msg, 5, txt)
                return
            await self.edit_sql(
                "SELECT * FROM prefix WHERE guild_id = '{}'".format(
                    msg.guild.id),
                ("INSERT INTO prefix (guild_id, prefix) VALUES " +
                 "('{}', '{}')").format(
                    msg.guild.id, new_prefix),
                ("UPDATE prefix SET prefix = '{}' " +
                    "WHERE guild_id = '{}'").format(
                    new_prefix, msg.guild.id))
            await msg.channel.send(
                '`Prefix` changed to `{}`.'.format(new_prefix))
        except Exception as err:
            await send_error(msg, err, 'config.py -> set_prefix()')

    async def set_command(self, msg, args):
        try:
            if args[1] == 'command':
                if len(args) < 4:
                    txt = 'Too few arguments.'
                    await message_delete(msg, 5, txt)
                    return
            cmd = args[2]
            new_roles = ' '.join(args[3:])
            if cmd not in bot.commands:
                txt = 'Invalid command!'
                await message_delete(msg, 5, txt)
                return
            if len(cmd) > 50:
                txt = 'Role name too longs!'
                await message_delete(msg, 5, txt)
                return
            if new_roles != 'help' and len(new_roles) > 90:
                txt = 'Too many roles!'
                await message_delete(msg, 5, txt)
                return
            if new_roles == 'remove':
                query = ("DELETE FROM commands WHERE guild_id = '{}' AND " +
                         "command = '{}'").format(
                    msg.guild.id, cmd)
                cursor = database.cnx.cursor(buffered=True)
                cursor.execute(query)
                database.cnx.commit()
                cursor.close()
                await msg.channel.send(
                    'Removed roles for `{}`'
                    .format(cmd))
                return
            guild_roles = [i.name for i in msg.guild.roles]
            roles = await self.valid_roles(msg, new_roles, guild_roles)
            if roles is None:
                return
            await self.edit_sql(
                ("SELECT * FROM commands WHERE guild_id = '{}' " +
                 "AND command = '{}'").format(
                    msg.guild.id, cmd),
                ("INSERT INTO commands (guild_id, command, roles) VALUES " +
                 "('{}', '{}', '{}')").format(
                    msg.guild.id, cmd, '<;>'.join(roles)),
                ("UPDATE commands SET roles = '{}' " +
                    "WHERE guild_id = '{}' AND command = '{}'").format(
                    '<;>'.join(roles), msg.guild.id, cmd))
            await msg.channel.send(
                'Roles for `{}` changed to `{}`'
                .format(cmd, ', '.join(roles)))
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

    async def set_welcome(self, msg, args):
        try:
            new_txt = ' '.join(args[2:])
            if len(new_txt) < 1:
                return
            if new_txt == 'remove':
                query = "DELETE FROM welcome WHERE guild_id = '{}'".format(
                        msg.guild.id)
                cursor = database.cnx.cursor(buffered=True)
                cursor.execute(query)
                database.cnx.commit()
                cursor.close()
                await msg.channel.send(
                    'Removed `Welcome text`.')
                return
            await self.edit_sql(
                "SELECT * FROM welcome WHERE guild_id = '{}'".format(
                    msg.guild.id),
                ("INSERT INTO welcome (guild_id, welcome) VALUES " +
                 "('{}', '{}')").format(
                    msg.guild.id, new_txt),
                ("UPDATE welcome SET welcome = '{}' " +
                    "WHERE guild_id = '{}'").format(
                    new_txt, msg.guild.id))
            await msg.channel.send(
                '`Welcome text` changed to `{}`.'.format(new_txt))
        except Exception as err:
            await send_error(msg, err, 'config.py -> set_welcome()')

    async def edit_sql(self, select, insert, update):
        try:
            cursor = database.cnx.cursor(buffered=True)
            cursor.execute(select)
            fetched = cursor.fetchone()
            if fetched is None:
                cursor.execute(insert)
            else:
                cursor.execute(update)
            database.cnx.commit()
            cursor.close()
        except Exception as err:
            await send_error(None, err, 'config.py -> edit_sql()')

    def additional_info(self, prefix):
        return "{}\n{}\n{}\n{}\n{}".format(
            ('* "{}config prefix <key>" -> changes the key used ' +
             'before commands,').format(prefix),
            ('* "{}config command <command-name> <roles-seperated-' +
                'with-comma>" -> sets which roles ' +
                'can use the command,').format(prefix),
            ('* "{}config command <command-name> remove" -> ' +
             'removes roles for the command.').format(prefix),
            ('* "{}config welcome <welcome-text> -> ' +
             'Send welcome text on member join"').format(prefix),
            ('* "{}config welcome remove" -> remove welcome text').format(
                prefix)
        )


Config()

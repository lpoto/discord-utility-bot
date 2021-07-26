import discord
from command import Command
from utils import *


class Config(Command):
    def __init__(self):
        super().__init__('config')
        self.description = "Change bot's settings."
        self.user_permissions = ['administrator']

    async def execute_command(self, msg):
        # check if database connected
        if not self.bot.database.connected:
            await msg_send(
                channel=msg.channel,
                text='This command requires database connection!',
                delete_after=5)
            return
        args = msg.content.split()
        if msg.content.replace('{}'.format(args[0]), '', 1) in [
                ' see', ' show', '']:
            await msg_send(
                channel=msg.channel,
                embed=await self.create_config_embed(msg),
                reactions=[emojis[list(
                    self.bot.commands.keys()).index('server')], waste_basket])
            return
        if len(args) < 2:
            await msg_send(
                channel=msg.channel,
                text='No arguments provided.',
                delete_after=5)
            return
        opts = {
            'prefix': self.set_prefix,
            'command': self.set_command,
            'welcome': self.set_welcome,
        }
        if args[1] not in list(opts.keys()):
            await msg_send(
                channel=msg.channel,
                text='Invalid arguments.',
                delete_after=5)
            return
        if len(args) < 3:
            await msg_send(
                channel=msg.channel,
                text='No argument to option: `{}`.'.format(args[1]),
                delete_after=5)
            return
        # else edit configurations
        await self.edit_config(opts[args[1]], msg, args)

    async def edit_config(self, function, msg, args):
        await function(msg, args)

    async def create_config_embed(self, msg):
        embed_var = discord.Embed(
            title=msg.guild.name,
            description="Server configurations",
            color=colors[list(self.bot.commands.keys()).index('config')])
        prefix = await get_prefix(msg, self.bot.database)
        if prefix is None:
            prefix = DEFAULT_PREFIX
        embed_var.add_field(
            name='Prefix',
            value='[{}]'.format(prefix),
            inline=False)
        wlcm = await get_welcome(msg, self.bot.database)
        embed_var.add_field(
            name='Welcome_text',
            value='None' if wlcm is None else wlcm,
            inline=False)
        cmds = await roles_for_all_commands(msg, self.bot.database)
        embed_var.add_field(
            name='Roles that can use commands',
            value='None' if cmds is None else cmds,
            inline=False)
        embed_var.set_footer(
            text='React with {} to see server info.'.format(
                emojis[list(self.bot.commands.keys()).index('server')]))
        return embed_var

    async def on_raw_reaction(self, msg, payload):
        if (payload.event_type != 'REACTION_ADD' or msg.embeds == [] or
                payload.emoji.name != emojis[list(
                    self.bot.commands.keys()).index('config')] or
                msg.embeds[0].title != msg.guild.name or
                msg.embeds[0].description != 'Server information'):
            return
        await msg_reaction_remove(msg, waste_basket, msg.guild.me)
        await msg_edit(
            msg=msg,
            embed=await self.create_config_embed(msg),
            reactions=[emojis[list(
                self.bot.commands.keys()).index('server')], waste_basket])

    async def set_prefix(self, msg, args):
        new_prefix = args[2]
        if len(new_prefix) > 5:
            await send_msg(
                channel=msg.channel,
                text='Prefix cannot be longer than 5 signs!',
                delete_after=5)
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
        await msg_send(
            channel=msg.channel,
            text='`Prefix` changed to `{}`.'.format(new_prefix))

    async def set_command(self, msg, args):
        if args[1] == 'command':
            if len(args) < 4:
                await msg_send(
                    channel=msg.channel,
                    text='Too few arguments.',
                    delete_after=5)
                return
        cmd = args[2]
        new_roles = msg.content.remove(
            '{} {} '.format(args[0], args[1]), '', 1)
        if cmd not in self.bot.commands:
            await msg_send(
                channel=msg.channel,
                text='Invalid command!',
                delete_after=5)
            return
        if len(cmd) > 50:
            await msg_send(
                channel=msg.channel,
                text='Role name too long!',
                delete_after=5)
            return
        if new_roles != 'help' and len(new_roles) > 90:
            await msg_send(
                channel=msg.channel,
                text='Too many roles!',
                delete_after=5)
            return
        if new_roles == 'remove':
            query = ("DELETE FROM commands WHERE guild_id = '{}' AND " +
                     "command = '{}'").format(
                msg.guild.id, cmd)
            cursor = self.bot.database.cnx.cursor(buffered=True)
            cursor.execute(query)
            self.bot.database.cnx.commit()
            cursor.close()
            await msg_send(
                channel=msg.channel,
                test=(
                    'Removed roles for `{}`'
                ).format(cmd))
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

    async def valid_roles(self, msg, new_roles, guild_roles):
        roles = []
        for i in new_roles.split(','):
            i = i.strip().lower()
            x = list(map(str.lower, guild_roles))
            if i not in x:
                await msg_send(
                    channel=msg.channel,
                    text='Invalid role: {}'.format(i),
                    delete_after=5)
                return
            roles.append(guild_roles[x.index(i)])
        return roles

    async def set_welcome(self, msg, args):
        new_txt = msg.content.replace(
            '{} {} '.format(args[0], args[1]), '', 1)
        if len(new_txt) < 1:
            return
        if new_txt == 'remove':
            query = "DELETE FROM welcome WHERE guild_id = '{}'".format(
                    msg.guild.id)
            cursor = self.bot.database.cnx.cursor(buffered=True)
            cursor.execute(query)
            self.bot.database.cnx.commit()
            cursor.close()
            await msg_send(msg.channel, text='Removed `Welcome text`.')
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
        await msg_send(
            channel=msg.channel,
            text='`Welcome text` changed to `{}`.'.format(new_txt))

    async def edit_sql(self, select, insert, update):
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute(select)
        fetched = cursor.fetchone()
        if fetched is None:
            cursor.execute(insert)
        else:
            cursor.execute(update)
        self.bot.database.cnx.commit()
        cursor.close()

    def additional_info(self, prefix):
        return "* {}\n* {}\n* {}\n* {}\n* {}".format(
            ('"{}config prefix <key>" -> changes the key used ' +
             'before commands.').format(prefix),
            ('"{}config command <command-name> <roles-seperated-' +
                'with-comma>" -> sets which roles ' +
                'can use the command.').format(prefix),
            ('"{}config command <command-name> remove" -> ' +
             'removes roles for the command.').format(prefix),
            ('"{}config welcome <welcome-text> -> ' +
             'Send welcome text on member join"').format(prefix),
            ('"{}config welcome remove" -> removes welcome text.').format(
                prefix)
        )

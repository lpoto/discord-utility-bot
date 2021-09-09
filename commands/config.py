import discord
from commands.help import Help
from utils.misc import emojis, colors, delete_button
from utils.wrappers import EmbedWrapper


class Config(Help):
    def __init__(self):
        super().__init__('config')
        self.description = "Change bot's settings."
        self.user_permissions = ['administrator']
        self.synonyms = ['settings', 'options']
        self.requires_database = True

    async def execute_command(self, msg):
        # check if database connected
        args = msg.content.split()
        if msg.content.replace('{}'.format(args[0]), '', 1) in [
                ' see', ' show', '']:
            await msg.channel.send(
                embed=await self.create_config_embed(msg),
                components=[discord.ui.Button(label='server'),
                            delete_button()])
            return
        if not self.bot.database.connected:
            await msg.channel.warn(
                text='This command requires database connection!')
            return
        if len(args) < 2:
            await msg.channel.warn(
                text='No arguments provided.')
            return
        opts = {
            'prefix': self.set_prefix,
            'command': self.set_command,
            'welcome': self.set_welcome,
        }
        if args[1] not in list(opts.keys()):
            await msg.channel.warn(
                text='Invalid arguments.')
            return
        if len(args) < 3:
            await msg.channel.warn(
                text='No argument to option: `{}`.'.format(args[1]))
            return
        # else edit configurations
        await self.edit_config(opts[args[1]], msg, args)

    async def edit_config(self, function, msg, args):
        await self.bot.database.use_database(
            function, msg, args)

    async def create_config_embed(self, msg):
        embed_var = EmbedWrapper(discord.Embed(
            title=msg.guild.name,
            description="Server configurations",
            color=colors[list(self.bot.commands.keys()).index('config')]),
            embed_type='CONFIG',
            marks=['I'])
        if (msg.guild.icon):
            embed_var.set_thumbnail(url=msg.guild.icon)
        prefix = await self.bot.database.get_prefix(msg)
        embed_var.add_field(
            name='Prefix',
            value='[{}]'.format(prefix),
            inline=False)
        wlcm = await self.bot.database.get_welcome(msg)
        embed_var.add_field(
            name='Welcome_text',
            value='None' if wlcm is None else wlcm,
            inline=False)
        cmds = await self.bot.database.roles_for_all_commands(msg)
        embed_var.add_field(
            name='Roles that can use commands',
            value='None' if cmds is None else cmds,
            inline=False)
        embed_var.description += (
            '\n\nClick "server" to see server info.')
        return embed_var

    async def on_button_click(self, button, msg, user, interaction):
        if not msg.is_server:
            return
        await msg.edit(
            embed=await self.create_config_embed(msg),
            components=[
                discord.ui.Button(label='server'),
                delete_button()])

    async def on(self, msg, payload):
        if (payload.event_type != 'REACTION_ADD' or msg.embeds == [] or
                payload.emoji.name != emojis[list(
                    self.bot.commands.keys()).index('config')] or
                not msg.is_server):
            return
        await msg.edit(
            embed=await self.create_config_embed(msg),
            components=[
                discord.ui.Button(label='server'),
                delete_button()])

    async def set_prefix(self, cursor, msg, args):
        new_prefix = args[2]
        if len(new_prefix) > 5:
            await msg.channel.warn(
                text='Prefix cannot be longer than 5 signs!')
            return
        await self.edit_sql(
            cursor,
            "SELECT * FROM prefix WHERE guild_id = '{}'".format(
                msg.guild.id),
            ("INSERT INTO prefix (guild_id, prefix) VALUES " +
             "('{}', '{}')").format(
                msg.guild.id, new_prefix),
            ("UPDATE prefix SET prefix = '{}' " +
                "WHERE guild_id = '{}'").format(
                new_prefix, msg.guild.id))
        await msg.channel.notify(
            text='`Prefix` changed to `{}`.'.format(new_prefix),
            delete_after=False)

    async def set_command(self, cursor, msg, args):
        if args[1] == 'command':
            if len(args) < 4:
                await msg.channel.warn(
                    text='Too few arguments.')
                return
        cmd = args[2]
        if cmd not in self.bot.commands:
            await msg.channel.warn(
                text='Invalid command!')
            return
        if len(cmd) > 50:
            await msg.channel.warn(
                text='command name too long!')
            return
        new_roles = msg.content.replace(
            '{} {} {} '.format(args[0], args[1], args[2]), '', 1)
        if new_roles != 'help' and len(new_roles) > 90:
            await msg.channel.warn(
                text='Too many roles!')
            return
        if new_roles == 'remove':
            query = ("DELETE FROM commands WHERE guild_id = '{}' AND " +
                     "command = '{}'").format(
                msg.guild.id, cmd)
            cursor.execute(query)
            await msg.channel.notify(
                text=(
                    'Removed roles for `{}`'
                ).format(cmd),
                delete_after=False)
            return
        guild_roles = [i.name for i in msg.guild.roles]
        roles = await self.valid_roles(msg, new_roles, guild_roles)
        if roles is None:
            return
        await self.edit_sql(
            cursor,
            ("SELECT * FROM commands WHERE guild_id = '{}' " +
             "AND command = '{}'").format(
                msg.guild.id, cmd),
            ("INSERT INTO commands (guild_id, command, roles) VALUES " +
             "('{}', '{}', '{}')").format(
                msg.guild.id, cmd, '<;>'.join(roles)),
            ("UPDATE commands SET roles = '{}' " +
                "WHERE guild_id = '{}' AND command = '{}'").format(
                '<;>'.join(roles), msg.guild.id, cmd))
        await msg.channel.notify(
            'Roles for `{}` changed to `{}`'
            .format(cmd, ', '.join(roles)),
            delete_after=False)

    async def valid_roles(self, msg, new_roles, guild_roles):
        roles = []
        for i in new_roles.split(','):
            i = i.strip().lower()
            x = list(map(str.lower, guild_roles))
            if i not in x:
                await msg.channel.warn(
                    text='Invalid role: {}'.format(i))
                return
            roles.append(guild_roles[x.index(i)])
        return roles

    async def set_welcome(self, cursor, msg, args):
        new_txt = msg.content.replace(
            '{} {} '.format(args[0], args[1]), '', 1)
        if len(new_txt) < 1:
            return
        if new_txt == 'remove':
            query = "DELETE FROM welcome WHERE guild_id = '{}'".format(
                    msg.guild.id)
            cursor = self.bot.database.cnx.cursor(buffered=True)
            cursor.execute(query)
            cursor.close()
            await msg.channel.notify(
                    text='Removed `Welcome text`.',
                    delete_after=False)
            return
        await self.edit_sql(
            cursor,
            "SELECT * FROM welcome WHERE guild_id = '{}'".format(
                msg.guild.id),
            ("INSERT INTO welcome (guild_id, welcome) VALUES " +
             "('{}', '{}')").format(
                msg.guild.id, new_txt),
            ("UPDATE welcome SET welcome = '{}' " +
                "WHERE guild_id = '{}'").format(
                new_txt, msg.guild.id))
        await msg.channel.notify(
            text='`Welcome text` changed to `{}`.'.format(new_txt),
            delete_after=False)

    async def edit_sql(self, cursor, select, insert, update):
        cursor.execute(select)
        fetched = cursor.fetchone()
        if fetched is None:
            cursor.execute(insert)
        else:
            cursor.execute(update)

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

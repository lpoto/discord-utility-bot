import discord
from commands.help import Help
from utils.misc import delete_button
from utils.wrappers import EmbedWrapper


class Config(Help):
    def __init__(self):
        super().__init__('config')
        self.description = "Change bot's settings."
        self.user_permissions = ['administrator']
        self.synonyms = ['settings', 'options']
        self.embed_type = 'CONFIG'
        self.requires_database = True
        self.interactions_require_database = True

    async def execute_command(self, msg):
        info = self.general_embed
        await msg.channel.send(embed=info[0], components=info[1])

    @property
    def options(self) -> dict:
        return {
            'prefix': self.prefix_embed,
            'welcome_text': self.welcome_text_embed,
            'roles': self.roles_embed,
        }

    @property
    def general_embed(self) -> (EmbedWrapper, list):
        embed_var = EmbedWrapper(discord.Embed(
            description=''),
            embed_type=self.embed_type,
            marks=EmbedWrapper.INFO,
            info='Select the option you want to modify.')
        components = [discord.ui.Button(label=i) for i in self.options.keys()]
        components.append(delete_button())
        return (embed_var, components)

    async def on_button_click(self, button, msg, user, webhook):
        if not msg.is_config:
            return
        if not msg.embeds[0].title:
            return await self.options[button.label](button.label, msg)
        if button.label == 'back':
            info = self.general_embed
            await msg.edit(embed=info[0], components=info[1])
            return
        if button.label == 'default':
            embed = msg.embeds[0]
            embed.description = 'Current: `None`'
            await msg.edit(embed=embed)
        if button.label == 'commit':
            x = msg.embeds[0].title.split(' - ')
            name = x[0]
            info2 = None if len(x) < 2 or len(x[1]) < 1 else x[1]
            info = msg.embeds[0].description.replace('Current:', '', 1).strip()
            txt = '{}'.format(name) if not info2 else '`{} - {}`'.format(
                name, info2)
            if info == '`None`':
                await self.bot.database.use_database(
                    self.reset_option, name, msg.guild.id, info2)
                await msg.channel.notify('Removed settings for {}'.format(
                    txt))
                return
            info = [(x[1:][:-2] if x[-1] == ',' else x[1:][:-1]
                     ) for x in info.split('\n') if len(x.strip()) != 0]
            if len(info) > 1:
                txt += ' set to `{}`'.format(', '.join(info))
            else:
                info = info[0]
                txt += ' set to `{}`'.format(info)
            await self.bot.database.use_database(
                self.option_to_database, name, msg.guild.id, info, info2)
            await msg.channel.notify(txt, delete_after=False)

    async def prefix_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        prefix = await self.bot.database.get_prefix(msg)
        embed.description = 'Current: `{}`'.format(prefix)
        embed.set_info(
            '* Reply with a new prefix to change it.\n' +
            '* Click on "default" to reset it to the default prefix.\n' +
            '* Click on "commit" to save changes.'
        )
        components = [
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def welcome_text_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        w_text = await self.bot.database.get_welcome(msg.guild)
        embed.description = 'Current: `{}`'.format(w_text)
        embed.set_info(
            '* Reply with a new text to change it.\n' +
            '* Click on "default" to reset it to the default welcome text.\n' +
            '* Click on "commit" to save changes.'
        )
        components = [
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def roles_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        embed.set_info(
            '* Edit which roles are allowed to use the command.'
        )
        options = [discord.SelectOption(label=k) for k in (
            self.bot.commands.keys()) if k != 'help']
        components = [
            discord.ui.Select(
                placeholder='Select a command',
                options=options),
            discord.ui.Button(label='back'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def roles_command_embed(self, command, msg):
        embed = msg.embeds[0]
        embed.title += ' - ' + command
        roles = await self.bot.database.get_required_roles(msg, command)
        if roles is None or len(roles) == 0:
            embed.description = 'Current: `None`'
        else:
            embed.description = 'Current:\n{}'.format(
                ',\n'.join(['`{}`'.format(r) for r in roles]))
        embed.set_info(
            '* Select roles that should be able to use the command.\n' +
            '* Click on "default" to reset them.\n' +
            '* Click on "commit" to save changes.'
        )
        options = [discord.SelectOption(label=k.name) for k in (
            msg.guild.roles)]
        components = [
            discord.ui.Select(
                placeholder='Select roles',
                options=options),
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def on_reply(self, msg, referenced_msg):
        if not referenced_msg.is_config:
            return
        if referenced_msg.embeds[0].title == 'prefix':
            p = msg.content.strip()
            if len(p.split()) > 1 or len(p) > 5:
                await msg.channel.warn(
                    'Prefix should be a single word,' +
                    ' not longer than 5 characters!')
                return
            referenced_msg.embeds[0].description = 'Current: `{}`'.format(p)
            await referenced_msg.edit(embed=referenced_msg.embeds[0])
            return
        if referenced_msg.embeds[0].title == 'welcome_text':
            t = msg.content.strip()
            if len(t) > 100:
                await msg.channel.warn(
                    'Welcome text cannot be longer than 100 characters!')
                return
            referenced_msg.embeds[0].description = 'Current: `{}`'.format(t)
            await referenced_msg.edit(embed=referenced_msg.embeds[0])

    async def on_menu_select(self, interaction, msg, user, webhook):
        if not msg.is_config or not msg.embeds[0].title:
            return
        embed = msg.embeds[0]
        if embed.title == 'roles':
            command = interaction.data['values'][0]
            await self.roles_command_embed(command, msg)
            return
        if embed.title.startswith('roles - '):
            role = interaction.data['values'][0]
            if embed.description == 'Current: `None`':
                embed.description = 'Current:\n`{}`'.format(role)
            else:
                info = embed.description.replace('Current:', '', 1).strip()
                rls = [(x[1:][:-2] if x[-1] == ',' else x[1:][:-1]
                        ) for x in info.split('\n') if len(x.strip()) != 0]
                if role in rls:
                    return
                rls.append(role)
                embed.description = 'Current:\n{}'.format(
                        ',\n'.join(['`{}`'.format(x) for x in rls]))
            await msg.edit(embed=embed)

    async def reset_option(self, cursor, option, guild_id, info2=None):
        if info2 is None:
            cursor.execute(
                ('DELETE FROM config WHERE ' +
                 "option = '{}' AND guild_id = '{}'").format(
                    option, guild_id))
        else:
            cursor.execute(
                ('DELETE FROM config WHERE ' +
                 "option = '{}' AND guild_id = '{}' AND info2 = '{}'"
                 ).format(
                    option, guild_id, info2))

    async def option_to_database(self, cursor, option, guild_id, info, info2):
        if info2 is not None:
            cursor.execute((
                'DELETE FROM config WHERE ' +
                "option = '{}' AND guild_id = '{}' AND info2 = '{}'"
            ).format(option, guild_id, info2))
            if not isinstance(info, list):
                info = [info]
            for i in info:
                cursor.execute(
                    ("INSERT INTO config (option, guild_id, info, info2) " +
                     "VALUES ('{}', '{}', '{}', '{}')").format(
                        option, guild_id, i, info2))
            return
        cursor.execute(
            ('SELECT * FROM config WHERE ' +
                "option = '{}' AND guild_id = '{}'").format(
                    option, guild_id))
        fetched = cursor.fetchone()
        if fetched is None:
            cursor.execute(
                ("INSERT INTO config (option, guild_id, info) " +
                    "VALUES ('{}', '{}', '{}')").format(
                    option, guild_id, info, info2))
            return
        cursor.execute(
            ("UPDATE config SET info = '{}' WHERE option = '{}' AND" +
             " guild_id = '{}'").format(
                info, option, guild_id))

    async def valid_roles(self, msg, new_roles, guild_roles):
        roles = []
        for i in new_roles.split(';'):
            i = i.strip().lower()
            x = list(map(str.lower, guild_roles))
            if i not in x:
                await msg.channel.warn(
                    text='Invalid role: {}'.format(i))
                continue
            roles.append(guild_roles[x.index(i)])
        return roles

    def additional_info(self, prefix):
        pass

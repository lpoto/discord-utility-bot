import discord
from commands.help import Help
from utils.misc import delete_button, colors
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
        # options with descriptions, functions
        # to be called when the option is selected
        # and their default values
        return {
            'prefix': (
                'Affix placed in front of the command names.',
                self.prefix_embed,
                self.bot.database.default_prefix),
            'welcome_text': (
                'Text sent when a member join the server.',
                self.welcome_text_embed,
                None),
            'roles': (
                'Which roles are allowed to use a command.',
                self.roles_embed,
                None),
            'deletion_time': (
                'Time before the auto-deleting messages are deleted.',
                self.deletion_time_embed,
                self.bot.database.default_deletion_times)
        }

    @property
    def modify_options(self) -> dict:
        return {
            'on_reply': {
                self.modify_prefix_embed,
                self.modify_welcome_text_embed},
            'on_menu_select': {
                self.modify_roles_embed,
                self.modify_deletion_time_embed}
        }

    @property
    def general_embed(self) -> (EmbedWrapper, list):
        color = colors[list(self.bot.commands.keys()).index(
            self.name) % 9]
        embed_var = EmbedWrapper(discord.Embed(
            description='',
            color=color),
            embed_type=self.embed_type,
            marks=EmbedWrapper.INFO,
            info=('* Select an option to modify it, or to see it\'s' +
                  ' current setting for this server.'))
        opts = self.options
        options = [discord.SelectOption(
            label=k, description=v[0]) for k, v in opts.items()]
        components = [
            discord.ui.Select(
                placeholder='Select an option', options=options),
            discord.ui.Button(label='help', row=4),
            delete_button(4)
        ]
        return (embed_var, components)

    async def on_menu_select(self, interaction, msg, user, webhook):
        if not msg.is_config:
            return
        if not await self.bot.check_permissions(
                self, msg, user, webhook):
            return
        embed = msg.embeds[0]
        # if  there is no title the embed is general_embed
        # so a selection should take you to a specific
        # option's embed
        if not embed.title:
            name = interaction.data['values'][0]
            return await self.options[name][1](name, msg)
        # if there is a title, modify the options
        # that are modified with menu selection and
        # match the title
        for i in self.modify_options['on_menu_select']:
            await i(interaction, msg)

    async def on_reply(self, msg, referenced_msg):
        if (not referenced_msg.is_config or
                not referenced_msg.embeds[0].title):
            return
        if not await self.bot.check_permissions(
                self, referenced_msg, msg.author, False):
            return
        # modify the options that match the title and
        # are modified by replying to the message
        for i in self.modify_options['on_reply']:
            await i(msg, referenced_msg)

    async def on_button_click(self, button, msg, user, webhook):
        if not msg.is_config:
            return
        if not await self.bot.check_permissions(
                self, msg, user, webhook):
            return
        # return to the help menu by clicking on the help button
        if button.label == 'help' and not msg.embeds[0].title:
            info = await self.bot.commands['help'].execute_command(
                msg, only_return=True)
            await msg.edit(embed=info[0], components=info[1])
            return
        # button back should return you back to general_embed
        if button.label == 'back':
            info = self.general_embed
            await msg.edit(embed=info[0], components=info[1])
            return
        # default button should reset the option to its default value
        if button.label == 'default':
            embed = msg.embeds[0]
            z = embed.title.split(' - ')
            name = z[0]
            default_value = self.options[name][2]
            if isinstance(default_value, dict):
                default_value = default_value[z[1]]
            embed.description = 'Current: `{}`'.format(default_value)
            await msg.edit(embed=embed)
        # commit button should save the modified settings to database
        # and notify the user about the changes
        if button.label == 'commit':
            x = msg.embeds[0].title.split(' - ')
            name = x[0]
            info2 = None if len(x) < 2 or len(x[1]) < 1 else x[1]
            info = msg.embeds[0].description.replace('Current:', '', 1).strip()
            txt = '{}'.format(name) if not info2 else '`{} - {}`'.format(
                name, info2)
            opt = self.options[name][2]
            if ((isinstance(opt, dict) and
                str(info[1:][:-1]) == str(opt[x[1]])) or
                    str(info[1:][:-1]) == str(opt)):
                await self.bot.database.use_database(
                    self.reset_option, name, msg.guild.id, info2)
                await msg.channel.notify('Removed settings for `{}`'.format(
                    txt), delete_after=False)
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

    # ------------------------------- options' embeds and their modified embeds

    async def prefix_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        prefix = await self.bot.database.get_prefix(msg)
        embed.description = 'Current: `{}`'.format(prefix)
        embed.set_info(
            '* Reply with a new prefix to change it.\n' +
            '* Click on "default" to reset the setting,' +
            ' or "commit" to save the\u2000changes.'
        )
        components = [
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def modify_prefix_embed(self, msg, referenced_msg):
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

    async def welcome_text_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        w_text = await self.bot.database.get_welcome(msg.guild)
        embed.description = 'Current: `{}`'.format(w_text)
        embed.set_info(
            '* Reply with a new text to change it.\n' +
            '* Click on "default" to reset the setting,' +
            ' or "commit" to save the\u2000changes.'
        )
        components = [
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def modify_welcome_text_embed(self, msg, referenced_msg):
        if referenced_msg.embeds[0].title == 'welcome_text':
            t = msg.content.strip()
            if len(t) > 100:
                await msg.channel.warn(
                    'Welcome text cannot be longer than 100 characters!')
                return
            referenced_msg.embeds[0].description = 'Current: `{}`'.format(t)
            await referenced_msg.edit(embed=referenced_msg.embeds[0])

    async def roles_embed(self, label, msg):
        embed = msg.embeds[0]
        embed.title = label
        embed.set_info(
            '* Select one of the commands to see or change the ' +
            'roles allowed to use it.'
        )
        options = [discord.SelectOption(
            label=k, description=v.description) for k, v in (
            self.bot.commands.items()) if v.name != 'help']
        components = [
            discord.ui.Select(
                placeholder='Select a command',
                options=options),
            discord.ui.Button(label='back'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def roles_command_embed(
            self, command, msg, start=0, end=20, redo=False):
        embed = msg.embeds[0]
        if not redo:
            embed.title += ' - ' + command
            roles = await self.bot.database.get_required_roles(msg, command)
            if roles is None or len(roles) == 0:
                embed.description = 'Current: `None`'
            else:
                embed.description = 'Current:\n{}'.format(
                    ',\n'.join(['`{}`'.format(r) for r in roles]))
            embed.set_info(
                '* Select roles that should be able to use the command.\n' +
                '* Click on "default" to reset the setting,' +
                ' or "commit" to save the\u2000changes.'
            )
        guild_roles = [r.name for r in msg.guild.roles][::-1]
        options = []
        for i in range(start, end + 1):
            if i >= len(guild_roles):
                break
            options.append(discord.SelectOption(label=guild_roles[i]))
        if start > 0:
            options.append(discord.SelectOption(
                label='~ page {}'.format((start // 21)),
                description='See the previous page of guild roles.'))
        if len(guild_roles) > end:
            options.append(discord.SelectOption(
                label='~ page {}'.format(((start // 21) + 2)),
                description='See the next page of guild roles.'))
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

    async def modify_roles_embed(self, interaction, msg):
        embed = msg.embeds[0]
        if embed.title == 'roles':
            command = interaction.data['values'][0]
            await self.roles_command_embed(command, msg)
            return
        if embed.title.startswith('roles - '):
            role = interaction.data['values'][0]
            if role.startswith('~ page'):
                x = int(role.replace('~ page ', '')) - 1
                await self.roles_command_embed(
                    embed.title.replace('roles - ', ''),
                    msg, x * 21,
                    x * 21 + 20,
                    True)
                return
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

    async def deletion_time_embed(self, label, msg, s=21, e=41, restart=False):
        embed = msg.embeds[0]
        embed.title = label
        embed.set_info(
            '* Select one of the message types to see or ' +
            'edit it\'s current deletion time.')
        options = [discord.SelectOption(
            label=k) for k in self.options[label][2].keys()]
        components = [
            discord.ui.Select(
                placeholder='Select a type of message.',
                options=options),
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def deletion_time_type_embed(self, m_type, msg, s=21, e=41, r=False):
        embed = msg.embeds[0]
        if not r:
            embed.title += ' - {}'.format(m_type)
            time = await self.bot.database.get_deletion_time(msg, m_type)
            embed.description = 'Current: `{}`'.format(time)
            embed.set_info(
                '* Edit the time after "{}" messages are deleted.\n'.format(
                    m_type) +
                '* Click on "default" to reset the setting,' +
                ' or "commit" to save the\u2000changes.'
            )
        options = [discord.SelectOption(label=i) for i in range(s, e)]
        if e > 1:
            options.append(discord.SelectOption(
                label='~ page {}'.format((s - 1) // 20),
                description='See the previous page of deletion times.'))
        if e < 161:
            options.append(discord.SelectOption(
                label='~ page {}'.format((s - 1) // 20 + 2),
                description='See the next page of deletion times.'))
        components = [
            discord.ui.Select(
                placeholder='Select a deletion time.',
                options=options),
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def modify_deletion_time_embed(self, interaction, msg):
        embed = msg.embeds[0]
        if embed.title == 'deletion_time':
            name = interaction.data['values'][0]
            await self.deletion_time_type_embed(name, msg)
            return
        if embed.title.startswith('deletion_time - '):
            name = embed.title.replace('deletion_time - ', '', 1)
            if name.startswith('~ page'):
                x = int(name.replace('~ page ', '')) - 1
                await self.deletion_time_type_embed(
                    name,
                    msg,
                    x * 20 + 1,
                    x * 20 + 21,
                    True)
                return
            val = interaction.data['values'][0]
            embed.description = 'Current: `{}`'.format(val)
            await msg.edit(embed=embed)

    # ------------------------------------------------------ modifying database

    async def reset_option(self, cursor, option, guild_id, info2=None):
        # reset the option to its default value by deleting it from
        # the database, as fetching option from database will
        # return default value if no entry is found
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

    def additional_info(self, prefix):
        return '* {}\n* {}'.format(
            'Initialize config with "{}config"'.format(prefix),
            'Follow the instructions to change the settings.')

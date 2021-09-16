import discord
from commands.help import Help
from utils.misc import delete_button, colors
from utils.wrappers import EmbedWrapper
import utils.decorators as decorators


class Config(Help):
    def __init__(self):
        super().__init__('config')
        self.description = "Manage bot's configurations in this server."
        self.user_permissions = ['administrator']
        self.synonyms = ['settings', 'options']
        self.embed_type = 'CONFIG'
        self.requires_database = True
        self.interactions_require_database = True
        self.risky_labels = ['delete', 'config', 'help', 'games']

    @decorators.ExecuteCommand
    async def send_general_config_message(self, msg):
        # send a general settings embed from which
        # the user can select a type of setting he wants
        # to see or modify
        info = self.general_embed
        await msg.channel.send(embed=info[0], components=info[1])

    @decorators.ExecuteWithInteraction
    async def edit_message_to_config_message(self, msg, user, webhook):
        # config can also be opened by clicking on a config button
        # on a bot's message (help message)
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        info = self.general_embed
        await msg.edit(embed=info[0], components=info[1])

    @property
    def options(self) -> dict:
        # options with descriptions, functions
        # to be called when the option is selected
        # and their default values
        return {
            'prefix': (
                'Affix placed in front of the command names.',
                self.prefix_embed,
                self.bot.default_prefix),
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
                self.bot.default_deletion_times)
        }

    @property
    def modify_options(self) -> dict:
        return {
            'on_reply': {
                self.modify_prefix_embed,
                self.modify_welcome_text_embed},
            'on_menu_select': {
                self.modify_roles_embed,
                self.modify_deletion_time_embed},
            'on_button_click': {
                self.modify_roles_embed_button}
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

    @decorators.OnMenuSelect
    async def modify_from_dropdown(self, interaction, msg, user, webhook):
        if not msg.is_config:
            return
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
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

    @decorators.OnReply
    async def modify_option_on_reply(self, msg, referenced_msg):
        if (not referenced_msg.is_config or
                not referenced_msg.embeds[0].title):
            return
        if await self.bot.check_if_valid(self, msg, msg.author) is False:
            return
        # modify the options that match the title and
        # are modified by replying to the message
        for i in self.modify_options['on_reply']:
            await i(msg, referenced_msg)

    @decorators.OnButtonClick
    async def change_embed_on_click(self, button, msg, user, webhook):
        if not msg.is_config:
            return
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
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
            return
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
            info = [(x[1:][:-1]) for x in info.split(', ') if len(
                x.strip()) != 0]
            if len(info) > 1:
                txt += ' set to `{}`'.format(', '.join(info))
            else:
                info = info[0]
                txt += ' set to `{}`'.format(info)
            await self.bot.database.use_database(
                self.option_to_database, name, msg.guild.id, info, info2)
            await msg.channel.notify(txt, delete_after=False)
            return
        for method in self.modify_options['on_button_click']:
            await method(button, msg)

    # --------------------------- options' embeds and their modification embeds

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
        options = []
        for v in self.bot.commands.values():
            if v.name == 'help':
                continue
            name = v.name
            if name in self.risky_labels:
                name = '_' + name
            options.append(discord.SelectOption(
                label=name, description=v.description))
        components = [
            discord.ui.Select(
                placeholder='Select a command',
                options=options),
            discord.ui.Button(label='back'),
            delete_button()
        ]
        await msg.edit(embed=embed, components=components)

    async def roles_command_embed(
            self, command, msg, start=0, end=25, redo=False):
        embed = msg.embeds[0]
        if command[0] == '_':
            command = command[1:]
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
                ' or "commit" to save the\u2000changes.\n' +
                '* Clicking on an already selected role will remove it.'
            )
        guild_roles = []
        for i in msg.guild.roles[::-1]:
            name = str(i.name)
            if name in self.risky_labels:
                name = '_' + name
            guild_roles.append(name)
        options = []
        for i in range(start, end):
            if i >= len(guild_roles):
                break
            options.append(discord.SelectOption(label=guild_roles[i]))
        x = 'Select roles'
        if start > 0 or len(guild_roles) > end:
            x = 'Select roles (page {})'.format(start // 21 + 1)
        components = [
            discord.ui.Select(
                placeholder=x,
                options=options,
                max_values=len(options)),
            discord.ui.Button(label='back'),
            discord.ui.Button(label='default'),
            discord.ui.Button(label='commit'),
        ]
        if start > 0:
            components.append(discord.ui.Button(
                label='page {} of roles'.format(start // 25)))
        if len(guild_roles) > end:
            components.append(discord.ui.Button(
                label='page {} of roles'.format((start // 25) + 2)))
        components.append(delete_button())
        await msg.edit(embed=embed, components=components)

    async def modify_roles_embed_button(self, button, msg):
        embed = msg.embeds[0]
        if not embed.title.startswith('roles - '):
            return
        x = int(button.label.replace('page ', '', 1).split()[0]) - 1
        name = embed.title.replace('roles - ', '', 1)
        await self.roles_command_embed(
            name, msg, x * 25, x * 25 + 25, True)

    async def modify_roles_embed(self, interaction, msg):
        embed = msg.embeds[0]
        if embed.title == 'roles':
            command = interaction.data['values'][0]
            await self.roles_command_embed(command, msg)
            return
        if embed.title.startswith('roles - '):
            roles = interaction.data['values']
            for k, v in enumerate(roles):
                if v[0] == '_' and v[1:] in self.risky_labels:
                    roles[k] = v[1:]
            if embed.description == 'Current: `None`':
                embed.description = 'Current:\n{}'.format(
                    ', '.join(['`{}`'.format(r) for r in roles]))
            else:
                info = embed.description.replace('Current:', '', 1).strip()
                rls = [(x[1:][:-1]) for x in info.split(', ') if len(
                    x.strip()) != 0]
                for role in roles:
                    if role in rls:
                        rls.remove(role)
                    else:
                        rls.append(role)
                if len(rls) == 0:
                    embed.description = 'Current: `None`'
                else:
                    embed.description = 'Current:\n{}'.format(
                        ', '.join(['`{}`'.format(x) for x in rls]))
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

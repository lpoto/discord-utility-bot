import discord
from utils.misc import colors, delete_button
from utils.wrappers import EmbedWrapper


class Help:
    def __init__(
            self,
            name='help',
    ):
        self.bot = None
        self.synonyms = ['h'] if name == 'help' else []
        self.name = name
        self.description = 'Get information about the commands.'
        self.bot_permissions = ['send_messages']
        self.user_permissions = None
        self.requires_database = False
        self.interactions_require_database = False
        self.embed_type = None
        # on init add the created object to
        # Bot's commands dictionary

    def clean_up(self):
        pass

    def additional_info(self, prefix) -> str:
        """
        Informations about the command, more detailed
        than the command's description.
        """
        # child classes override this function
        return '* There is no additional information.'

    def command_info(self, prefix) -> list:
        # gather all the information about the command
        # to be used in command's help embed
        add_inf = self.additional_info(prefix)
        if self.name in self.bot.games.keys() or self.name == 'games':
            add_inf += '\n\n* Games messages are deleted after 24 hours.'
        info = [
            self.name,
            self.description,
            add_inf,
            self.bot_permissions,
            self.user_permissions,
            self.synonyms
        ]
        return info

    async def execute_command(self, msg, only_return=False):
        """
        Function called when a message in a discord channel
        starts with the prefix and the command's name.
        """
        embed_var = await self.help_embed(msg, self.bot.commands)
        if embed_var is None:
            return
        options1 = [discord.SelectOption(
            label=i) for i in self.bot.commands.keys() if (
                i != self.name)]
        options2 = [discord.SelectOption(
            label=i) for i in self.bot.games.keys()]
        options1.append(discord.SelectOption(label=self.name))
        components = [
            discord.ui.Select(
                placeholder='Select a command', options=options1),
            discord.ui.Select(
                placeholder='Select a game', options=options2),
            discord.ui.Button(label='config'),
            delete_button()]
        if not only_return:
            await msg.channel.send(embed=embed_var, components=components)
        else:
            return (embed_var, components)

    async def on_menu_select(self, interaction, msg, user, webhook):
        # this is triggered when a user selects something in
        # a dropdown menu
        # Allows iterating all the commands' help embeds from
        # the help command
        if not msg.is_help or self.name != 'help':
            return
        name = interaction.data['values'][0]
        if name == 'help':
            await msg.edit(
                embed=await self.help_embed(
                    msg, self.bot.commands))
            return
        cmd = None
        if name in self.bot.commands:
            cmd = self.bot.commands[name]
        elif name in self.bot.games:
            cmd = self.bot.games[name]
        else:
            return
        prefix = await self.bot.database.get_prefix(msg)
        new_embed = await self.bot.create_additional_help(
            cmd.command_info(prefix), msg, prefix)
        new_embed.set_info(
                'Select help in the commands dropdown to return to help menu.')
        await msg.edit(embed=new_embed)

    async def on_button_click(self, button, msg, user, webhook):
        if not msg.is_help:
            return
        config_info = self.bot.commands['config'].general_embed
        await msg.edit(embed=config_info[0], components=config_info[1])

    async def help_embed(self, msg, commands) -> EmbedWrapper:
        prefix = await self.bot.database.get_prefix(msg)
        idx = list(self.bot.commands.keys()).index('help')
        embed_var = EmbedWrapper(discord.Embed(
            description='current prefix: `{}`'.format(prefix),
            color=colors[idx % 9]),
            embed_type='HELP',
            marks=EmbedWrapper.INFO)
        embed_var.description += (
            '\n\n* Click on "config" for more on bot\'s configurations ' +
            'in this server.' +
            "\n\n* select a command or a game for details " +
            '(synonyms, permissions, usage...)').format(
            prefix)
        txt = ''
        for i in embed_var.marks:
            txt += '{}{}-\u3000{}\n'.format(
                i, '\u3000' * (3 - len(i)), embed_var.mark_info(i))
        embed_var.set_info(
                'Marks are shown at the bottom left of the embed (after "@")')
        embed_var.add_field(name='Marks', value=txt, inline=False)
        return embed_var

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
        self.user_permissions = ['send_messages']
        self.requires_database = False
        self.interactions_require_database = False
        self.embed_type = None
        self.game = False
        # on init add the created object to
        # Bot's commands dictionary

    def clean_up(self):
        pass

    def additional_info(self, prefix) -> str:
        """ Informations about the command, more detailed
        than the command's description."""
        # child classes override this function
        return '* There is no additional information.'

    def command_info(self, prefix) -> list:
        # gather all the information about the command
        # to be used in command's help embed
        info = [
            self.name,
            self.description,
            self.additional_info(prefix),
            self.bot_permissions,
            self.user_permissions,
            self.synonyms
        ]
        return info

    async def execute_command(self, msg):
        """Function called when a message in a discord channel
        starts with the prefix and the command's name."""
        embed_var = await self.help_embed(msg, self.bot.commands)
        if embed_var is None:
            return
        options = []
        for i in embed_var.fields[:-1]:
            options.append(discord.SelectOption(label=i.name))
        options.append(discord.SelectOption(label=self.name))
        components = [discord.ui.Select(
            placeholder='Select a command', options=options),
            delete_button()]
        await msg.channel.send(embed=embed_var, components=components)

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
        cmd = self.bot.commands[name]
        prefix = await self.bot.database.get_prefix(msg)
        new_embed = await self.bot.create_additional_help(
            cmd.command_info(prefix), msg, prefix)
        new_embed.description += (
            '\n\nSelect help in the dropdown to return to help menu.')
        await msg.edit(embed=new_embed)

    async def help_embed(self, msg, commands) -> EmbedWrapper:
        prefix = await self.bot.database.get_prefix(msg)
        idx = list(self.bot.commands.keys()).index('help')
        embed_var = EmbedWrapper(discord.Embed(
            description='current prefix: [{}]'.format(prefix),
            color=colors[idx % 9]),
            embed_type='HELP',
            marks=EmbedWrapper.INFO)
        embed_var.description += (
            "\n\nselect a command or type " +
            '"{}<command> help" in the chat for details ' +
            'about the command (synonyms, permissions,...)').format(
            prefix)
        for k, v in commands.items():
            if k == 'help':
                continue
            embed_var.add_field(
                name=k,
                value=v.description)
        txt = ''
        for i in embed_var.marks:
            txt += '{}{}-\u3000{}\n'.format(
                i, '\u3000' * (3 - len(i)), embed_var.mark_info(i))
        txt += ('(Marks shown at the bottom of the embed ' +
                '(after the second "@"))')
        embed_var.add_field(name='* Marks', value=txt, inline=False)
        return embed_var

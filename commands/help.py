import discord
from utils.misc import colors, delete_button
from utils.wrappers import EmbedWrapper
import utils.decorators as decorators


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
        self.executable = True
        self.requires_database = False
        self.interactions_require_database = False
        self.embed_type = None
        # on init add the created object to
        # Bot's commands dictionary

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
        # if this type of message deletes after time,
        # add this information to the embed
        if self.name in list(self.bot.games.keys()) + ['games', 'poll']:
            add_inf += (
                '\n\n* {} messages are deleted after {} hours.'
            ).format(self.name, self.bot.default_deletion_times[self.name])
        info = [
            self.name,
            self.description,
            add_inf,
            self.bot_permissions,
            self.user_permissions,
            self.synonyms
        ]
        return info

    @decorators.ExecuteCommand
    async def __send_help_to_channel(self, msg, only_return=False):
        """
        Function called when a message in a discord channel
        starts with the prefix and the command's name.
        """
        # send the help to the channel, add dropdown with all the
        # availible commands
        # and a dropdown with all the availible games
        # selecting one of those should open the selected command's
        # help embed
        embed_var = await self.help_embed(msg, self.bot.commands)
        if embed_var is None:
            return
        options1 = [discord.SelectOption(
            label=k, description=v.description
        ) for k, v in self.bot.commands.items() if (
            v.name != self.name)]
        options2 = [discord.SelectOption(
            label=k, description=v.description
        ) for k, v in self.bot.games.items()]
        options1.append(discord.SelectOption(
            label=self.name, description=self.description))
        components = [
            discord.ui.Select(
                placeholder='Select a command', options=options1),
            discord.ui.Select(
                placeholder='Select a game', options=options2),
            discord.ui.Button(label='games'),
            discord.ui.Button(label='config'),
            delete_button()]
        if not only_return:
            await msg.channel.send(embed=embed_var, components=components)
        else:
            return (embed_var, components)

    @decorators.ExecuteWithInteraction
    async def __edit_message_to_help(self, msg, user, webhook):
        # help can be oppened by clicking on a "help" button
        # on a bot's message
        info = await self.__send_help_to_channel(
            self, msg=msg, only_return=True)
        await msg.edit(embed=info[0], components=info[1])

    @decorators.OnMenuSelect
    async def __additional_help(self, interaction, msg, user, webhook):
        if not msg.is_help:
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

    async def help_embed(self, msg, commands) -> EmbedWrapper:
        prefix = await self.bot.database.get_prefix(msg)
        idx = list(self.bot.commands.keys()).index('help')
        embed_var = EmbedWrapper(discord.Embed(
            description='current prefix: `{}`'.format(prefix),
            color=colors[idx % 9]),
            embed_type='HELP',
            marks=EmbedWrapper.INFO)
        embed_var.description += ((
            "\n\n* Select a command or a game for details \n\u3000" +
            '(synonyms, permissions, usage...)').format(prefix) +
            '\n* Click on "config" for more on bot\'s settings ' +
            'in this server.' +
            '\n* Click on "games" to open a game menu.')
        txt = ''
        for i in embed_var.marks:
            txt += '{}{}-\u3000{}\n'.format(
                i, '\u3000' * (3 - len(i)), embed_var.mark_info(i))
        embed_var.set_info(
            'Marks are shown at the bottom left of the embed (after "@")')
        embed_var.add_field(name='Marks', value=txt, inline=False)
        return embed_var

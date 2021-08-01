import discord
from utils import emojis, waste_basket, colors, EmbedWrapper


class Help:
    def __init__(
            self,
            name='help',
    ):
        self.bot = None
        self.name = name
        self.description = 'Get information about the commands.'
        self.bot_permissions = [
            'send_messages',
            'add_reactions']
        self.user_permissions = ['send_messages']
        self.channel_types = ['text']
        self.embed_type = None
        self.game = False
        # on init add the created object to
        # Bot's commands dictionary

    def additional_info(self, prefix) -> str:
        """ Informations about the command, more detailed
        than the command's description."""
        return '* There is no additional information.'

    def command_info(self, prefix) -> list:
        # detailed information about
        # the command
        info = [
            self.name,
            self.description,
            self.additional_info(prefix),
            self.bot_permissions,
            self.user_permissions,
            self.channel_types
        ]
        return info

    async def execute_command(self, msg):
        """Function called when a message in a discord channel
        starts with the prefix and the command's name."""
        embed_var = await self.help_embed(msg, self.bot.commands)
        if embed_var is None:
            return
        idx = list(self.bot.commands.keys()).index('help')
        emjis = []
        for i in range(len(self.bot.commands)):
            if i != idx:
                emjis.append(emojis[i])
        emjis += [emojis[idx], waste_basket]
        await msg.channel.send(embed=embed_var, reactions=emjis)

    async def on_raw_reaction(self, msg, payload):
        """Function called when an emoji is added or removed in
        a discord server."""
        if (self.name != 'help' or
                payload.emoji.name not in emojis or
                payload.event_type != 'REACTION_ADD' or
                not msg.is_help):
            return
        idx = emojis.index(payload.emoji.name)
        help_idx = list(self.bot.commands.keys()).index('help')
        if idx == help_idx:
            await msg.edit(embed=await self.help_embed(
                msg, self.bot.commands))
            return
        cmd = self.bot.commands[
            list(self.bot.commands.keys())[idx]]
        prefix = await self.bot.database.get_prefix(msg)
        new_embed = await self.bot.create_additional_help(
            cmd.command_info(prefix), msg, prefix)
        new_embed.set_footer(
            text='React with {} to return to help menu.'.format(
                emojis[help_idx]))
        await msg.edit(embed=new_embed)

    async def help_embed(self, msg, commands) -> EmbedWrapper:
        prefix = await self.bot.database.get_prefix(msg)
        idx = list(self.bot.commands.keys()).index('help')
        embed_var = EmbedWrapper(discord.Embed(
            description='current prefix: [{}]'.format(prefix),
            color=colors[idx]),
            embed_type='HELP',
            marks=EmbedWrapper.INFO)
        footer = ("React with command's emoji for details or type " +
                  '"{}command help" in the chat.'.format(
                      prefix))
        embed_var.set_footer(text=footer)
        i = 0
        for k, v in commands.items():
            if i == idx:
                i += 1
            if k == 'help':
                continue
            embed_var.add_field(
                name='{}{}'.format(prefix, k),
                value='{} {}'.format(v.description, emojis[i]),
                inline=False)
            i += 1
        txt = ''
        for i in embed_var.marks:
            txt += '{}{}-\u3000{}\n'.format(
                    i, '\u3000' * (3 - len(i)), embed_var.mark_info(i))
        txt += '(Marks shown in the top right corner of the embed)'
        embed_var.add_field(name='* Marks', value=txt, inline=False)
        return embed_var

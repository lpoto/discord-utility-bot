import discord
from bot import bot
from utils import *


class Command:
    def __init__(
            self,
            name='help',
    ):
        self.name = name
        self.description = 'Get information about the commands.'
        self.bot_permissions = [
            'send_messages',
            'add_reactions']
        self.user_permissions = ['send_messages']
        self.channel_types = ['text']
        # on init add the created object to
        # Bot's commands dictionary
        self.add_command()

    def additional_info(self, prefix):
        # default additional info, overriden by
        # child classes' additional info
        return '* There is no additional information.'

    def add_command(self):
        # adds object to commands dictionary in Bot
        bot.add_command(self)

    def command_info(self, prefix):
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
        # by default the Command object will
        # send info about all the commands...
        # classes extending default Command will
        # override this method
        try:
            embed_var = await self.help_embed(msg, bot.commands)
            if embed_var is None:
                return
            new_msg = await msg.channel.send(embed=embed_var)
            idx = list(bot.commands.keys()).index('help')
            for i in range(len(bot.commands)):
                if i == idx:
                    continue
                await message_react(new_msg, emojis[i])
            await message_react(new_msg, emojis[idx])
            await message_react(new_msg, waste_basket)
        except Exception as err:
            await send_error(msg, err, 'command.py -> execute_command()')

    async def on_raw_reaction(self, msg, payload):
        if (payload.emoji.name not in emojis or len(msg.embeds) != 1 or
                payload.event_type != 'REACTION_ADD' or
                not msg.embeds[0].title.startswith('Help')):
            return
        idx = emojis.index(payload.emoji.name)
        help_idx = list(bot.commands.keys()).index('help')
        if idx == help_idx:
            await message_edit(msg, None, await self.help_embed(
                msg, bot.commands))
            return
        cmd = bot.commands[list(bot.commands.keys())[idx]]
        prefix = await get_prefix(msg)
        new_embed = await bot.create_additional_help(
            cmd.command_info(prefix), msg, prefix)
        new_embed.set_footer(
                text='React with {} to return to help menu.'.format(
                    emojis[help_idx]))
        await message_edit(msg, None, new_embed)

    async def help_embed(self, msg, commands):
        try:
            prefix = await get_prefix(msg)
            embed_var = discord.Embed(
                title='Help',
                description='current prefix: [{}]'.format(prefix),
                color=colors[list(bot.commands.keys()).index('help')])
            footer = ("React with command's emoji for details or type " +
                      '"{}command help" in the chat.'.format(
                          prefix))
            embed_var.set_footer(text=footer)
            i = 0
            for k, v in commands.items():
                if k == 'help':
                    continue
                embed_var.add_field(
                    name='{}{}'.format(prefix, k),
                    value='{} {}'.format(v.description, emojis[i]),
                    inline=False)
                i += 1
            return embed_var
        except Exception as err:
            await send_error(msg, err, 'command.py -> help_embed()')
            return None


Command()

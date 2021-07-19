import discord
from bot import bot
import re
from command import Command
from utils import *


class Server_info(Command):
    def __init__(self):
        super().__init__('server')
        self.description = 'Get server information.'

    async def execute_command(self, msg):
        try:
            args = msg.content.split()
            if (len(args) > 1):
                return msg.reply('Invalid command!')
            embed_var = await self.create_info_embed(msg)
            new_msg = await msg.channel.send(embed=embed_var)
            await message_react(new_msg, emojis[list(
                bot.commands.keys()).index('config')])
            await message_react(new_msg, waste_basket)
        except Exception as err:
            await send_error(msg, err, 'server.py -> execute_command()')

    async def create_info_embed(self, msg):
        # build embed with server info
        embed_var = discord.Embed(
            title=msg.guild.name,
            description="Server information",
            color=colors[list(bot.commands.keys()).index('server')])
        # check if guild has description
        if (msg.guild.description):
            embed_var.description = msg.guild.description
        # add guild's icon to the embed
        if (msg.guild.icon_url):
            embed_var.set_thumbnail(url=msg.guild.icon_url)
        # count total and online members
        embed_var.add_field(
            name='Total members',
            value=msg.guild.member_count,
            inline=False
        )
        embed_var.add_field(
            name='Online members',
            value=self.get_online_members(msg),
            inline=False
        )
        owner = await msg.guild.fetch_member(str(msg.guild.owner_id))
        # add owner
        # add both his nickname and username (if has nickname set up)
        if owner.nick:
            owner = '{nick}\n({user})' .format(nick=owner.nick, user=owner)
        embed_var.add_field(
            name='Owner',
            value=owner,
            inline=False
        )
        # add rules channel info if it is set up
        if msg.guild.rules_channel:
            embed_var.add_field(
                name='Rules channel',
                value=msg.guild.rules_channel,
                inline=False
            )
        # check for afk channel
        if msg.guild.afk_channel:
            embed_var.add_field(
                name='AFK channel',
                value="{channel}\n~timeout: {timeout} min".format(
                    channel=msg.guild.afk_channel,
                    timeout=msg.guild.afk_timeout // 60),
                inline=False
            )
        embed_var.set_footer(
                text='React with {} to see server configurations.'.format(
                    emojis[list(bot.commands.keys()).index('config')]))
        return embed_var

    async def on_raw_reaction(self, msg, payload):
        try:
            if (payload.event_type != 'REACTION_ADD' or msg.embeds == [] or
                    payload.emoji.name != emojis[list(
                        bot.commands.keys()).index('server')] or
                    msg.embeds[0].title != msg.guild.name or
                    msg.embeds[0].description != 'Server configurations'):
                return
            await message_edit(
                    msg, embed=await self.create_info_embed(msg))
            await message_remove_reaction(msg, waste_basket, msg.guild.me)
            await message_react(msg, emojis[list(
                bot.commands.keys()).index('config')])
            await message_react(msg, waste_basket)
        except Exception as err:
            await send_error(None, err, 'server.py -> on_raw_reaction()')

    def get_online_members(self, msg):
        count = 0
        for i in msg.guild.members:
            if str(i.status) != 'offline':
                count += 1
        return count

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}'.format(
            '* Total members and online members.',
            "* Owner's name and nickname.",
            '* Afk channel and timeout time (if set up).',
            '* Rules channel (if set up).')


Server_info()

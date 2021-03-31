import discord
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
            embed_var = await self.create_embed(msg)
            new_msg = await msg.channel.send(embed=embed_var)
            await message_react(new_msg, emojis['waste_basket'])
        except Exception as err:
            await send_error(msg, err, 'server.py -> execute_command()')

    async def create_embed(self, msg):
        embed_var = discord.Embed(
            title=msg.guild.name,
            description="Server information",
            color=random_color())
        if (msg.guild.description):
            embed_var.description = msg.guild.description
        if (msg.guild.icon_url):
            embed_var.set_thumbnail(url=msg.guild.icon_url)
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
        if owner.nick:
            owner = '{nick}\n({user})' .format(nick=owner.nick, user=owner)
        embed_var.add_field(
            name='Owner',
            value=owner,
            inline=False
        )
        roles_channel = await get_roleschannel(msg)
        if roles_channel is not None:
            embed_var.add_field(
                name='Roles channel',
                value=roles_channel.name,
                inline=False
            )
        if msg.guild.rules_channel:
            embed_var.add_field(
                name='Rules channel',
                value=msg.guild.rules_channel,
                inline=False
            )
        if msg.guild.afk_channel:
            embed_var.add_field(
                name='AFK channel',
                value="{channel}\n~timeout: {timeout} min".format(
                    channel=msg.guild.afk_channel,
                    timeout=msg.guild.afk_timeout // 60),
                inline=False
            )
        return embed_var

    def get_online_members(self, msg):
        count = 0
        for i in msg.guild.members:
            if str(i.status) != 'offline':
                count += 1
        return count


Server_info()

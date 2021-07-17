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
            await message_react(new_msg, waste_basket)
        except Exception as err:
            await send_error(msg, err, 'server.py -> execute_command()')

    async def create_embed(self, msg):
        # build embed with server info
        embed_var = discord.Embed(
            title=msg.guild.name,
            description="Server information",
            color=random_color())
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
        # check for role-managing channel from database
        roles_channel = await get_roleschannel(msg)
        if roles_channel is not None:
            embed_var.add_field(
                name='Roles channel',
                value=roles_channel.name,
                inline=False
            )
        # add welcome text if it is set up for the guild
        embed_var = await self.get_welcome_text(embed_var, msg)
        # add which roles can use which command
        embed_var = await self.get_commands_config(embed_var, msg)
        return embed_var

    async def get_welcome_text(self, embed, msg):
        try:
            if database.connected is False:
                return embed
            cursor = database.cnx.cursor(buffered=True)
            cursor.execute(
                    "SELECT * FROM welcome WHERE guild_id = '{}'".format(
                        msg.guild.id))
            fetched = cursor.fetchone()
            if fetched is None:
                return embed
            embed.add_field(
                    name='Welcome text',
                    value=fetched[1],
                    inline=False)
            cursor.close()
            return embed
        except Exception as err:
            await send_error(None, err, 'server.py -> get_welcome_text')
            return embed

    async def get_commands_config(self, embed, msg):
        try:
            if database.connected is False:
                return embed
            cursor = database.cnx.cursor(buffered=True)
            cursor.execute(
                    "SELECT * FROM commands WHERE guild_id = '{}'".format(
                        msg.guild.id))
            fetched = cursor.fetchall()
            if fetched is None:
                return embed
            prefix = await get_prefix(msg)
            txt = ''
            for i in fetched:
                if txt != '':
                    txt += ',\n'
                txt += '{}{}: {}'.format(
                        prefix, i[1], ', '.join(i[2].split('<;>')))
            embed.add_field(
                    name='Commands config',
                    value=txt,
                    inline=False)
            return embed
        except Exception as err:
            await send_error(None, err, 'server.py -> get_welcome_text')
            return embed

    def get_online_members(self, msg):
        count = 0
        for i in msg.guild.members:
            if str(i.status) != 'offline':
                count += 1
        return count


Server_info()

import discord
import re
from command import Command
from utils import *


class User_info(Command):
    def __init__(self):
        super().__init__('user')
        self.description = 'Get information about the user.'

    async def execute_command(self, msg):
        try:
            args = msg.content.split()
            user = msg.author
            # if no user provided show info about the
            # message author, else show info about the user
            # whose name was provided
            if len(args) > 1:
                args = (' '.join(args[1:])).lower()
                for member in msg.guild.members:
                    if (args == str(member.name).lower() or
                            args == str(member.nick).lower()):
                        user = member
                        break
            embed_var = await self.create_embed(msg, user)
            if embed_var is None:
                return
            new_msg = await msg.channel.send(embed=embed_var)
            await message_react(new_msg, list(emojis.keys())[-1])
        except Exception as err:
            await send_error(msg, err, 'user.py -> execute_command()')

    async def create_embed(self, msg, user):
        try:
            # build the embed with user info
            embed_var = discord.Embed(
                title=user.name,
                color=random_color())
            # if user has nickname set up add nickname
            # else only username
            if user.nick:
                embed_var.title = user.nick
                embed_var.description = str(user)
            # add if user is bot
            if user.bot:
                embed_var.title += ' [bot]'
            # add user's avatar picture to the embed
            if user.avatar_url:
                embed_var.set_thumbnail(url=user.avatar_url)
            embed_var.add_field(
                name='Joined server',
                value=str(user.joined_at).split()[0],
                inline=False
            )
            embed_var = await self.add_rps_wins(embed_var, user)
            roles = 'everyone'
            for i in user.roles:
                if str(i.name) != '@everyone':
                    roles += ',\n' + str(i.name)
            embed_var.add_field(
                name='Roles',
                value=roles,
                inline=False
            )
            return embed_var
        except Exception as err:
            await send_error(None, err, 'user.py -> create_embed()')

    async def add_rps_wins(self, embed, user):
        try:
            if database.connected is False:
                return embed
            cursor = database.cnx.cursor(buffered=True)
            cursor.execute("SELECT * FROM rps WHERE user_id = '{}'".format(
                user.id))
            fetched = cursor.fetchone()
            count = 0 if fetched is None else fetched[1]
            embed.add_field(
                    name='Rock-Paper-Scissors wins',
                    value=count,
                    inline=False)
            cursor.close()
            return embed
        except Exception as err:
            await send_error(None, err, 'user.py -> add_rps_wins()')
            return embed

    def additional_info(self):
        return '{}\n{}'.format(
            '* Add username or nickname to the command.',
            '* Not adding anything will show your info.')


User_info()

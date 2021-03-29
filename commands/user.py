import discord
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
            if len(args) > 1:
                args = (' '.join(args[1:])).lower()
                for member in msg.guild.members:
                    if (args == str(member.name).lower() or
                            args == str(member.nick).lower()):
                        user = member
                        break
            embed_var = await self.create_embed(msg, user)
            new_msg = await msg.channel.send(embed=embed_var)
            await message_react(new_msg, emojis['waste_basket'])
        except Exception as err:
            await send_error(msg, err, 'user.py -> execute_command()')

    async def create_embed(self, msg, user):
        embed_var = discord.Embed(
            title=user.name,
            color=random_color())
        if user.nick:
            embed_var.title = user.nick
            embed_var.description = str(user)
        if user.bot:
            embed_var.title += ' [bot]'
        if user.avatar_url:
            embed_var.set_thumbnail(url=user.avatar_url)
        embed_var.add_field(
                name='Joined server',
                value=str(user.joined_at).split()[0],
                inline=False
                )
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

    def additional_info(self):
        return '{}\n{}'.format(
                '* Add username or nickname to the command.',
                '* Not adding anything will show your info.')


User_info()

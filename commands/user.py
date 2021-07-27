import discord
from commands.help import Help
from utils import waste_basket, random_color


class User_info(Help):
    def __init__(self):
        super().__init__(name='user')
        self.description = 'Get information about the user.'

    async def execute_command(self, msg):
        args = msg.content.split()
        user = msg.author
        # if no user provided show info about the
        # message author, else show info about the user
        # whose name was provided
        if len(args) > 1:
            args = msg.content.replace(
                '{} '.format(args[0]), '', 1).lower()
            for member in msg.guild.members:
                if (args == str(member.name).lower() or
                        args == str(member.nick).lower()):
                    user = member
                    break
        embed_var = await self.create_embed(msg, user)
        if embed_var is None:
            return
        await msg.channel.send(
            embed=embed_var,
            reactions=waste_basket)

    async def create_embed(self, msg, user):
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
        rps_wins = await self.add_rps_wins(msg, user)
        if rps_wins is not None:
            embed_var.add_field(
                name=rps_wins[0],
                value=rps_wins[1],
                inline=False)
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

    async def add_rps_wins(self, msg, user):
        if self.bot.database.connected is False:
            return None
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute(
            ("SELECT * FROM rock_paper_scissors WHERE guild_id = '{}'" +
             " AND user_id = '{}'").format(msg.guild.id, user.id))
        fetched = cursor.fetchone()
        count = 0 if fetched is None else fetched[1]
        cursor.close()
        return ('Rock-Paper-Scissors wins', count)

    def additional_info(self, prefix):
        return '{}\n{}'.format(
            '* Add username or nickname to the command.',
            '* Not adding anything will show your info.')

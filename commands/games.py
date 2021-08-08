import discord
from utils.wrappers import EmbedWrapper, MemberWrapper
from utils.misc import random_color, emojis
from commands.help import Help


class Games(Help):
    def __init__(self):
        super().__init__(name='games')
        self.description = 'Show all games.'

    async def execute_command(self, msg):
        embed_var = EmbedWrapper(discord.Embed(
            description="React with a game's emoji to start it.",
            color=random_color()),
            embed_type='GAMES',
            marks=EmbedWrapper.INFO)
        e_count = 0
        for k, v in self.bot.commands.items():
            if v.game:
                embed_var.add_field(name=v.embed_type,
                                    value=(emojis[e_count] +
                                           ' ({})'.format(k)))
                e_count += 1
        await msg.channel.send(
            embed=embed_var, reactions=[
                emojis[i] for i in range(e_count)])

    async def on_raw_reaction(self, msg, payload):
        if (not msg.is_games or
                payload.emoji.name not in emojis or
                payload.event_type != 'REACTION_ADD'):
            return
        user = MemberWrapper(msg.guild.get_member(payload.user_id))
        if user is None:
            return
        await msg.remove_reaction(emoji=payload.emoji.name, member=user)
        for i in msg.embeds[0].fields:
            if i.value.startswith(payload.emoji.name):
                n = i.value.split(' (')[-1][:-1]
                await self.bot.commands[n].execute_command(msg, user)
                return

    def additional_info(self, prefix):
        return '* React with an emoji that matches the game to start it.'

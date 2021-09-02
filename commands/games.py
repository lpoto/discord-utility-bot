import discord
from utils.wrappers import EmbedWrapper, MemberWrapper
from utils.misc import random_color
from commands.help import Help


class Games(Help):
    def __init__(self):
        super().__init__(name='games')
        self.description = 'Show all games.'

    async def execute_command(self, msg):
        embed_var = EmbedWrapper(discord.Embed(
            description="React with a game's numer to start it.",
            color=random_color()),
            embed_type='GAMES',
            marks=EmbedWrapper.INFO)
        e_count = 0
        for k, v in self.bot.commands.items():
            if v.game:
                embed_var.add_field(
                    name='({})  {}'.format(e_count, k),
                    value=v.description,
                    inline=False)
                e_count += 1
        components = [discord.ui.Button(label=str(i)) for i in range(e_count)]
        await msg.channel.send(
            embed=embed_var, components=components)

    async def on_button_click(self, interaction, interaction_msg):
        if not interaction_msg.is_games:
            return
        for i in interaction_msg.components:
            for j in i.children:
                if j.custom_id == interaction.data['custom_id']:
                    await self.handle_button_click(
                        j, interaction_msg, interaction.user)
                    return

    async def handle_button_click(self, button, interaction_msg, user):
        for i in interaction_msg.embeds[0].fields:
            x = i.name.split(')  ')[0][1:]
            if x.startswith(button.label):
                user = MemberWrapper(user)
                await self.bot.commands[i.name.replace(
                    '({})  '.format(x), '', 1)
                ].execute_command(
                    interaction_msg, user)
                return

    def additional_info(self, prefix):
        return '* React with an emoji that matches the game to start it.'

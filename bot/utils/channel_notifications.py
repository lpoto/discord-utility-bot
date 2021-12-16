import nextcord
from bot.utils.misc import colors


async def warn(channel, text):
    await channel.send(
        embed=nextcord.Embed(description=text, color=colors['red']),
        delete_after=4)


async def notify(channel, text):
    await channel.send(
        embed=nextcord.Embed(description=text, color=colors['green']),
        delete_after=4)

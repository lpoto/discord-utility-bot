# should not be included in bot/commands/__init__.py
import nextcord

from bot.utils.embed_wrapper import UtilityEmbed
import bot.commands as commands
import bot.games as games
from bot.utils.channel_notifications import notify, warn

not_deletable_types = set(C.__name__ for C in commands.__dict__.values()
                          if isinstance(C, type)).union(
    set(C.__name__ for C in games.__dict__.values() if isinstance(C, type))
)


def purge_filter(msg):
    if msg.author.id != msg.guild.me.id or len(
            msg.embeds) != 1:
        return True
    embed = UtilityEmbed(embed=msg.embeds[0])
    type = embed.get_type()
    if not type or type not in not_deletable_types:
        return True
    return False


async def bulk_delete(msg, count, logger):
    if (not isinstance(msg.channel, nextcord.TextChannel) or
        not msg.channel.permissions_for(msg.guild.me).manage_messages or
            not msg.channel.permissions_for(msg.author).administrator):
        return
    c = 0
    try:
        c = int(count)
        if (c < 1 or c > 50):
            raise Exception
    except Exception:
        await warn(msg.channel, text='Can only delete from 1 to 50 messages')
        return
    logger.debug(msg=f'Bulk deleting {c} messages')
    purged = len(await msg.channel.purge(limit=c, check=purge_filter)) - 1
    await notify(msg.channel, text=f"Deleted {purged} messages.")
    logger.debug(msg=f'Bulk deleted {purged} messages')

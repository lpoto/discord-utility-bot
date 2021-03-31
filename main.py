import discord
import os
import re
from utils import *
from dotenv import load_dotenv
from bot import managing_bot
from commands import *


@client.event
async def on_ready():
    # on starting the bot, print tag and activity
    if client.user:
        print('Logged in as', client.user)
        activity = discord.Game(name=DEFAULT_PREFIX+'help', type=2)
        status = discord.Status.idle
        await client.change_presence(status=status, activity=activity)
        print("Activity set to", activity)


@client.event
async def on_message(msg):
    # check messages if they start with prefix and
    # match any of the commands
    # if so push them to queue, to be processed one by one
    try:
        if msg.author.id == client.user.id:
            return
        bot_perms = dict(iter(msg.guild.me.permissions_in(msg.channel)))
        # allow calling help with default prefix, even if a different
        # prefix is set
        if msg.content == "{}help".format(DEFAULT_PREFIX):
            await managing_bot.push_msg_queue(msg, 'help')
            return
        prefix = await get_prefix(msg, False)
        # if server has prefix set in it's config, use that prefix,
        # else use default prefix
        first_word = msg.content.split()
        if first_word is None or len(first_word) < 1:
            return
        first_word = first_word[0][len(prefix):]
        if (msg.content[:len(prefix)] == prefix and
                first_word in managing_bot.commands.keys()):
            await managing_bot.push_msg_queue(msg, first_word)
            return
        # for all objects in on_message list, execute
        # those objects' on_message method
        for i in managing_bot.on_message:
            await i.on_message(msg)
    except Exception as err:
        await send_error(msg, err, 'main.py -> on_message()')


@client.event
async def on_raw_reaction_add(payload):
    # listen for raw reaction events, so we can listen to
    # reactions on messages created before bot was online
    if (payload.user_id == client.user.id or
            payload.guild_id is None or
            payload.emoji.name not in emojis.values()):
        return
    await managing_bot.push_raw_queue(payload, 'add')


@client.event
async def on_raw_reaction_remove(payload):
    if (payload.user_id == client.user.id or
            payload.guild_id is None or
            payload.emoji.name not in emojis.values()):
        return
    await managing_bot.push_raw_queue(payload, 'remove')

client.run(DISCORD_TOKEN)

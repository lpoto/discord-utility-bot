import discord
import os
import re
from utils import *
from bot import managing_bot
from commands import *


@client.event
async def on_ready():
    # on starting the bot, print tag and activity
    if client.user:
        print('Bot logged in!')
        print('Client:',  client.user)
        activity = discord.Game(name=DEFAULT_PREFIX+'help', type=2)
        status = discord.Status.idle
        await client.change_presence(status=status, activity=activity)
        print("Status:", activity)
        database.connect_database(get_database_info())


@client.event
async def on_message(msg):
    # check messages if they start with prefix and
    # match any of the commands
    # if so push them to queue, to be processed one by one
    try:
        if msg.author.id == client.user.id:
            return
        # allow calling help with default prefix, even if a different
        # prefix is set
        if msg.content == "{prefix}help".format(prefix=DEFAULT_PREFIX):
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
                first_word in managing_bot.commands):
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
            payload.emoji.name not in emojis):
        return
    await managing_bot.push_raw_queue(payload, 'add')


@client.event
async def on_raw_reaction_remove(payload):
    if (payload.user_id == client.user.id or
            payload.guild_id is None or
            payload.emoji.name not in emojis):
        return
    await managing_bot.push_raw_queue(payload, 'remove')


@client.event
async def on_member_join(member):
    server = member.guild
    default_channel = server.system_channel
    hello = await get_welcome(server)
    if hello is None:
        return
    msg = '{} {}'.format(member.mention, hello)
    await default_channel.send(msg)


client.run(DISCORD_TOKEN)

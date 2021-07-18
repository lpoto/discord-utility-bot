import discord
import os
import re
import asyncio
from utils import *
from bot import bot
from commands import *


def client_events():
    @client.event
    async def on_ready():
        # on starting the bot, printf tag and activity
        if client.user:
            printf('Bot logged in!')
            printf('Client:',  client.user)
            activity = discord.Game(name=DEFAULT_PREFIX+'help', type=2)
            status = discord.Status.idle
            await client.change_presence(status=status, activity=activity)
            printf("Status:", activity)
            printf(database.connect_database(get_database_info()))

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
                await bot.push_msg_queue(msg, 'help')
                return
            prefix = await get_prefix(msg, False)
            # if server has prefix set in it's config, use that prefix,
            # else use default prefix
            first_word = msg.content.split()
            if first_word is None or len(first_word) < 1:
                return
            first_word = first_word[0][len(prefix):]
            if (msg.content[:len(prefix)] == prefix and
                    first_word in bot.commands):
                await bot.push_msg_queue(msg, first_word)
                return
                # for all objects in on_message list, execute
                # those objects' on_message method
            for i in bot.on_message:
                await i.on_message(msg, bot)
        except Exception as err:
            await send_error(msg, err, 'main.py -> on_message()')

    @client.event
    async def on_member_join(member):
        server = member.guild
        default_channel = server.system_channel
        if not dict(iter(
            server.me.permissions_in(
                default_channel)))['send_messages']:
            return
        hello = await get_welcome(server)
        if hello is None:
            return
        msg = '{} {}'.format(member.mention, hello)
        await default_channel.send(msg)


def reactions_client_events():
    @client.event
    async def on_raw_reaction_add(payload):
        # listen for raw reaction events, so we can listen to
        # reactions on messages created before bot was online
        if (payload.user_id == client.user.id or
                (payload.emoji.name not in emojis and
                 payload.emoji.name not in rps_emojis and
                 payload.emoji.name != waste_basket)):
            return
        await bot.push_raw_queue(payload, 'add')

    @client.event
    async def on_raw_reaction_remove(payload):
        if (payload.user_id == client.user.id or
                payload.guild_id is None or
                (payload.emoji.name not in emojis and
                    payload.emoji.name not in rps_emojis)):
            return
        await bot.push_raw_queue(payload, 'remove')


# handle exit by reconnecting unless keyboard interrupt

def exception_handler(loop, context):
    printf(context['message'])
    printf('\n')


def handle_exit(client):
    client.loop.set_exception_handler(exception_handler)
    client.loop.run_until_complete(client.logout())
    for t in asyncio.all_tasks(loop=client.loop):
        if t.done():
            t.exception()
            continue
        t.cancel()
        try:
            client.loop.run_until_complete(
                asyncio.wait_for(t, 5, loop=client.loop))
        except (asyncio.InvalidStateError,
                asyncio.TimeoutError,
                asyncio.CancelledError):
            pass
        finally:
            if t.done() and not t.cancelled():
                t.exception()


async def task(client):
    await client.wait_until_ready()


try:
    while True:
        client.loop.create_task(task(client))
        # run all events in loop so they keep repeating
        client_events()
        reactions_client_events()
        try:
            client.loop.run_until_complete(client.start(DISCORD_TOKEN))
        except SystemExit:
            printf("\nDisconnected")
            handle_exit(client)
        except KeyboardInterrupt:
            handle_exit(client)
            client.loop.close()
            printf("\nProgram ended")
            break
        printf("Reconnecting...\n")
        client = discord.Client(loop=client.loop)
except Exception as err:
    printf('Error in main.py when starting the bot:\n')
    printf(err)

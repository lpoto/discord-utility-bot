import asyncio
import os
from bot import Bot
import discord
from client import My_client


def handle_exit(client, bot):
    bot.client = None
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
            del client


async def task(client):
    await client.wait_until_ready()


def run_bot(DISCORD_TOKEN, client=None, bot=None):
    if client is None:
        client = My_client(
            intents=discord.Intents.all())
        bot = Bot(client)
        client.bot = bot
    else:
        client = My_client(
            loop=client.loop,
            intents=discord.Intents.all())
        client.bot = bot
    while True:
        client.loop.create_task(task(client))
        # run all events in loop so they keep collecting discord events
        # try reconnecting on disconnect unless the exception was
        # keyboard interrupt
        try:
            client.loop.run_until_complete(client.start(DISCORD_TOKEN))
        except SystemExit:
            bot.print("\nDisconnected")
            handle_exit(client, bot)
            bot.print("Reconnecting...\n")
            return run_bot(DISCORD_TOKEN, client, bot)
        except KeyboardInterrupt:
            handle_exit(client, bot)
            client.loop.close()
            bot.print("\nProgram ended")
            return


run_bot(os.environ.get('DISCORD_TOKEN'))

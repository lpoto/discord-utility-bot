import asyncio
import logging
import os
from bot import Bot
import discord
from client import MyClient

logging.getLogger('discord').setLevel(logging.WARN)

file = os.environ.get('LOGFILE')
logging.basicConfig(
    format='%(asctime)s %(levelname)s: %(message)s',
    datefmt='%H:%M:%S %d-%m-%Y',
    level=logging.INFO,
    filename=None if file is None else file,
    filemode=None if file is None else 'a')


def handle_exit(client, bot, tasks):
    if ('event' in bot.commands and
        bot.commands['event'].timer is not None and
            bot.commands['event'].timer.is_alive()):
        bot.commands['event'].timer.cancel()
    bot.client = None
    t = client.loop.create_task(client.close())
    client.loop.run_until_complete(t)
    tasks.add(t)
    for task in tasks:
        if task.done():
            task.exception()
            continue
        try:
            task.cancel()
            client.loop.run_until_complete(
                asyncio.gather(asyncio.wait_for(
                    task, 5, loop=client.loop), return_exceptions=True))
        except (asyncio.InvalidStateError,
                asyncio.TimeoutError,
                asyncio.CancelledError):
            pass
        finally:
            if task.done() and not task.cancelled():
                task.exception()


def handle_exceptions(loop, context):
    logging.error(context['message'])


def run_bot(DISCORD_TOKEN):
    client = MyClient(
        intents=discord.Intents.all())
    bot = Bot()
    client.loop.set_exception_handler(handle_exceptions)
    while True:
        try:
            bot.client = client
            client.bot = bot
            client.handle_exit = handle_exit
            client.loop.create_task(client.wait_until_ready())
            client.loop.run_until_complete(
                asyncio.gather(client.start(DISCORD_TOKEN)))
        except SystemExit:
            logging.info(msg='Disconnected')
            handle_exit(client, bot, asyncio.all_tasks(loop=client.loop))
        except KeyboardInterrupt:
            handle_exit(client, bot, asyncio.all_tasks(loop=client.loop))
            client.loop.close()
            logging.info(msg='Program ended ')
            return
        logging.info(msg='Reconnecting...\n')
        client = MyClient(
            loop=client.loop,
            intents=discord.Intents.all())


run_bot(os.environ.get('DISCORD_TOKEN'))

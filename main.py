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


def handle_exit(client, bot, tasks, disconnected=False):
    if disconnected:
        logging.warning(msg='Disconnected\n')
    bot.clean_up()
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
    ex = context['message']
    if '_ClientEventTask' in ex:
        return
    ex_type = type(context['exception']).__name__
    loc = context['future'].get_coro().__name__
    logging.error(msg='{} ({})\n{}\n    {}\n'.format(
        ex_type, loc, 56*'-', ex))


def run_bot(DISCORD_TOKEN):
    client = MyClient(
        intents=discord.Intents.all())
    client.handle_exit = handle_exit
    client.loop.set_exception_handler(handle_exceptions)
    bot = Bot()
    while True:
        try:
            bot.client = client
            client.bot = bot
            client.handle_exit = handle_exit
            client.loop.create_task(client.wait_until_ready())
            client.loop.run_until_complete(
                asyncio.gather(client.start(DISCORD_TOKEN)))
        except SystemExit:
            handle_exit(client, bot, asyncio.all_tasks(loop=client.loop), True)
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

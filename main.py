import asyncio
import logging
import os
from dotenv import load_dotenv
from bot import Bot
import discord
from client import MyClient

load_dotenv()

# send only warnings and errors from discord module
logging.getLogger('discord').setLevel(logging.WARN)
# set up default logging config, log to file if filename provided
logging.basicConfig(
    format='%(asctime)s %(levelname)s: %(message)s',
    datefmt='%H:%M:%S %d-%m-%Y',
    level=logging.INFO,
    filename=os.environ.get('LOGFILE'))


def handle_exit(client, bot, tasks, disconnected=False):
    if disconnected:
        logging.warning(msg='Disconnected\n')
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
    # prettier exceptions format
    ex = context['message']
    if '_ClientEventTask' in ex:
        return
    ex_type = type(context['exception']).__name__
    loc = context['future'].get_coro().__name__
    logging.error(msg='{} ({})\n{}\n    {}\n'.format(
        ex_type, loc, 56*'-', ex))


def new_client(client=None, bot=None) -> MyClient:
    """
    Create a new discord.Client() instance and
    link it with a Bot() object
    """
    # enable all intents to get member info etc.
    # application on the discord dev website needs to have
    # presence and server members intent enabled under BOT
    client = MyClient(
        loop=None if client is None else client.loop,
        intents=discord.Intents.all())
    if bot is None:
        prefix = os.environ.get('DEFAULT_PREFIX')
        if prefix is None:
            raise Exception('Missing DEFAULT_PREFIX')
            return
        bot = Bot(prefix)
    bot.client = client
    client.bot = bot
    client.handle_exit = handle_exit
    return client


def run_bot(DISCORD_TOKEN):
    """
    Run the bot in a loop while handling exits, reconnects
    and exceptions
    """
    if DISCORD_TOKEN is None:
        raise Exception('Missing DISCORD_TOKEN')
        return
    client = new_client()
    if client is None:
        return
    client.loop.set_exception_handler(handle_exceptions)
    while True:
        try:
            client.loop.create_task(client.wait_until_ready())
            client.loop.run_until_complete(
                asyncio.gather(client.start(DISCORD_TOKEN)))
        except SystemExit:
            # try reconnecting
            handle_exit(client, client.bot, asyncio.all_tasks(
                        loop=client.loop), True)
        except KeyboardInterrupt:
            # kill the program
            handle_exit(client, client.bot, asyncio.all_tasks(
                loop=client.loop))
            client.loop.close()
            logging.info(msg='Program ended ')
            return
        logging.info(msg='Reconnecting...\n')
        # create a new discord.Client while keeping the same
        # Bot instance to avoid reinitializing all the commands...
        client = new_client(client, client.bot)


run_bot(os.environ.get('DISCORD_TOKEN'))

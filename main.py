import discord
import asyncio
import sys
from utils import *
import traceback
from database import DB
from bot import Bot
from datetime import datetime
import commands as cmds


def client_events(client, bot):
    @client.event
    async def on_ready():
        # on starting the bot, printf tag and activity
        if client.user:
            printf('Bot logged in!')
            printf('Client:',  client.user)
            # show help command in bot's status message
            activity = discord.Game(name=DEFAULT_PREFIX+'help', type=2)
            status = discord.Status.idle
            await client.change_presence(status=status, activity=activity)
            printf("Status:", activity)
            await initialize_bot(bot, client)

    @client.event
    async def on_error(error, *args, **kwargs):
        ex_type, ex, tb = sys.exc_info()
        x = traceback.extract_tb(tb)
        # 10008 -> unknown message, can ignore as mostly
        # when deleting or reacting to already deleted message
        if 'error code: 10008' in str(ex):
            return
        printf('\nEXCEPTION ({})\n{}'.format(ex, 56*'-'))
        for i in traceback.format_list(x):
            if 'discord/client.py' not in i:
                printf(i)

    async def initialize_bot(bot, client):
        bot.client = client
        # connect database
        if bot.database is None:
            bot.database = DB()
        if not bot.database.connected:
            printf(bot.database.connect_database(get_database_info()))
        # initialize all the commands
        if not bot.ready:
            for C in list([cls for cls in cmds.__dict__.values()
                           if isinstance(cls, type)]):
                c = C()
                c.bot = bot
                bot.add_command(c)
            # if event command is ready, start timing for the scheduled
            # events
            if 'event' in bot.commands:
                await bot.commands['event'].events_from_database()
                await bot.commands['event'].start_timer()
            bot.ready = True


def client_message_events(client, bot):
    @client.event
    async def on_message(msg):
        # check messages if they start with prefix and
        # match any of the commands
        # if so push them to queue, to be processed one by one
        if (msg.author.id == client.user.id or
                str(msg.channel.type) != 'text' or
                msg.content.split() is None or
                len(msg.content.split()) < 1):
            return
        if msg.reference is not None and msg.reference.message_id:
            referenced_msg = await msg.channel.fetch_message(
                msg.reference.message_id)
            if referenced_msg is not None:
                client.dispatch('reply', msg, referenced_msg)
                return
        # allow calling help with default prefix, even if a different
        # prefix is set
        if msg.content == "{prefix}help".format(prefix=DEFAULT_PREFIX):
            await bot.handle_message(msg, 'help', DEFAULT_PREFIX)
            return
        # if server has prefix set in it's config, use that prefix,
        # else use default prefix
        prefix = await get_prefix(msg, bot.database)
        cmd = msg.content.split()[0][len(prefix):]
        if (msg.content[:len(prefix)] == prefix and
                cmd in bot.commands):
            await bot.handle_message(msg, cmd, prefix)
            return

    @client.event
    async def on_reply(msg, referenced_msg):
        # custom event to handle commands that have on_reply
        # functions that should be processed separately
        if referenced_msg.author.id != client.user.id:
            return
        # iterate through those commands in linked list that
        # have on_reply function
        for i in bot.on_reply_commands:
            if await bot.check_if_valid(i, msg):
                await i.on_reply(msg, referenced_msg)


def client_reactions_events(client, bot):
    @client.event
    async def on_raw_reaction_add(payload):
        # listen for raw reaction events, so we can listen to
        # reactions on messages created before bot was online
        if (payload.user_id == client.user.id or
                (payload.emoji.name not in emojis and
                    payload.emoji.name not in rps_emojis and
                    payload.emoji.name not in number_emojis and
                    payload.emoji.name != thumbs_up and
                    payload.emoji.name != waste_basket)):
            return
        if payload.guild_id:
            await bot.handle_raw_reactions(payload, payload.event_type, False)
        else:
            await bot.handle_raw_reactions(payload, payload.event_type, True)

    @client.event
    async def on_raw_reaction_remove(payload):
        client.dispatch('raw_reaction_add', payload)


def client_random_events(client, bot):
    @client.event
    async def on_event_time(time, execute=True):
        if execute:
            if not client.user:
                return
            if 'event' not in bot.commands:
                return
            if time not in bot.commands['event'].events:
                return
            for f in bot.commands['event'].events[time]:
                if 'args' in f:
                    await f['function'](*f['args'])
                else:
                    await f['function']
        await bot.commands['event'].remove_event(time)
        await bot.commands['event'].start_timer()

    @client.event
    async def on_member_join(member):
        # on member join, if server has welcome text set up
        # in database, send welcome text to default channel
        server = member.guild
        default_channel = server.system_channel
        # check if bot has send_messages permissions in defaut channel
        if has_permissions(
                server.me, default_channel, 'send_messages') is not True:
            return
        hello = await get_welcome(server, bot.database)
        if hello is None:
            return
        msg = '{} {}'.format(member.mention, hello)
        await default_channel.send(msg)


def exception_handler(loop, context):
    # handle task exceptions, print only
    # exception message instead of whole exception info
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
            del client


async def task(client):
    await client.wait_until_ready()


def run_bot(DISCORD_TOKEN, client=None, bot=None):
    if client is None:
        client = discord.Client(
            intents=discord.Intents.all())
        bot = Bot(client)
    else:
        client = discord.Client(
            loop=client.loop,
            intents=discord.Intents.all())
    while True:
        client.loop.create_task(task(client))
        # run all events in loop so they keep repeating
        client_events(client, bot)
        client_message_events(client, bot)
        client_reactions_events(client, bot)
        client_random_events(client, bot)
        # try reconnecting on disconnect unless the exception was
        # keyboard interrupt
        try:
            client.loop.run_until_complete(client.start(DISCORD_TOKEN))
        except SystemExit:
            printf("\nDisconnected")
            handle_exit(client)
            printf("Reconnecting...\n")
            return run_bot(DISCORD_TOKEN, client, bot)
        except KeyboardInterrupt:
            handle_exit(client)
            client.loop.close()
            printf("\nProgram ended")
            return


run_bot(DISCORD_TOKEN)

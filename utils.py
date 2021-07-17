import os
from dotenv import load_dotenv
import discord
import sys
import random
from database import DB
# enable all intents to get member info etc.
# application on the discord dev website needs to have
# presence and server members intent enabled under BOT
load_dotenv()
intents = discord.Intents.all()
client = discord.Client(intents=intents)
# default prefix key used before commands
DEFAULT_PREFIX = os.getenv('DEFAULT_PREFIX')
# discord application's private token
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
database = DB()


def get_database_info():
    # get all the mysql data info from .env
    info = {}
    for i in ['USER', 'PASSWORD', 'HOST', 'DATABASE']:
        info[i.lower()] = os.getenv(i)
        if info[i.lower()] is None:
            return None
    x = os.getenv('PORT')
    if x is not None:
        info['port'] = int(x)
    return info


def random_color():
    # generate a random color (mostly for embeds)
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)


async def message_react(msg, reaction):
    # add a reaction to the message and avoid unknown message
    try:
        await msg.add_reaction(reaction)
        return True
    except Exception as error:
        await send_error(msg, error, 'utils.py -> message_react()')
        return False


async def message_remove_reaction(msg, emoji, user):
    # remove user's reaction from the message
    try:
        await msg.remove_reaction(emoji, user)
        return True
    except Exception as error:
        await send_error(msg, error, 'utils.py -> message_remove_reaction()')
        return False


async def message_delete(msg, time, txt=None):
    # if txt is given, send text then delete
    # sent message
    # else delete the given message
    try:
        if txt is not None:
            msg = await msg.channel.send(txt)
        await msg.delete(delay=time)
        return True
    except Exception as error:
        if (hasattr(error, 'code')) and str(error.code) != '10008':
            printf('Error -> (utils.py -> message_delete())' + str(err))
        return False


async def message_edit(msg, text, embed=None):
    # edit message while avoiding unknown message errors
    try:
        await msg.edit(content=text, embed=embed)
        return True
    except Exception as error:
        await send_error(msg, error, 'utils.py -> message_edit()')
        return False


# currently running queues
running_queues = {}


async def clear_queue(queue_type, ignore_running, queue, function):
    # clear messages or reaction in queue to avoid
    # multiple instances of same command or reactions
    try:
        if ((queue_type not in running_queues or
             ignore_running) and len(queue) > 0):
            if queue_type not in running_queues:
                running_queues[queue_type] = True
            await function(queue)
            await clear_queue(queue_type, True, queue, function)
        else:
            if queue_type in running_queues:
                del running_queues[queue_type]
    except Exception as error:
        await send_error(None, error, 'utils.py -> clear_queue()')
        if queue_type in running_queues:
            del running_queues[queue_type]


async def send_error(msg, error, origin, send=True):
    # 10008 -> unknown message (ignore this error, mostly when
    # trying to delete or react to a deleted message)
    # 50001 -> cannot acces a channel
    # 50013 -> Missing permissions
    try:
        if (str(error) == 'MySQL Connection not available.'):
            database.connected = False
            database.connect_database(get_database_info())
        elif (hasattr(error, 'code') and str(error.code) == '50001'
                and msg is not None):
            await msg.channel.send('Missing access to a channel.')
        elif (hasattr(error, 'code') and str(error.code) == '50013'
                and msg is not None):
            txt = 'I am missing the required permissions!'
            await message_delete(msg, 5, txt)
        elif (hasattr(error, 'code') and
                str(error.code) not in ['10008', '50001', '50013'] or
                not hasattr(error, 'code')):
            printf('Error ({}):\n{}'.format(origin, error))
    except Exception as err:
        printf('Error -> (utils.py -> send_error())' + str(err))


async def get_prefix(msg, throwerr=True):
    # try to get prefix from database, return default database if unsuccessful
    try:
        if not database.connected:
            return DEFAULT_PREFIX
        query = "SELECT * FROM prefix WHERE guild_id = '{}'".format(
                msg.guild.id)
        cursor = database.cnx.cursor(buffered=True)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return DEFAULT_PREFIX
        return fetched[1]
        cursor.close()
    except Exception as error:
        if (str(error) == 'MySQL Connection not available.'):
            database.connected = False
            database.connect_database(get_database_info())
            return DEFAULT_PREFIX
        await send_error(msg, error, 'utils.py -> get_prefix()')
        return DEFAULT_PREFIX


async def get_welcome(server):
    # get guild's welcome text from database
    try:
        if not database.connected:
            return None
        query = "SELECT * FROM welcome WHERE guild_id = '{}'".format(
                server.id)
        cursor = database.cnx.cursor(buffered=True)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return None
        return fetched[1]
        cursor.close()
    except Exception as error:
        await send_error(None, error, 'utils.py -> get_hello()')
        return None


async def get_roleschannel(msg):
    # get guild's role-managing channel from database, if it is set up
    try:
        if not database.connected:
            return None
        query = "SELECT * FROM roleschannel WHERE guild_id = '{}'".format(
                msg.guild.id)
        cursor = database.cnx.cursor(buffered=True)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return None
        cursor.close()
        channel = discord.utils.get(
            msg.guild.channels,
            id=int(fetched[1]))
        if channel is None:
            return None
        return channel
    except Exception as error:
        await send_error(None, error, 'utils.py -> get_roleschannel()')
        return None


async def get_required_roles(msg, command):
    # get which roles can use a command from database
    try:
        if not database.connected:
            return None
        query = ("SELECT * FROM commands WHERE guild_id = '{}' AND " +
                 "command = '{}'").format(
            msg.guild.id, command)
        cursor = database.cnx.cursor(buffered=True)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return None
        return fetched[2].split('<;>')
        if channel is None:
            return None
        return channel
    except Exception as error:
        await send_error(None, error, 'utils.py -> get_required_roles()')
        return None


def printff(txt, extra=None):
    if extra is not None:
        txt = '{} {}'.format(txt, extra)
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'a') as f:
            default_stdout = sys.stdout
            sys.stdout = f
            printf(txt)
            sys.stdout = default_stdout
            return
    printf(txt)


# emojis used for polls, roles,...
rps_emojis = ['🪨', '🗞️', '✂️']
waste_basket = '🗑️'
emojis = [
    u"\u26AA",
    u"\U0001F534",
    u"\U0001F535",
    u"\U0001F7E0",
    u"\U0001F7E1",
    u"\U0001F7E2",
    u"\U0001F7E3",
    u"\U0001F7E4",
    u"\u26AB",
    u"\U00002B1C",
    u"\U0001F7E5",
    u"\U0001F7E6",
    u"\U0001F7E7",
    u"\U0001F7E8",
    u"\U0001F7E9",
    u"\U0001F7EA",
    u"\U0001F7EB",
    u"\U00002B1B",
]

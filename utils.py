import os
from dotenv import load_dotenv
import discord
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
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)


async def message_react(msg, reaction):
    try:
        await msg.add_reaction(reaction)
        return True
    except Exception as error:
        await send_error(msg, error, 'utils.py -> message_react()')
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
            print('Error -> (utils.py -> message_delete())' + str(err))
        return False


async def message_edit(msg, text, embed=None):
    try:
        await msg.edit(content=text, embed=embed)
        return True
    except Exception as error:
        await send_error(msg, error, 'utils.py -> message_edit()')
        return False


async def send_error(msg, error, origin, send=True):
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
            print('Error ({}):\n{}'.format(origin, error))
    except Exception as err:
        print('Error -> (utils.py -> send_error())' + str(err))


async def get_prefix(msg, throwerr=True):
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

emojis = {
    u"\u26AA": 'white_circle',
    u"\U0001F534": 'red_circle',
    u"\U0001F535": 'blue_circle',
    u"\U0001F7E0": 'orange_circle',
    u"\U0001F7E1": 'yellow_circle',
    u"\U0001F7E2": 'green_circle',
    u"\U0001F7E3": 'purple_circle',
    u"\U0001F7E4": 'brown_circle',
    u"\u26AB": 'black_circle',
    u"\U00002B1C": 'white_square',
    u"\U0001F7E5": 'red_square',
    u"\U0001F7E6": 'blue_square',
    u"\U0001F7E7": 'orange_square',
    u"\U0001F7E8": 'yellow_square',
    u"\U0001F7E9": 'green_square',
    u"\U0001F7EA": 'purple_square',
    u"\U0001F7EB": 'brown_square',
    u"\U00002B1B": 'black_square',
    '🗑️': 'waste_basket',
}

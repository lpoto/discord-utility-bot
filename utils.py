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


async def message_remove_reaction(msg, emoji, user, clear_all=False):
    # remove user's reaction from the message
    try:
        # if bot has manage_messages permissions and clear_all
        # remove all reactions not just bot's reaction
        if clear_all and has_permissions(
                msg.guild.me, msg.channel, 'manage_messages') is True:
            await msg.clear_reaction(emoji)
            return True
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


async def message_edit(msg, text=None, embed=None):
    # edit message while avoiding unknown message errors
    try:
        await msg.edit(
                content=msg.content if text is None else text, embed=embed)
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


def has_permissions(user, channel, perms):
    try:
        if not isinstance(perms, list):
            perms = [perms]
        for i in perms:
            if not dict(iter(user.permissions_in(channel)))[i]:
                return i
        return True
    except Exception as err:
        printf('Error (utils.py -> has_permissions())\n', err)


async def send_error(msg, error, origin, send=True):
    # 10008 -> unknown message (ignore this error, mostly when
    # trying to delete or react to a deleted message)
    # 50001 -> cannot acces a channel
    # 50013 -> Missing permissions
    try:
        if (str(error) == 'MySQL Connection not available.'):
            database.connected = False
            printf(database.connect_database(get_database_info()))
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
    # try to get prefix from database, return default prefix if unsuccessful
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


async def roles_for_all_commands(msg):
    try:
        if not database.connected:
            return None
        cursor = database.cnx.cursor(buffered=True)
        cursor.execute(
            "SELECT * FROM commands WHERE guild_id = '{}'".format(
                msg.guild.id))
        fetched = cursor.fetchall()
        if fetched is None:
            return embed
        prefix = await get_prefix(msg)
        txt = ''
        for i in range(len(fetched)):
            txt += '{}{}: [{}]'.format(
                prefix, fetched[i][1], ', '.join(fetched[i][2].split('<;>')))
            if i < len(fetched) - 1:
                txt += ',\n'
        return txt
    except Exception as err:
        await send_error(None, err, 'utils.py -> roles_for_all_commands()')
        return None


def printf(txt, extra=None):
    if extra is not None:
        txt = '{} {}'.format(txt, extra)
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'a') as f:
            default_stdout = sys.stdout
            sys.stdout = f
            print(txt)
            sys.stdout = default_stdout
        return
    print(txt)


# emojis rock, paper, scissors
rps_emojis = [u"\U0001FAA8", u"\U0001F4C4", u"\U00002702\U0000FE0F"]
# waste basket emoji for deleting messages
waste_basket = u"\U0001F5D1\U0000FE0F"

# emojis for polls, roles,...
# 20 reactions is maximum (error otherwise)
emojis = [
    u"\U000026AA",
    u"\U0001F534",
    u"\U0001F535",
    u"\U0001F7E0",
    u"\U0001F7E1",
    u"\U0001F7E2",
    u"\U0001F7E3",
    u"\U0001F7E4",
    u"\U000026AB",
    u"\U00002B1C",
    u"\U0001F7E5",
    u"\U0001F7E6",
    u"\U0001F7E7",
    u"\U0001F7E8",
    u"\U0001F7E9",
    u"\U0001F7EA",
    u"\U0001F7EB",
    u"\U00002B1B",
    u"\U0001F536",
    u"\U0001F537"]
# colors that match emoji colors by indexes
colors = [
        0xffffff,
        0xc30202,
        0x0099e1,
        0xf75f1c,
        0xf8c300,
        0x008e44,
        0xa652bb,
        0xa5714e,
        0x2f3136,
        0xffffff,
        0xc30202,
        0x0099e1,
        0xf75f1c,
        0xf8c300,
        0x008e44,
        0xa652bb,
        0xa5714e,
        0x2f3136,
        0xf75f1c,
        0x0099e1,
        ]

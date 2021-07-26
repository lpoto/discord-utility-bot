from dotenv import dotenv_values
from discord import Client
import discord
import sys
import random
# enable all intents to get member info etc.
# application on the discord dev website needs to have
# presence and server members intent enabled under BOT
cfg = dotenv_values('.env')
# default prefix key used before commands
DEFAULT_PREFIX = cfg['DEFAULT_PREFIX']
# discord application's private token
DISCORD_TOKEN = cfg['DISCORD_TOKEN']


def get_database_info():
    # get all the mysql data info from .env
    info = {}
    for i in ['USER', 'PASSWORD', 'HOST', 'DATABASE']:
        if i not in cfg:
            return None
        info[i.lower()] = cfg[i]
    if 'PORT' in cfg:
        info['port'] = int(cfg['PORT'])
    return info


def random_color():
    # generate a random color (mostly for embeds)
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)


async def msg_send(
        channel,
        text=None,
        embed=None,
        delete_after=None,
        reactions=None):
    if (str(channel.type) == 'text' and
        has_permissions(
            channel.guild.me, channel, 'send_messages') is not True):
        return
    msg = await channel.send(
        content=text,
        embed=embed,
        delete_after=delete_after)
    if reactions is not None:
        if not isinstance(reactions, list):
            reactions = [reactions]
        for i in reactions:
            await msg_react(msg, i)
    return msg


async def msg_edit(
        msg,
        text=None,
        embed=None,
        delete_after=None,
        reactions=None):
    await msg.edit(
        content=text, embed=embed, delete_after=delete_after)
    if reactions is not None:
        if not isinstance(reactions, list):
            reactions = [reactions]
        for i in reactions:
            await msg_react(msg=msg, emoji=i)
    return msg


async def msg_delete(msg, delay=None):
    if (msg.author.id != msg.guild.me.id and
        has_permissions(
            msg.guild.me, msg.channel, 'send_messages') is not True):
        return
    await msg.delete(delay=delay)
    return True


async def msg_react(msg, emoji):
    if (str(msg.channel.type) == 'text' and
        has_permissions(
            msg.guild.me, msg.channel, 'add_reactions') is not True):
        return
    await msg.add_reaction(emoji)
    return True


async def msg_reaction_remove(msg, emoji, member=None):
    if member is None:
        if (has_permissions(
                msg.guild.me, msg.channel, 'manage_messages') is True):
            await msg.clear_reaction(emoji)
        else:
            await msg.remove_reaction(emoji, msg.guild.me)
        return
    if (msg.guild.me.id != member.id and
        has_permissions(
            msg.guild.me, msg.channel, 'manage_messages') is not True):
        return
    await msg.remove_reaction(emoji, member)


# currently running queues
running_queues = {}


async def clear_queue(queue_type, ignore_running, queue, function):
    # clear messages or reaction in queue to avoid
    # multiple instances of same command or reactions
    if ((queue_type not in running_queues or
         ignore_running) and len(queue) > 0):
        if queue_type not in running_queues:
            running_queues[queue_type] = True
        item = queue.popleft()
        x = await function(item)
        await clear_queue(queue_type, True, queue, function)
    else:
        if queue_type in running_queues:
            del running_queues[queue_type]


def has_permissions(user, channel, perms):
    if not isinstance(perms, list):
        perms = [perms]
    for i in perms:
        if not dict(iter(user.permissions_in(channel)))[i]:
            return i
    return True


async def prefix_from_database(msg, database):
    # try to get prefix from database, return default prefix if unsuccessful
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


async def get_prefix(msg, database):
    prefix = await prefix_from_database(msg, database)
    if prefix is None:
        return DEFAULT_PREFIX
    return prefix


async def get_welcome(server, database):
    # get guild's welcome text from database
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


async def get_required_roles(msg, command, database):
    # get which roles can use a command from database
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


async def roles_for_all_commands(msg, database):
    if not database.connected:
        return None
    cursor = database.cnx.cursor(buffered=True)
    cursor.execute(
        "SELECT * FROM commands WHERE guild_id = '{}'".format(
            msg.guild.id))
    fetched = cursor.fetchall()
    if fetched is None:
        return embed
    prefix = await get_prefix(msg, database)
    txt = ''
    for i in range(len(fetched)):
        txt += '{}{}: [{}]'.format(
            prefix, fetched[i][1], ', '.join(fetched[i][2].split('<;>')))
        if i < len(fetched) - 1:
            txt += ',\n'
    return txt


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
# thumbs up emoji
thumbs_up = u"\U0001F44D"
number_emojis = [u"\U00000031\U0000FE0F\U000020E3",
                 u"\U00000032\U0000FE0F\U000020E3",
                 u"\U00000033\U0000FE0F\U000020E3",
                 u"\U00000034\U0000FE0F\U000020E3",
                 u"\U00000035\U0000FE0F\U000020E3",
                 u"\U00000036\U0000FE0F\U000020E3",
                 u"\U00000037\U0000FE0F\U000020E3"]
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
    0,
    0xffffff,
    0xc30202,
    0x0099e1,
    0xf75f1c,
    0xf8c300,
    0x008e44,
    0xa652bb,
    0xa5714e,
    0,
    0xf75f1c,
    0x0099e1,
]

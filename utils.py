import os
from dotenv import load_dotenv
import discord
import random

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
        if (hasattr(error, 'code') and str(error.code) == '50001'
                and msg is not None):
            await msg.channel.send('Missing access to a channel.')
        elif (hasattr(error, 'code') and str(error.code) == '50013'
                and msg is not None):
            txt = 'I am missing the required permissions!'
            await message_delete(msg, 5, txt)
        elif (hasattr(error, 'code') and
                str(error.code) not in ['10008', '50001', '50013'] or
                not hasattr(error, 'code')):
            if msg is not None:
                txt = 'Something went wrong!'
                await message_delete(msg, 5, txt)
            print('Error ({}):\n{}'.format(origin, error))
    except Exception as err:
        print('Error -> (utils.py -> send_error())' + str(err))


async def get_prefix(msg, throwerr=True):
    try:
        channel = discord.utils.get(
            msg.guild.channels,
            name='bot-config')
        if channel is None:
            return DEFAULT_PREFIX
        settings = await channel.history(limit=3).flatten()
        prefix_msg = None
        for m in settings:
            if (m.author.id == msg.guild.me.id and
                    m.content.startswith('`PREFIX`')):
                prefix_msg = m
                break
        if prefix_msg is None:
            return DEFAULT_PREFIX
        x = prefix_msg.content.split('\n')
        if len(x) != 2:
            return DEFAULT_PREFIX
        return x[1]
    except Exception as error:
        if not(hasattr(error, 'code') and str(error.code) == '50001'):
            await send_error(msg, error, 'utils.py -> get_prefix()')
        elif (hasattr(error, 'code') and str(error.code) == '50001'
                and throwerr):
            await msg.channel.send('Missing access to config channel!')
        return DEFAULT_PREFIX


async def get_roleschannel(msg):
    try:
        channel = discord.utils.get(
            msg.guild.channels,
            name='bot-config')
        if channel is None:
            return None
        settings = await channel.history(limit=3).flatten()
        roles_msg = None
        for m in settings:
            if (m.author.id == msg.guild.me.id and
                    m.content.startswith('`ROLES CHANNEL`')):
                roles_msg = m
                break
        if roles_msg is None:
            return None
        x = roles_msg.content.split('\n')
        if len(x) != 2 or x[1] == '/':
            return None
        roleschannel = discord.utils.get(
            msg.guild.channels,
            name=x[1])
        if roleschannel is None:
            return None
        return roleschannel
    except Exception as error:
        if hasattr(error, 'code') and str(error.code) == '50001':
            await msg.channel.send('Missing access to config channel!')
        else:
            await send_error(None, error, 'utils.py -> get_roleschannel()')
        return None


async def get_required_roles(msg, command):
    try:
        channel = discord.utils.get(
            msg.guild.channels,
            name='bot-config')
        if channel is None:
            return None
        settings = await channel.history(limit=3).flatten()
        roles_msg = None
        for m in settings:
            if (m.author.id == msg.guild.me.id and
                    m.content.startswith('`COMMANDS`')):
                roles_msg = m
                break
        if roles_msg is None:
            return None
        x = roles_msg.content.split('\n')
        if len(x) < 2 or len(x) == 2 and x[1] == '/':
            return None
        for i in x:
            if i.startswith('`{}`'.format(command)):
                return i.split(', ')[1:]
        return None
    except Exception as error:
        if hasattr(error, 'code') and str(error.code) == '50001':
            await msg.channel.send('Missing access to config channel!')
        else:
            await send_error(None, error, 'utils.py -> get_required_roles()')
        return None

emojis = {
    'white_circle': u"\u26AA",
    'black_circle': u"\u26AB",
    'red_circle': u"\U0001F534",
    'blue_circle': u"\U0001F535",
    'orange_circle': u"\U0001F7E0",
    'yellow_circle': u"\U0001F7E1",
    'green_circle': u"\U0001F7E2",
    'purple_circle': u"\U0001F7E3",
    'brown_circle': u"\U0001F7E4",
    'white_square': u"\U00002B1C",
    'black_square': u"\U00002B1B",
    'red_square': u"\U0001F7E5",
    'blue_square': u"\U0001F7E6",
    'orange_square': u"\U0001F7E7",
    'yellow_square': u"\U0001F7E8",
    'green_square': u"\U0001F7E9",
    'purple_square': u"\U0001F7EA",
    'brown_square': u"\U0001F7EB",
    'waste_basket': '🗑️'
}

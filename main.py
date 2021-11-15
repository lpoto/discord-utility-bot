import discord
import logging
import os
from dotenv import load_dotenv

from bot.bot import Bot
from bot.client import UtilityClient

load_dotenv()

DISCORD_TOKEN = os.environ.get('DISCORD_TOKEN')
LOG_FILE = os.environ.get('LOGFILE')
DEFAULT_PREFIX = os.environ.get('DEFAULT_PREFIX')

# do not warn about PyNaCl not installed
discord.VoiceClient.warn_nacl = False

# send only warnings and errors from discord module
logging.getLogger('discord').setLevel(logging.WARN)
# set up default logging config, log to file if filename provided
logging.basicConfig(
    format='%(asctime)s %(levelname)s: %(message)s',
    datefmt='%H:%M:%S %d-%m-%Y',
    level=logging.INFO,
    filename=LOG_FILE)

bot = Bot(DEFAULT_PREFIX)
client = UtilityClient(intents=discord.Intents.all(), bot=bot)

try:
    client.run(token=DISCORD_TOKEN, reconnect=True)
except Exception as exception:
    logging.error(exception)

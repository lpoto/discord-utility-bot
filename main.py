import logging
import nextcord
import sys
from dotenv import load_dotenv

from version import __version__

from bot.utils import get_required_bot_env_variables
from bot import UtilityClient
from database import Database
from database.utils import get_required_database_env_variables


def set_default_logging():
    nextcord.VoiceClient.warn_nacl = False
    logging.getLogger('nextcord').setLevel(logging.CRITICAL)
    logging.basicConfig(
        format='%(levelname)s: %(message)s',
        level=logging.INFO)


def get_flag_and_version(version):
    flag = 'prod' if any(i == '--prod' for i in sys.argv) else 'dev'
    version = version if flag == 'prod' else version + '-dev'
    logging.info(msg='Running in "{}" mode'.format(flag))
    return flag, version


def run_the_client(database_info, token, version, bot_logging, db_logging):
    if not token:
        return logging.critical(msg='Missing nextcord token')
    if not database_info:
        return logging.critical(msg='Missing database info')
    database = Database(
        info=database_info,
        log_level=db_logging)
    if not database or not database.connected:
        return logging.critical('Could not connect to database!')
    client = UtilityClient(
        intents=nextcord.Intents.all(),
        version=version,
        database=database,
        log_level=bot_logging)
    client.run(token=token, reconnect=True)


load_dotenv()
set_default_logging()
FLAG, VERSION = get_flag_and_version(__version__)
DISCORD_TOKEN, BOT_LOGGING = get_required_bot_env_variables(FLAG)
DATABASE_INFO, DB_LOGGING = get_required_database_env_variables(FLAG)
run_the_client(DATABASE_INFO, DISCORD_TOKEN, VERSION, BOT_LOGGING, DB_LOGGING)

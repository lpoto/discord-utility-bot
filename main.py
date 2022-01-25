import logging
import nextcord
from dotenv import load_dotenv

from bot.utils import get_required_bot_env_variables
from bot import UtilityClient, __version__
from database import MySQL
from database.utils import get_required_database_env_variables


def set_default_logging():
    nextcord.VoiceClient.warn_nacl = False
    logging.getLogger('nextcord').setLevel(logging.CRITICAL)
    logging.basicConfig(
        format='%(levelname)s: %(message)s',
        level=logging.INFO)


def run_the_client(database_info, token, version, bot_logging, db_logging):
    if not token:
        return logging.critical(msg='Missing a discord token')
    if not database_info:
        return logging.critical(msg='Missing database info')

    database = MySQL(
        info=database_info,
        log_level=db_logging)
    if not database or not database.connected:
        return logging.critical('Could not connect to database!')

    client = UtilityClient(
        intents=nextcord.Intents.all(),
        version=version,
        database=database,
        log_level=bot_logging,
    )
    client.run(token=token, reconnect=True)


load_dotenv()
set_default_logging()
DISCORD_TOKEN, CLIENT_LOGGING = get_required_bot_env_variables()
DATABASE_INFO, DB_LOGGING = get_required_database_env_variables()
run_the_client(
    version=__version__,
    token=DISCORD_TOKEN,
    database_info=DATABASE_INFO,
    bot_logging=CLIENT_LOGGING,
    db_logging=DB_LOGGING
)

import os
import logging


def get_required_bot_env_variables():
    keys = ('DISCORD_TOKEN', 'CLIENT_LOGGING')
    r = []
    for k in keys:
        r.append(os.environ.get(k))
        if not r[-1]:
            logging.warning(msg=f'Missing env variable "{k}"')
    return r

import os
import logging


def get_required_bot_env_variables(flag):
    keys = ('DISCORD_TOKEN', 'BOT_LOGGING')
    if flag == 'dev':
        keys = tuple(f'DEV_{i}' for i in keys)
    r = []
    for k in keys:
        r.append(os.environ.get(k))
        if not r[-1]:
            logging.warning(msg=f'Missing env variable "{k}"')
    return r

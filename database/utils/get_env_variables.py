import os
import logging


def get_required_database_env_variables():
    info = {
            'database': 'POSTGRES_DB',
            'host': 'POSTGRES_HOST',
            'port': 'POSTGRES_PORT',
            'user': 'POSTGRES_USER',
            'password': 'POSTGRES_PASSWORD'
            }
    logging_level_key = 'POSTGRES_LOGGING'
    return_info = {}
    no_info = False
    for k, v in info.items():
        return_info[k] = os.environ.get(v)
        if not return_info[k]:
            no_info = True
            logging.warning(f'Missing env variable "{v}"')
    logging_level = os.environ.get(logging_level_key)
    if not logging_level:
        logging.warning(f'Missing env variable "{logging_level_key}"')
    return None if no_info else return_info, logging_level

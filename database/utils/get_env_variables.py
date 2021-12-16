import os
import logging


def get_required_database_env_variables(flag='dev'):
    info = {
        'database': None,
        'host': None,
        'user': None,
        'password': None
    }
    no_info = False
    for k in info.keys():
        variable_name = k.upper() if flag != 'dev' else 'DEV_' + k.upper()
        info[k] = os.environ.get(variable_name)
        if not info[k]:
            no_info = True
            logging.warning(f'Missing env variable "{variable_name}"')
    logging_level_key = 'DB_LOGGING' if flag == 'prod' else 'DEV_DB_LOGGING'
    logging_level = os.environ.get(logging_level_key)
    if not logging_level:
        logging.warning(f'Missing env variable "{logging_level_key}"')
    return None if no_info else info, logging_level

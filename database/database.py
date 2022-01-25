import logging
from mysql.connector import pooling, Error, PoolError

import database.services as services


class MySQL:
    def __init__(self, info, log_level):
        self.logger = logging.getLogger('database')
        self.logger.setLevel(logging.INFO if not log_level else int(log_level))
        self.connection_pool = None
        if not self.connect_database(info):
            return

        # create instances of all service classes
        # (Messages, Config, Users)
        for Service in (r for r in services.__dict__.values()
                        if isinstance(r, type)):

            self.logger.debug(msg='Initializing database service "{}"'.format(
                Service.__name__))

            r = Service(self)
            setattr(self, Service.__name__, r)
            if not hasattr(r, 'required_tables'):
                continue
            if not self.create_tables(r.required_tables):
                return

        self.logger.debug(msg='Database ready!\n')

    @property
    def connection_object(self) -> None or pooling.PooledMySQLConnection:
        try:
            if self.connection_pool is not None:
                return self.connection_pool.get_connection()
        except PoolError as err:
            self.logger.warning(
                f'Error getting connection object:\n{str(err)}')

    @property
    def connected(self) -> bool:
        # determine wether bot is connected
        # to a database
        try:
            cnx = self.connection_object
            if cnx is None:
                return False
            c = cnx.is_connected()
            cnx.close()
            return c
        except Exception as err:
            self.logger.error(str(err))
            return False

    def connect_database(self, info: dict) -> bool:

        self.logger.debug(msg='Connecting database\n')

        cnx = None
        cursor = None
        if info is None:
            self.logger.warn(msg='No database info provided.')
            return False
        try:
            # create a pool as the bot is accessing the
            # database quite often
            self.connection_pool = pooling.MySQLConnectionPool(
                pool_name='pool',
                pool_size=5,
                pool_reset_session=True,
                host=info['host'],
                database=info['database'],
                user=info['user'],
                password=info['password'])

            cnx = self.connection_object
            if cnx is None or not cnx.is_connected():
                self.logger.warn(
                    msg='Failed to establish database connection.')
                return False
            cursor = cnx.cursor()
            cursor.execute('select database();')
            result = cursor.fetchone()[0]

            self.logger.info(msg=f'Database: {result}')

        except Error as err:
            if err.errno == 2006:
                return self.connect_database(info)
            self.logger.error(msg=str(err))
        finally:
            if cursor:
                cursor.close()
            if cnx:
                cnx.close()
            return self.connected

    def create_tables(self, tables: dict) -> bool:
        """
        Check if all the required tables exist, and create
        those that do not.
        """
        try:
            cnx = self.connection_object
            if not cnx:
                return False
            cursor = cnx.cursor()
            if not cursor:
                return False
            for k, v in tables.items():
                table_name = k.strip('`')
                self.logger.debug(msg=f'Checking for table "{table_name}"')

                cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
                fetched = cursor.fetchone()
                if not fetched and v.get('columns'):
                    self.logger.debug(msg=f'Creating table "{table_name}"')

                    constraints = v.get('columns')
                    if v.get('constraints'):
                        constraints += v.get('constraints')

                    cursor.execute(
                        f"CREATE TABLE {k} ({', '.join(constraints)})")
                    self.logger.info(msg=f'Created table "{table_name}"')

                if (v.get('indexes')):
                    self.logger.debug(
                        msg=f'Checking for indexes on table "{table_name}"')

                    for column_name in v.get('indexes'):
                        cursor.execute((
                            "SHOW index FROM {} WHERE column_name = '{}'"
                        ).format(k, column_name))
                        fetched = cursor.fetchone()
                        if not fetched:
                            cursor.execute(
                                "CREATE INDEX {}_index ON {}({})".format(
                                    column_name, k, column_name
                                ))
                            self.logger.info(
                                msg=f'Created index "{column_name}_index"')

            cursor.close()
            cnx.close()
            self.logger.debug(msg='Service ready!')
            return True
        except Exception as err:
            self.logger.warning(f'Error creating tables: {str(err)}')
            return False

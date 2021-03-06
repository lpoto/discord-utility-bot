import logging
import psycopg2
import psycopg2.extras

import database.services as services


class Postgres:
    def __init__(self, info, log_level):
        self.logger = logging.getLogger('database')
        self.logger.setLevel(logging.INFO if not log_level else int(log_level))
        self.info = info
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
    def connection_object(self):
        try:
            return psycopg2.connect(
                host=self.info['host'],
                user=self.info['user'],
                database=self.info['database'],
                password=self.info['password'],
                cursor_factory=psycopg2.extras.RealDictCursor
            )
        except psycopg2.Error as err:
            self.logger.warning(
                f'Error getting connection object:\n{str(err)}')

    @property
    def connected(self) -> bool:
        # determine wether bot is connected
        # to a database
        try:
            cnx = self.connection_object
            if not cnx:
                return False
            cnx.close()
            return True
        except Exception as err:
            self.logger.error('Error checking db connection' + str(err))
            return False

    def connect_database(self, info: dict) -> bool:

        self.logger.debug(msg='Connecting database\n')
        self.logger.debug(info)

        cnx = None
        cursor = None
        if info is None:
            self.logger.warn(msg='No database info provided.')
            return False
        try:
            # create a pool as the bot is accessing the
            # database quite often
            cnx = self.connection_object

            if not cnx:
                self.logger.warn(
                    msg='Failed to establish database connection.')
                return False
            cursor = cnx.cursor()

        except psycopg2.Error as e:
            if hasattr(e, 'errno') and e.errno == 2006:
                return self.connect_database(info)
            self.logger.error(
                msg='Error when connecting database' + str(e))
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

                cursor.execute(
                    "select exists({}'{}')".format(
                        'select relname from pg_class where relname=',
                        table_name
                    )
                )

                fetched = cursor.fetchone()

                if (
                        (
                            not fetched or
                            not fetched.get('exists')
                        ) and v.get('columns')
                ):
                    self.logger.debug(msg=f'Creating table "{table_name}"')

                    constraints = v.get('columns')
                    if v.get('constraints'):
                        constraints += v.get('constraints')

                    cursor.execute(
                        f"CREATE TABLE {k} ({', '.join(constraints)})")
                    self.logger.info(msg=f'Created table "{table_name}"')

                    if (v.get('indexes')):
                        for column_name in v.get('indexes'):
                            cursor.execute(
                                "CREATE INDEX {}_{}_index ON {}({})".format(
                                    table_name, column_name, k, column_name
                                ))
                            self.logger.info(
                                msg='Created index "{}_{}_index"'.format(
                                    table_name, column_name
                                )
                            )
                    cnx.commit()

            cursor.close()
            cnx.close()
            self.logger.debug(msg='Service ready!')
            return True
        except Exception as e:
            self.logger.error(
                msg='Error when creating tables' + str(e))
            return False

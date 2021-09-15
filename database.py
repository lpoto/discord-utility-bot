import logging
import asyncio
from mysql.connector import pooling, Error
import os


class DB:
    def __init__(self, default_prefix, default_deletion_times):
        self.connection_pool = None
        self.default_prefix = default_prefix
        self.default_deletion_times = default_deletion_times

    @property
    def connection_object(self) -> None or pooling.PooledMySQLConnection:
        if self.connection_pool is not None:
            return self.connection_pool.get_connection()

    @property
    def connected(self) -> bool:
        # determine wether bot is connected
        # to a database
        cnx = self.connection_object
        if cnx is None:
            return False
        c = cnx.is_connected()
        cnx.close()
        return c

    @property
    def get_info(self) -> None or dict:
        info = {}
        for i in ['USER', 'PASSWORD', 'HOST', 'DATABASE']:
            x = os.environ.get(i)
            if x is None:
                return None
            info[i.lower()] = x
        return info

    @property
    def required_tables(self) -> dict:
        """
        All the required tables used by the bot.
        """
        return {
            'wins': [
                'game VARCHAR(20) NOT NULL',
                'guild_id VARCHAR(18) NOT NULL',
                'user_id VARCHAR(18) NOT NULL',
                'wins INT UNSIGNED'],
            'messages': [
                'type VARCHAR(20) NOT NULL',
                'channel_id VARCHAR(18) NOT NULL',
                'message_id VARCHAR(18) NOT NULL',
                'user_id VARCHAR(18) NOT NULL',
                'info VARCHAR(30) NOT NULL',
                'deletion_time VARCHAR(8)'],
            'config': [
                'option VARCHAR(20) NOT NULL',
                'guild_id VARCHAR(18) NOT NULL',
                'info VARCHAR(100) NOT NULL',
                'info2 VARCHAR(50)'],
            'connect_four_records': [
                'moves VARCHAR(43) NOT NULL'],
        }

    async def connect_database(self, info=None):
        """
        Connect a MySQL database from provided info.
        """
        info = info if info is not None else self.get_info
        cnx = None
        if info is None:
            logging.info(msg='No database info provided.')
            self.name = None
            return
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
                self.name = None
                logging.info(msg='Failed to establish database connection.')
                return
            cursor = cnx.cursor()
            cursor.execute('select database();')
            result = cursor.fetchone()[0]
            # if any of the required tables are missing
            # create new tables
            t = await self.use_database(self.create_tables)
            logging.info(msg='Database: {}'.format(result))
            if t is not None and len(t) > 0:
                logging.info(msg='Created database tables:\n{}'.format(
                    '\n'.join(t)))
        except Error as err:
            self.name = None
            if err.errno == 2006:
                return await self.connect_database()
            logging.warning(msg=err)
        finally:
            if cnx is None or not cnx.is_connected():
                return
            cursor.close()
            cnx.close()

    async def use_database(self, function, *args, repeat=True):
        """
        Pass connection_object().cursor() to a function that
        edits the database. Commit changes and close cursor on
        successful call.
        """
        # always use this command to edit database
        cnx = self.connection_object
        reconnect = False
        try:
            if cnx is None or not cnx.is_connected():
                return
            cursor = cnx.cursor(buffered=True)
            result = None
            if asyncio.iscoroutinefunction(function):
                result = await function(cursor, *args)
            else:
                result = function(cursor, *args)
            cnx.commit()
            cursor.close()
            return result
        except Error as err:
            if err.errno == 2006:
                reconnect = True
            else:
                logging.error(msg=err)
        finally:
            if cnx is not None and cnx.is_connected():
                cursor.close()
                cnx.close()
            elif reconnect:
                await self.connect_database()
                if repeat:
                    self.use_database(function, *args, repeat)

    async def create_tables(self, cursor) -> list:
        """
        Check if all the required tables exist, and create
        those that do not.
        """
        tables = self.required_tables
        tbs = []
        for k, v in tables.items():
            cursor.execute("SHOW TABLES LIKE '{}'".format(k))
            fetched = cursor.fetchone()
            if fetched is None:
                cursor.execute("CREATE TABLE {} ({})".format(
                    k, ', '.join(v)))
                txt2 = '   - {}'.format(k)
                tbs.append(txt2)
        return tbs

    async def get_prefix(self, msg) -> str:
        """
        Fetch a prefix used in message's server from database.
        """
        prefix = await self.use_database(
            self.prefix_from_database, msg.guild.id)
        if prefix is None:
            return self.default_prefix
        return prefix

    async def get_welcome(self, server) -> str or None:
        """
        Get the text that the bot should send when a new member
        joins the server.
        """
        # get guild's welcome text from database
        return await self.use_database(self.welcome_from_database, server.id)

    async def get_required_roles(self, msg, command) -> list or None:
        """
        Get the roles that are allowed to use the command in
        a message's discord server
        """
        return await self.use_database(
            self.required_roles_from_database, msg.guild.id, command)

    async def get_deletion_time(self, msg, msg_type) -> int or None:
        """
        Get the time before the games messages are deleted
        in the messages's discord server.
        """
        return await self.use_database(
            self.deletion_time_from_database, msg.guild.id, msg_type)

    async def prefix_from_database(self, cursor, guild_id):
        cursor.execute((
            "SELECT * FROM config WHERE option = 'prefix' " +
            "AND guild_id = '{}'").format(
            guild_id))
        fetched = cursor.fetchone()
        return self.default_prefix if fetched is None else fetched[2]

    async def welcome_from_database(self, cursor, guild_id):
        cursor.execute((
            "SELECT * FROM config WHERE option = 'welcome_text' " +
            "AND guild_id = '{}'").format(
            guild_id))
        fetched = cursor.fetchone()
        return None if fetched is None else fetched[2]

    async def required_roles_from_database(self, cursor, guild_id, command):
        cursor.execute((
            "SELECT * FROM config WHERE option = 'roles' " +
            "AND guild_id = '{}' AND info2 = '{}'").format(
            guild_id, command))
        fetched = cursor.fetchall()
        return None if fetched is None else [x[2] for x in fetched]

    async def deletion_time_from_database(self, cursor, guild_id, msg_type):
        cursor.execute((
            "SELECT * FROM config WHERE option = 'deletion_time' " +
            "AND guild_id = '{}' AND info2 = '{}'").format(
                guild_id, msg_type))
        fetched = cursor.fetchone()
        return self.default_deletion_times[
                msg_type] if fetched is None else int(fetched[2])

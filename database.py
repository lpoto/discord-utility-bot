import logging
from mysql.connector import pooling, Error
import os


class DB:
    def __init__(self, default_prefix):
        self.connection_pool = None
        self.default_prefix = default_prefix

    @property
    def connection_object(self) -> None or pooling.PooledMySQLConnection:
        if self.connection_pool is not None:
            return self.connection_pool.get_connection()

    @property
    def connected(self) -> bool:
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
        """All the required tables used by the bot."""
        return {
            'prefix': [
                'guild_id VARCHAR(18) NOT NULL',
                'prefix VARCHAR(5) NOT NULL'],
            'commands': [
                'guild_id VARCHAR(18) NOT NULL',
                'command VARCHAR(30) NOT NULL',
                'roles VARCHAR(100) NOT NULL'],
            'welcome': [
                'guild_id VARCHAR(18) NOT NULL',
                'welcome VARCHAR(50) NOT NULL'],
            'rock_paper_scissors': [
                'guild_id VARCHAR(18) NOT NULL',
                'user_id VARCHAR(18) NOT NULL',
                'wins INT UNSIGNED'],
            'connect_four': [
                'guild_id VARCHAR(18) NOT NULL',
                'user_id VARCHAR(18) NOT NULL',
                'wins INT UNSIGNED'],
            'connect_four_records': [
                'moves VARCHAR(43) NOT NULL'],
            'events': [
                'datetime VARCHAR(11) NOT NULL',
                'channel_id VARCHAR(18) NOT NULL',
                'event VARCHAR(100) NOT NULL',
                'text VARCHAR(300) NOT NULL',
                'tags VARCHAR(300) NOT NULL']
        }

    async def connect_database(self, info=None):
        """Connect a MySQL database from provided info."""
        info = info if info is not None else self.get_info
        cnx = None
        # if database is given, connect
        if info is None:
            logging.info(msg='No database info provided.\n')
            self.name = None
            return
        try:
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
        cnx = None
        cnx = self.connection_object
        reconnect = False
        try:
            if cnx is None or not cnx.is_connected():
                return
            cursor = cnx.cursor(buffered=True)
            result = None
            try:
                result = await function(cursor, *args)
            except TypeError:
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
            if reconnect:
                self.connect_database()
                if repeat:
                    self.use_database(function, *args, repeat)

    async def create_tables(self, cursor) -> list:
        """Check if all the required tables exist, and create
        those that do not."""
        tables = self.required_tables
        tbs = []
        for i in tables.keys():
            cursor.execute("SHOW TABLES LIKE '{}'".format(i))
            fetched = cursor.fetchone()
            if fetched is None:
                cursor.execute("CREATE TABLE {} ({})".format(
                    i, ', '.join(tables[i])))
                txt2 = '   - {}'.format(i)
                tbs.append(txt2)
        return tbs

    async def get_prefix(self, msg) -> str:
        """Fetch a prefix used in message's server from database."""
        prefix = await self.use_database(
            self.prefix_from_database, msg)
        if prefix is None:
            return self.default_prefix
        return prefix

    async def get_welcome(self, server) -> str or None:
        """Get the text that the bot should send when a new member
        joins the server."""
        # get guild's welcome text from database
        return await self.use_database(self.welcome_from_database, server)

    async def get_required_roles(self, msg, command) -> list or None:
        """ Get the roles that are allowed to use the command in
        a message's discord server"""
        return await self.use_database(
            self.required_roles_from_database, msg, command)

    async def roles_for_all_commands(self, msg) -> str or None:
        """ Return all the commands that have required roles set
        up in the message's discord server."""
        return await self.use_database(
            self.roles_for_all_commands_from_database, msg)

    async def prefix_from_database(self, cursor, msg):
        query = "SELECT * FROM prefix WHERE guild_id = '{}'".format(
            msg.guild.id)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return self.default_prefix
        return fetched[1]

    async def welcome_from_database(self, cursor, server):
        query = "SELECT * FROM welcome WHERE guild_id = '{}'".format(
            server.id)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return None
        return fetched[1]

    async def required_roles_from_database(self, cursor, msg, command):
        query = ("SELECT * FROM commands WHERE guild_id = '{}' AND " +
                 "command = '{}'").format(
            msg.guild.id, command)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return None
        return fetched[2].split('<;>')

    async def roles_for_all_commands_from_database(self, cursor, msg):
        cursor.execute(
            "SELECT * FROM commands WHERE guild_id = '{}'".format(
                msg.guild.id))
        fetched = cursor.fetchall()
        if fetched is None or fetched == []:
            return
        prefix = await self.get_prefix(msg)
        txt = ''
        for i in range(len(fetched)):
            txt += '{}{}: [{}]'.format(
                prefix, fetched[i][1], ', '.join(fetched[i][2].split('<;>')))
            if i < len(fetched) - 1:
                txt += ',\n'
        return txt

from utils import DEFAULT_PREFIX
import mysql.connector
import os


class DB:
    def __init__(self):
        self.cnx = None
        self.connected = False
        self.name = None

    def connect_database(self, info=None):
        info = self.get_info()
        # if database is give, connect
        if info is None:
            self.name = None
            return 'Database: None'
        try:
            self.cnx = mysql.connector.connect(**info)
            self.connected = True
            # check if all required tables exist, if not,
            # create them
            txt = self.create_tables(info)
            self.name = info['database']
            return txt
        except mysql.connector.Error as err:
            self.name = None
            self.connected = False
            if err.errno == 2006:
                return self.connect_database(info)
            return 'Database error:\n{}'.format(err)

    def get_info(self):
        info = {}
        for i in ['USER', 'PASSWORD', 'HOST', 'DATABASE']:
            x = os.environ.get(i)
            if x is None:
                return None
            info[i.lower()] = x
        x = os.environ.get('PORT')
        if x is not None:
            info['port'] = x
        return info

    def show_connection(self):
        txt = 'Database: '
        if self.connected and self.name:
            return txt + self.name
        return txt + 'None'

    def required_tables(self):
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
            'four_in_line': [
                'guild_id VARCHAR(18) NOT NULL',
                'user_id VARCHAR(18) NOT NULL',
                'wins INT UNSIGNED'],
            'four_in_line_records': [
                'moves VARCHAR(43) NOT NULL'],
            'events': [
                'datetime VARCHAR(11) NOT NULL',
                'channel_id VARCHAR(18) NOT NULL',
                'event VARCHAR(100) NOT NULL',
                'text VARCHAR(300) NOT NULL',
                'tags VARCHAR(300) NOT NULL']
        }

    def create_tables(self, info):
        txt = None
        try:
            tables = self.required_tables()
            for i in tables.keys():
                query = (
                    "SHOW TABLES LIKE '{}'").format(i)
                cursor = self.cnx.cursor(buffered=True)
                cursor.execute(query)
                fetched = cursor.fetchone()
                if fetched is None:
                    query = (
                        "CREATE TABLE {} ({})".format(
                            i, ', '.join(tables[i])))
                    cursor.execute(query)
                    txt = '- Created {} table "{}"'.format(
                        info['database'], i)
                cursor.close()
            return txt
        except Exception as err:
            return err

    async def prefix_from_database(self, msg):
        # try to get prefix from database, return default prefix if failed
        if not self.connected:
            return DEFAULT_PREFIX
        query = "SELECT * FROM prefix WHERE guild_id = '{}'".format(
            msg.guild.id)
        cursor = self.cnx.cursor(buffered=True)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return DEFAULT_PREFIX
        return fetched[1]
        cursor.close()

    async def get_prefix(self, msg):
        prefix = await self.prefix_from_database(msg)
        if prefix is None:
            return DEFAULT_PREFIX
        return prefix

    async def get_welcome(self, server):
        # get guild's welcome text from database
        if not self.connected:
            return None
        query = "SELECT * FROM welcome WHERE guild_id = '{}'".format(
            server.id)
        cursor = self.cnx.cursor(buffered=True)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return None
        return fetched[1]
        cursor.close()

    async def get_required_roles(self, msg, command):
        # get which roles can use a command from database
        if not self.connected:
            return None
        query = ("SELECT * FROM commands WHERE guild_id = '{}' AND " +
                 "command = '{}'").format(
            msg.guild.id, command)
        cursor = self.cnx.cursor(buffered=True)
        cursor.execute(query)
        fetched = cursor.fetchone()
        if fetched is None:
            return None
        return fetched[2].split('<;>')

    async def roles_for_all_commands(self, msg):
        if not self.connected:
            return None
        cursor = self.cnx.cursor(buffered=True)
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

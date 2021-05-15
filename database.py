import mysql.connector


class DB:
    def __init__(self):
        self.cnx = None
        self.connected = False

    def connect_database(self, info):
        # if database is give, connect
        if info is None:
            print('Database: None')
            return
        try:
            self.cnx = mysql.connector.connect(**info)
            self.connected = True
            print('Database: ' + info['database'])
            # check if all required tables exist, if not,
            # create them
            self.create_tables(info)
        except mysql.connector.Error as err:
            self.connected = False
            if err.errno == 2006:
                self.connect_database(info)
                return
            print('Database error:\n', err)

    def required_tables(self):
        return {
            'prefix': [
                'guild_id VARCHAR(18) NOT NULL',
                'prefix VARCHAR(5) NOT NULL'],
            'roleschannel': [
                'guild_id VARCHAR(18) NOT NULL',
                'channel_id VARCHAR(18) NOT NULL'],
            'commands': [
                'guild_id VARCHAR(18) NOT NULL',
                'command VARCHAR(30) NOT NULL',
                'roles VARCHAR(100) NOT NULL'],
            'welcome': [
                'guild_id VARCHAR(18) NOT NULL',
                'welcome VARCHAR(50) NOT NULL'],
        }

    def create_tables(self, info):
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
                    print('- Created {} table {}'.format(
                        info['database'], i))
                cursor.close()
        except Exception as err:
            print('Error creating database tables:')
            print(err)

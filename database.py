import mysql.connector


class DB:
    def __init__(self):
        self.cnx = None
        self.connected = False

    def connect_database(self, info):
        # if database is give, connect
        if info is None:
            return 'Database: None'
        try:
            self.cnx = mysql.connector.connect(**info)
            self.connected = True
            # check if all required tables exist, if not,
            # create them
            txt = 'Database: ' + info['database']
            txt2 = self.create_tables(info)
            if txt2 is not None:
                txt = '{}\n{}'.format(txt, txt2)
            return txt
        except mysql.connector.Error as err:
            self.connected = False
            if err.errno == 2006:
                return self.connect_database(info)
            return 'Database error:\n{}'.format(err)

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
            'rock_paper_scissors': [
                'guild_id VARCHAR(18) NOT NULL',
                'user_id VARCHAR(18) NOT NULL',
                'wins INT UNSIGNED']
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

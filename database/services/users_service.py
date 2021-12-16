class Users:
    def __init__(self, database):
        self.database = database

    @property
    def required_tables(self) -> dict:
        return {
            'user_info': [
                'user_id BIGINT NOT NULL',
                'guild_id BIGINT NOT NULL',
                'name VARCHAR(50) NOT NULL',
                'info TINYTEXT NOT NULL',
                'PRIMARY KEY (user_id, guild_id, name)',
            ],
        }

    async def get_user_info(
            self, id: int, *, guild_id: int, name: str
    ) -> str or None:
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute('{} {} {}'.format(
            'SELECT info FROM user_info ',
            f'WHERE user_id = {id} AND guild_id = "{guild_id}" ',
            f'AND name = "{name}"'))
        opt = cursor.fetchone()
        cursor.close()
        cnx.close()
        return None if not opt or len(opt) == 0 else opt[0]

    async def get_info(self, *, guild_id: int, name: str) -> dict:
        cnx = self.database.connection_object
        cursor = cnx.cursor(dictionary=True)
        cursor.execute('{} {}'.format(
            'SELECT * FROM user_info WHERE ',
            f'guild_id = {guild_id} AND name = "{name}"'))
        opt = cursor.fetchall()
        cursor.close()
        cnx.close()
        return opt

    async def add_user_info(
            self, id: int, *, guild_id: int, name: str, info: str
    ) -> None:
        cnx = self.database.connection_object
        cursor = cnx.cursor(buffered=True)
        cursor.execute('INSERT INTO user_info ({}) VALUES ({})'.format(
            'user_id, guild_id, name, info',
            f'{id}, {guild_id}, "{name}", "{info}"'))
        cnx.commit()
        cursor.close()
        cnx.close()

    async def update_user_info(
            self, id: int, *, guild_id: int, name: str, info: str
    ) -> None:
        cnx = self.database.connection_object
        cursor = cnx.cursor(buffered=True)
        cursor.execute('UPDATE user_info set info = "{}" {}'.format(
            info,
            'WHERE user_id = {} AND guild_id = {} and name = "{}"'.format(
                id, guild_id, name)))
        cnx.commit()
        cursor.close()
        cnx.close()

    async def delete_user_info(
            self, id: int, *, guild_id: int, name: str
    ) -> None:
        cnx = self.database.connection_object
        cursor = cnx.cursor(buffered=True)
        cursor.execute('DELETE FROM user_info {}'.format(
            'WHERE user_id = {} AND guild_id = {} and name = "{}"'.format(
                id, guild_id, name)))
        cnx.commit()
        cursor.close()
        cnx.close()

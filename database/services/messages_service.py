class Messages:
    def __init__(self, database):
        self.database = database

    @property
    def required_tables(self) -> dict:
        return {
            'message': {
                'columns': [
                    'id BIGINT NOT NULL',
                    'channel_id BIGINT NOT NULL',
                    'author_id BIGINT',
                    'type VARCHAR(20)',
                ],
                'constraints': [
                    'PRIMARY KEY (id)',
                ]
            },
            'message_info': {
                'columns': [
                    'id SERIAL PRIMARY KEY',
                    'message_id BIGINT NOT NULL',
                    'name VARCHAR(50) NOT NULL',
                    'info TEXT',
                    'user_id BIGINT',
                ],
                'constraints': [
                    'UNIQUE (message_id, name, user_id)',
                    ('FOREIGN KEY (message_id) REFERENCES message(id) ' +
                     'ON DELETE CASCADE')
                ],
                'indexes': [
                    'message_id',
                    'name'
                ]
            }
        }

    async def get_message(
            self, id: int, *, info: bool = False
    ) -> dict or None:
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute(f'SELECT * FROM message WHERE id = {id}')
        msg = cursor.fetchone()
        cursor.close()
        cnx.close()
        if msg is not None and info:
            info = await self.get_message_info(id=id)
            if info is not None:
                msg['info'] = info
        return msg

    async def get_message_info(
            self, id: int, *, name: str = None, user_id: int = None
    ) -> list:
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        query = f'SELECT * FROM message_info WHERE message_id = {id}'
        if name is not None:
            query += f' AND name = "{name}"'
        if user_id is not None:
            query += f' AND user_id = {user_id}'
        cursor.execute(query)
        info = cursor.fetchall()
        cursor.close()
        cnx.close()
        return info

    async def get_messages_by_info(self, *, name: str) -> list:
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute(
            'SELECT m.id, m.channel_id, m.author_id, m.type, ' +
            'i.name as info_name, i.info, i.user_id as info_user_id ' +
            'FROM message m JOIN' +
            f" message_info i ON m.id = i.message_id WHERE i.name = '{name}'")
        info = cursor.fetchall()
        cursor.close()
        cnx.close()
        return info

    async def add_message(
            self, id: int, *, channel_id: int, type: str = None,
            author_id: int = None, info: list = None
    ) -> None:
        keys = 'id, channel_id, type, author_id'
        values = '{}, {}, {}, {}'.format(
            id, channel_id,
            'NULL' if not type else f'"{type}"',
            'NULL' if not author_id else author_id)
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute(f'INSERT INTO message({keys}) VALUES ({values})')
        if info is not None and len(info) > 0:
            cursor.execute('INSERT INTO message_info ({}) VALUES {}'.format(
                'message_id, name, info, user_id',
                ', '.join('({}, "{}", "{}", {})'.format(
                    id, i.get('name'), i.get('info'),
                    'NULL' if not i.get('user_id') else i.get('user_id')
                ) for i in info)))
        cnx.commit()
        cursor.close()
        cnx.close()

    async def update_message_author(self, id, *, author_id):
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute(
            'UPDATE message SET author_id = {} WHERE id = {}'.format(
                'NULL' if not author_id else author_id, id))
        cnx.commit()
        cursor.close()
        cnx.close()

    async def delete_message(self, id: int) -> None:
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute(f'DELETE FROM message WHERE id = {id}')
        cnx.commit()
        cursor.close()
        cnx.close()

    async def add_message_info(
            self, id: int, *, name: str, info: str = None, user_id: int = None
    ) -> None:
        keys = 'message_id, name, info, user_id'
        values = '{}, "{}", {}, {}'.format(
            id, name,
            'NULL' if not info else f'"{info}"',
            "NULL" if not user_id else user_id)
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute(f'INSERT INTO message_info({keys}) VALUES ({values})')
        cnx.commit()
        cursor.close()
        cnx.close()

    async def delete_message_info(
            self, id: int, *, name: str, user_id: int = None
    ) -> None:
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute('{} {} {}'.format(
            'DELETE FROM message_info WHERE ',
            f'message_id = {id} AND name = "{name}" ',
            f'AND user_id = {"NULL" if not user_id else user_id}'))
        cnx.commit()
        cursor.close()
        cnx.close()

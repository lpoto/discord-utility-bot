class Config:
    def __init__(self, database):
        self.database = database

    @property
    def required_tables(self) -> dict:
        return {
            'option': [
                'name VARCHAR(50) NOT NULL',
                'guild_id BIGINT NOT NULL',
                'PRIMARY KEY (name, guild_id)',
            ],
            'option_info': [
                'id BIGINT NOT NULL AUTO_INCREMENT',
                'name VARCHAR(50) NOT NULL',
                'guild_id BIGINT NOT NULL',
                'info TINYTEXT NOT NULL',
                'PRIMARY KEY (id)',
                ('FOREIGN KEY (name, guild_id) REFERENCES ' +
                    '`option`(name, guild_id) ON DELETE CASCADE')  # enclose option in ` to avoid conflict with mysql
            ]
        }

    async def get_option(self, *, guild_id: int, name: str) -> dict:
        cnx = self.database.connection_object
        cursor = cnx.cursor()
        cursor.execute('{} {}'.format(
            'SELECT info FROM option_info ',
            f'WHERE guild_id = {guild_id} AND name = "{name}"'))
        opt = sum(cursor.fetchall(), ())
        cursor.close()
        cnx.close()
        return {'name': name, 'guild_id': guild_id, 'info': opt}

    async def add_option(
            self, *, guild_id: int, name: str, info: list
    ) -> None:
        cnx = self.database.connection_object
        cursor = cnx.cursor(buffered=True)
        cursor.execute('{} {}'.format(
            'INSERT INTO option (guild_id, name) ',
            f'VALUES ({guild_id}, "{name}")'))
        if info and len(info) > 0:
            cursor.execute('{} {}'.format(
                'INSERT INTO option_info (name, guild_id, info) VALUES ',
                ', '.join(f'("{name}", {guild_id}, "{i}")' for i in info)))
        cnx.commit()
        cursor.close()
        cnx.close()

    async def update_option(
            self, *, guild_id: int, name: str, info: list
    ) -> None:
        await self.delete_option(guild_id=guild_id, name=name)
        await self.add_option(guild_id=guild_id, name=name, info=info)

    async def delete_option(self, *, guild_id: int, name: str) -> None:
        cnx = self.database.connection_object
        cursor = cnx.cursor(buffered=True)
        cursor.execute(
            'DELETE FROM option WHERE guild_id = {} AND name = "{}"'
            .format(guild_id, name))
        cnx.commit()
        cursor.close()
        cnx.close()

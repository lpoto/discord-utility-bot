import nextcord

import bot.decorators as decorators
import bot.utils as utils


class Hangman:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['purple']
        self.description = 'A guessing game for two or more players'
        self.default_deletion_time = 24
        self.editing = {}

    @decorators.MenuSelect
    async def get_word_from_dm(self, msg, user, data, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if (embed.get_type() != 'Games' or
            'values' in data and
                data['values'][0] != self.__class__.__name__):
            return

        # reset the selected option in the games menu
        await utils.reset_message_view(msg)

        dm = await user.create_dm()
        if not dm:
            return

        self.client.logger.debug(
            msg=f'Hangman: user: {str(user.id)}, dm'
        )

        dm_embed = utils.UtilityEmbed(
            color=self.color,
            type=self.__class__.__name__,
            version=self.client.version,
            description='Reply with a hangman word!\nChannel: {}'.format(
                msg.channel.id))
        await dm.send(embed=dm_embed)
        await webhook.send('You have received a dm', ephemeral=True)

    def valid_hangman(self, msg, dm=False, thread=False):
        if ((not (dm ^ isinstance(msg.channel, nextcord.TextChannel) and
            not (thread and isinstance(msg.channel, nextcord.threads.Thread)))
        ) or not msg.embeds or len(msg.embeds) != 1):
            return False
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        return embed.get_type() == self.__class__.__name__

    @decorators.Reply
    async def start_new_hangman(self, msg, user, referenced_msg):
        if (not self.valid_hangman(referenced_msg, dm=True) or
                'Channel:' not in referenced_msg.embeds[0].description):
            return
        embed = utils.UtilityEmbed(embed=referenced_msg.embeds[0])
        channel_id = int(embed.description.split('Channel: ')[-1])
        channel = self.client.get_channel(channel_id)
        if not channel:
            return
        word = msg.content.strip().upper()
        if len(word) > 30:
            await msg.reply(
                'Hangman word cannot be longer than 30 characters.')
            return
        if any((ord(c) > 90 or ord(c) < 65) and ord(c) != 32 for c in word):
            await msg.reply(
                'Hangman word can only include spaces and ' +
                'ASCII characters from 65 to 90 (case insensitive)')
            return

        embed.description = word
        embed.set_type_and_version('Hangman_word', self.client.version)
        utility_embed = await self.game_embed(word)
        await referenced_msg.edit(embed=embed)
        hm_message = await channel.send(embed=utility_embed)
        deletion_time = await self.client.database.Config.get_option(
            name='Hangman_deletion',
            guild_id=hm_message.guild.id)
        if len(deletion_time.get('info')) == 0:
            deletion_time = self.default_deletion_time * 3600
        else:
            deletion_time = int(deletion_time.get('info')[0]) * 3600
        deletion_timestamp = utils.delta_seconds_timestamp(deletion_time)
        await self.client.database.Messages.add_message(
            id=hm_message.id, channel_id=hm_message.channel.id,
            type=self.__class__.__name__, info=[
                {
                    'name': 'hangman_word',
                    'info': word,
                    'user_id': user.id
                },
                {
                    'name': 'deletion_time',
                    'info': deletion_timestamp
                }
            ])
        await hm_message.create_thread(name='Hangman!')
        await hm_message.delete(delay=deletion_time)

        self.client.logger.debug(
            msg='Hangman: channel: {}, user: {}, started'.format(
                channel_id, user.id
            )
        )

    def hide_word(self, word, chars):
        w2 = (' '.join(
            c if c in chars else r'\_' for c in i
        ) for i in word.split())
        return '\u3000'.join(w2)

    async def game_embed(
            self, word, msg=None, new_chars=None, user_id=None, author_id=None
    ) -> utils.UtilityEmbed:
        # create an embed for the current state of the game
        embed = None
        chars = set()
        phase = 0
        if msg is None:
            embed = utils.UtilityEmbed(
                color=utils.random_color(),
                type=self.__class__.__name__,
                description='',
                version=self.client.version)
        else:
            i, j = 1, 0
            embed = msg.embeds[0]
            if not isinstance(embed, utils.UtilityEmbed):
                embed = utils.UtilityEmbed(embed=embed)
            dsc = embed.description.split('\n')
            if ' vs ' in dsc[0]:
                i, j = 3, 2
            chars = dsc[i].split('ers: ')[1].strip()
            chars = set() if chars == '' else set(chars.split(', '))
            phase = int(dsc[j].split('sses: ')[1].split('/')[0])
        dif_chars = set()
        if new_chars is not None:
            if msg:
                x = self.editing.get(msg.id)
                if x and x is not True:
                    new_chars = new_chars.union(x.get('letters'))
                    self.editing[msg.id] = True
            dif_chars = new_chars.difference(chars)
            chars = chars.union(new_chars)

        hidden_word = self.hide_word(word, chars)
        embed.title = hidden_word
        if new_chars:
            phase += len({i for i in dif_chars if i not in embed.title})
        embed.description = '\n'.join(
            self.picture(phase=phase, guessed_chars=chars).values())
        if r'\_' not in hidden_word:
            return await self.end_embed(
                embed=embed,
                msg=msg,
                user_id=user_id,
                word=word)
        if phase >= 7:
            return await self.end_embed(
                embed=embed,
                msg=msg,
                user_id=author_id,
                word=word)
        embed.description += '\n\nGuess the word in this message\'s thread!'
        return embed

    @decorators.Thread
    async def guesses_from_thread(self, msg, author, parent):
        # all users except the one who started the game
        # can guess letters in a game's thread
        if (not parent or
            msg.channel.name != 'Hangman!' or not self.valid_hangman(
                parent, thread=True)):
            return
        try:
            # allow only 1 ASCII (65-90) letter at a time
            # or multiple, separated with whitespace
            x = set(i.strip().upper() for i in msg.content.split())
            x = set(c for c in x if (
                len(c) == 1 and ord(c.upper()) <= 90 and ord(c.upper()) >= 65
            ))
            if len(x) < 1:
                return

            if parent.id in self.editing:
                if not self.editing.get(
                        parent.id) or self.editing.get(
                        parent.id) is True:
                    self.editing[parent.id] = {
                        'author_id': msg.author.id,
                        'letters': x
                    }
                else:
                    self.editing[parent.id]['author_id'] = msg.author.id
                    self.editing[parent.id]['letters'] = (
                        self.editing[parent.id].get('letters').union(x)
                    )
                return

            self.editing[parent.id] = True

            info = await self.client.database.Messages.get_message_info(
                id=parent.id, name='hangman_word')
            if len(info) < 1:
                await self.client.database.Messages.delete_message(
                    id=parent.id)
                if parent.id in self.editing:
                    del self.editing[parent.id]
                return
            word = info[0].get('info')
            author_id = info[0].get('user_id')
            await self.guess_letter(
                msg.channel.parent, msg.channel, parent.id,
                x, word, msg.author.id, author_id)
        except Exception:
            if parent and parent.id in self.editing:
                del self.editing[parent.id]

    async def guess_letter(
            self, channel, thread, ref_msg_id, letters,
            word, user_id, author_id
    ):
        # edit the hangman's embed based on guessed letter
        referenced_msg = await channel.fetch_message(int(ref_msg_id))
        embed = await self.game_embed(
            word,
            referenced_msg,
            letters,
            user_id,
            author_id)
        if r'\_' not in embed.title:
            # if is_ended, game was completed
            await thread.send('Game ended! ({})'.format(
                embed.title))
            # archive the thread
            await thread.edit(archived=True)
            # add the delete button to the completed game
            await referenced_msg.edit(
                embed=embed,
                view=utils.build_view([utils.delete_button()]))
        else:
            await referenced_msg.edit(embed=embed)
        if referenced_msg.id in self.editing:
            x = self.editing.get(referenced_msg.id)
            if not x or x is True:
                del self.editing[referenced_msg.id]
                return
            letters = x['letters']
            user_id = x['author_id']
            self.editing[referenced_msg.id] = True
            return await self.guess_letter(
                channel, thread, ref_msg_id, letters,
                word, user_id, author_id
            )

    async def end_embed(
            self, embed, msg, user_id, word) -> utils.UtilityEmbed:
        # an embed once the game ends
        # show whether the user who started the game won or lost
        # if he won and database is connected, show his total wins
        user = msg.guild.get_member(int(user_id))
        embed.title = word
        if not user:
            return embed
        embed.description = '{} wins!\n\n{}'.format(
            user.name if not user.nick else user.nick,
            embed.description)
        wins = await self.client.database.Users.get_user_info(
            int(user_id),
            guild_id=msg.guild.id,
            name=self.__class__.__name__ + '_wins'
        )
        if not wins:
            await self.client.database.Users.add_user_info(
                int(user_id),
                guild_id=msg.guild.id,
                name=self.__class__.__name__ + '_wins',
                info=1)
            wins = 1
        else:
            wins = int(wins) + 1
            await self.client.database.Users.update_user_info(
                int(user_id),
                guild_id=msg.guild.id,
                name=self.__class__.__name__ + '_wins',
                info=wins)
        name = user.name if not user.nick else user.nick
        name = name + "'" if name[-1] == 's' else name + "'s"
        extra = '{} total wins: {}\u3000'.format(
                name, wins)
        embed.description += '\n\n' + extra
        embed.set_type_and_version('Hangman_ended', self.client.version)
        return embed

    def picture(self, phase=0, guessed_chars=[]) -> dict:
        # recursively build build the game phase
        phases = {
            1: (1, '\u2000│/' + 7 * '\u2000' + '|'),
            2: (2, '\u2000│' + 8 * '\u2000' + '0'),
            3: (3, '\u2000│' + 8 * '\u2000' + '│'),
            4: (3, '\u2000│' + 7 * '\u2000' + '/│'),
            5: (3, '\u2000│' + 7 * '\u2000' + '/│\\'),
            6: (4, '\u2000│' + 7 * '\u2000' + ' /'),
            7: (4, '\u2000│' + 7 * '\u2000' + ' /^\\'),
        }
        if phase > 7:
            return self.picture(7, guessed_chars)
        if phase == 0:
            return {
                -2: 'Wrong guesses: {}/7'.format(phase),
                -1: 'Guessed letters: ' + ', '.join(guessed_chars),
                0: 13 * r'\_',
                1: '\u2000│',
                2: '\u2000│',
                3: '\u2000│',
                4: '\u2000│',
                5: '\u2000│',
                6: '/ | \\'
            }
        pic = self.picture(phase - 1, guessed_chars)
        pic[-2] = 'Wrong guesses: {}/7'.format(phase)
        pic[phases[phase][0]] = phases[phase][1]
        return pic

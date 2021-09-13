import discord
from utils.misc import random_color, delete_button
from datetime import timedelta, datetime
from utils.wrappers import EmbedWrapper
from commands.help import Help


class Hangman(Help):
    def __init__(self):
        super().__init__(name='hangman')
        self.description = 'A game of hangman.'
        self.synonyms = ['hm']
        self.bot_permissions = ['send_messages']
        self.embed_type = 'HANGMAN'

    async def execute_game(self, msg, user, webhook):
        dm = await user.create_dm()
        dm_embed = EmbedWrapper(discord.Embed(
            description=('Reply to this message with a word or ' +
                         'multiple words with a total length of ' +
                         'maximum 30 characters.'),
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE,
            info=str(msg.channel.id))
        await dm.send(embed=dm_embed)

    async def execute_command(self, msg):
        prefix = await self.bot.database.get_prefix(msg)
        await self.bot.handle_message(msg, 'games', prefix)

    async def on_dm_reply(self, msg, referenced_msg):
        # User need to reply to the dm message with a word
        # with max length of 30 characters
        # only allow ASCII characters from 65 to 90 (case insensitive)
        if (not referenced_msg.is_hangman or
                referenced_msg.embeds[0].title or
                len(msg.content) > 30):
            return
        word = msg.content.strip().upper()
        for c in word:
            x = ord(c)
            if (x < 65 or x > 90) and x != 32:
                return
        ch_id = referenced_msg.embeds[0].get_info()
        channel = self.bot.client.get_channel(int(ch_id))
        if not channel:
            return
        referenced_msg.embeds[0].set_info(word)
        referenced_msg.embeds[0].mark(EmbedWrapper.ENDED)
        await referenced_msg.edit(embed=referenced_msg.embeds[0])
        msg_info = {
            'user_id': msg.author.id,
            'word': word}
        guild = channel.guild
        if not guild:
            return
        # Start the hangman game in a guild channel that the command was
        # originaly called
        # Open a thread where letters can be guessed
        embed = await self.game_embed(guild, msg_info, msg.author.id)
        m = await channel.send(embed=embed)
        thread = await m.create_thread(name='HANGMAN')
        await self.bot.database.use_database(
            self.word_to_database, m, msg.author.id, word)
        await thread.send(
            'Guess the word!\n ' +
            'All messages in this thread containing: ' +
            '\n* A single letter A-z (example: `a`)' +
            '\n* Multiple single letters (example `a B c`)' +
            '\nwill be counted as guesses to the game!')

    async def on_thread_message(self, msg):
        # all users except the one who started the game
        # can guess letters in a game's thread
        if msg.channel.name != 'HANGMAN':
            return
        x = msg.content.split()
        # allow only 1 ASCII (65-90) letter at a time
        # or multiple, separated with whitespace
        if any(len(c.strip()) > 1 for c in x) or any(
                ord(c.strip().upper()) > 90 or ord(
                    c.strip().upper()) < 65 for c in x):
            return
        for i in x:
            await self.bot.queue.add_to_queue(
                queue_id='hmmessage:{}'.format(msg.channel.parent.id),
                item=(
                    msg.channel.parent.id,
                    msg.id,
                    msg.channel.id,
                    i.strip()),
                function=self.guess_letter)

    async def guess_letter(self, item):
        # edit the hangman's embed based on guessed letter
        chnl = self.bot.client.get_channel(int(item[0]))
        thread = self.bot.client.get_channel(int(item[2]))
        if chnl is None or thread is None:
            return
        msg = await thread.fetch_message(int(item[1]))
        referenced_msg = await chnl.fetch_message(int(item[2]))
        if not referenced_msg.is_hangman:
            return
        letter = item[3]
        msg_info = await self.bot.database.use_database(
            self.word_from_database, referenced_msg)
        if str(msg_info['user_id']) == str(msg.author.id):
            return
        embed = await self.game_embed(
            referenced_msg.guild,
            msg_info,
            msg.author.id,
            letter,
            referenced_msg)
        if embed is None:
            return
        if referenced_msg.is_ended:
            # if is_ended, game was completed
            await thread.notify('Game ended! ({})'.format(
                embed.title))
            # archive the thread
            await thread.edit(archived=True)
            # add the delete button to the completed game
            await referenced_msg.edit(
                embed=embed,
                components=delete_button())
            return
        await referenced_msg.edit(embed=embed)

    async def get_word(self, guild, info, chars, full=False) -> (str, bool):
        # Search for the word in the game author's dm
        if info is None:
            return
        info_word = info['word']
        if full:
            return info_word
        # replace unknown characters (except spaces) with '_'
        word = ' '.join(
            [i if i in chars or i == ' ' else r'\_' for i in info_word])
        return (word, word == ' '.join([i for i in info_word]))

    async def game_embed(
            self, guild, msg_info, u_id, char=None, msg=None) -> EmbedWrapper:
        embed = None
        chars = []
        phase = 0
        if msg is None:
            embed = EmbedWrapper(
                discord.Embed(color=random_color()),
                embed_type=self.embed_type,
                marks=EmbedWrapper.NOT_DELETABLE)
        else:
            i, j = 1, 0
            embed = msg.embeds[0]
            if not isinstance(embed, EmbedWrapper):
                embed = EmbedWrapper(embed)
            dsc = embed.description.split('\n')
            if ' vs ' in dsc[0]:
                i, j = 3, 2
            chars = dsc[i].split('ers: ')[1].strip()
            chars = [] if chars == '' else chars.split(', ')
            phase = int(dsc[j].split('sses: ')[1].split('/')[0])
        if char is not None:
            if char.upper() in chars:
                return
            chars.append(char.upper())
        word_info = await self.get_word(guild, msg_info, chars)
        if not word_info:
            return
        embed.title = word_info[0]
        if char is not None and char.upper() not in embed.title:
            phase += 1
        embed.description = '\n'.join(
            self.picture(phase=phase, guessed_chars=chars).values())
        if word_info[1]:
            return await self.end_embed(
                winner=False,
                embed=embed,
                msg_info=msg_info,
                msg=msg)
        if phase >= 7:
            return await self.end_embed(
                winner=True, embed=embed, msg_info=msg_info, msg=msg)
        embed.description += '\n\nGuess the word in this message\'s thread!'
        return embed

    async def end_embed(self, winner, embed, msg_info, msg) -> EmbedWrapper:
        user_id = msg_info['user_id']
        user = msg.guild.get_member(int(user_id))
        embed.title = await self.get_word(msg.guild, msg_info, [], True)
        if user:
            if winner:
                embed.description = '{} wins!\n\n{}'.format(
                    user.name if not user.nick else user.nick,
                    embed.description)
                wins = await self.bot.database.use_database(
                    self.wins_to_database, msg, user.id)
                if wins is not None:
                    extra = '{} total wins: {}\u3000'.format(
                        user.name if not user.nick else user.nick,
                        wins)
                    embed.set_info(extra)
            else:
                embed.description = '{} loses!\n\n{}'.format(
                    user.name if not user.nick else user.nick,
                    embed.description)
        await self.bot.database.use_database(
            self.delete_from_database, msg)
        embed.mark(EmbedWrapper.ENDED)
        return embed

    def picture(self, phase=0, guessed_chars=[]) -> dict:
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
                0: 13*r'\_',
                1: '\u2000│',
                2: '\u2000│',
                3: '\u2000│',
                4: '\u2000│',
                5: '\u2000│',
                6: '/ | \\'
            }
        pic = self.picture(phase-1, guessed_chars)
        pic[-2] = 'Wrong guesses: {}/7'.format(phase)
        pic[phases[phase][0]] = phases[phase][1]
        return pic

    async def word_to_database(self, cursor, msg, user_id, word):
        cur_time = (datetime.now() + timedelta(hours=24)
                    ).strftime('%d:%m:%H')
        cursor.execute(
            ("INSERT INTO messages " +
             "(type, channel_id, message_id, user_id, info, deletion_time) " +
             "VALUES ('hangman', '{}', '{}', '{}', '{}', '{}')").format(
                msg.channel.id, msg.id, user_id, word, cur_time))
        await msg.delete(delay=24 * 3600)

    async def word_from_database(self, cursor, msg):
        cursor.execute(
            ("SELECT * FROM messages WHERE type = 'hangman' AND " +
             "channel_id = '{}' AND message_id = '{}'").format(
                msg.channel.id, msg.id))
        x = cursor.fetchone()
        if x is None:
            return
        return {
            'user_id': x[3],
            'word': x[4]
        }

    async def delete_from_database(self, cursor, msg):
        cursor.execute(("UPDATE messages SET type = 'deleting' WHERE " +
                        "channel_id = '{}' AND message_id = '{}'").format(
            msg.channel.id, msg.id))

    async def wins_to_database(self, cursor, msg, user_id):
        # add a win for the user to the database and return total win count
        cursor.execute((
            "SELECT * FROM wins WHERE game = 'hangman' AND" +
            " guild_id = '{}' AND user_id = '{}'").format(
                msg.guild.id, user_id))
        fetched = cursor.fetchone()
        count = 1
        if fetched is None:
            cursor.execute(
                ("INSERT INTO wins (game, guild_id, user_id, " +
                 "wins) VALUES ('hangman', '{}', '{}', 1)").format(
                    msg.guild.id, user_id))
        else:
            count = fetched[3] + 1
            cursor.execute(
                ("UPDATE wins SET wins = {} WHERE game = 'hangman' AND " +
                 "guild_id = '{}' and user_id = '{}'").format(
                     count, msg.guild.id, user_id))
        return count

    async def leaderboard_embed(self, cursor, msg):
        cursor.execute(
            "SELECT * FROM wins WHERE game = 'hangman' AND guild_id = '{}'"
            .format(msg.guild.id))
        fetched = cursor.fetchall()
        if fetched is None or len(fetched) == 0:
            return
        embed_var = EmbedWrapper(discord.Embed(
            title='Leaderboard',
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.INFO)
        users = {}
        for i in fetched:
            user = msg.guild.get_member(int(i[2]))
            if user is None:
                continue
            users[user] = i[3]
        users = {k: v for k, v in sorted(
            users.items(), key=lambda item: item[1], reverse=True)}
        i = 1
        for u, w in users.items():
            if i > 10:
                break
            name = u.name if not u.nick else u.nick
            embed_var.add_field(
                name='{}.  {}'.format(i, name), value=w, inline=False)
            i += 1
        return embed_var

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Typing this command open a game menu.',
            'Clicking on this game in a game menu starts the game.',
            'You receive a dm, where you reply with a word (or multiple).',
            'Only letters A-z can be used (case insensitive).',
            'The game is started in a new thread, where ' +
            'other users can guess the word.',
            'A record of wins is kept.')

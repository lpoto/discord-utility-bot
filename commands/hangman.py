import discord
from utils.misc import random_color
from utils.wrappers import EmbedWrapper, MemberWrapper
from commands.help import Help


class Hangman(Help):
    def __init__(self):
        super().__init__(name='hangman')
        self.description = 'A game of hangman.'
        self.synonyms = ['hgmn', 'hm']
        self.bot_permissions = ['send_messages',
                                'send_messages_in_threads']
        self.embed_type = 'HANGMAN'
        self.game = True

    async def execute_command(self, msg, user=None):
        if user is None:
            user = msg.author
        dm = await user.create_dm()
        dm_embed = EmbedWrapper(discord.Embed(
            description=('Reply to this message with a word or ' +
                         'multiple words with a total length of ' +
                         'maximum 30 characters.'),
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE,
            channel_id=str(msg.channel.id))
        await dm.send(embed=dm_embed)

    async def on_dm_reply(self, msg, referenced_msg):
        if (not referenced_msg.is_hangman or
                referenced_msg.embeds[0].title or
                len(msg.content) > 30):
            return
        for c in msg.content.strip():
            x = ord(c.upper())
            if (x < 65 or x > 90) and x != 32:
                return
        referenced_msg.embeds[0].description = msg.content.strip().upper()
        referenced_msg.embeds[0].mark(EmbedWrapper.ENDED)
        await referenced_msg.edit(embed=referenced_msg.embeds[0])
        ch_id = referenced_msg.embeds[0].get_id()['channel_id']
        channel = self.bot.client.get_channel(int(ch_id))
        if not channel:
            return
        msg_info = {
            'user_id': msg.author.id,
            'message_id': referenced_msg.id,
            'channel_id': None}
        guild = channel.guild
        if not guild:
            return
        embed = await self.game_embed(guild, msg_info, msg.author.id)
        m = await channel.send(embed=embed)
        thread = await m.create_thread(name='HANGMAN')
        await thread.send(
            'Guess the word!\n ' +
            'All messages in this thread containing: ' +
            '\n* A single letter A-z (example: `a`)' +
            '\n* Multiple single letters (example `a B c`)' +
            '\nwill be counted as guesses to the game!')

    async def on_thread_message(self, msg):
        if msg.channel.name != 'HANGMAN':
            return
        x = msg.content.split(' ')
        if any(len(c.strip()) > 1 for c in x) or any(
                ord(c.strip().upper()) > 90 or ord(
                    c.strip().upper()) < 65 for c in x):
            return
        hm_message = await msg.channel.parent.fetch_message(
            msg.channel.id)
        if hm_message is None or not hm_message.is_hangman:
            return
        for i in x:
            await self.bot.queue.add_to_queue(
                queue_id='hmmessage:{}'.format(hm_message.id),
                item=(
                    msg.channel.parent.id,
                    msg.id,
                    msg.channel.id,
                    i.strip()),
                function=self.guess_letter)

    async def guess_letter(self, item):
        chnl = self.bot.client.get_channel(int(item[0]))
        thread = self.bot.client.get_channel(int(item[2]))
        if chnl is None or thread is None:
            return
        msg = await thread.fetch_message(int(item[1]))
        referenced_msg = await chnl.fetch_message(int(item[2]))
        if not referenced_msg.is_hangman:
            return
        letter = item[3]
        msg_info = referenced_msg.embeds[0].get_id()
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
            await thread.edit(archived=True)
        await referenced_msg.edit(embed=embed)

    async def get_word(self, guild, msg_info, chars, full=False):
        user = MemberWrapper(guild.get_member(int(msg_info['user_id'])))
        if user is None:
            return
        msg = await user.fetch_message(int(msg_info['message_id']))
        if not msg:
            return
        word = msg.embeds[0].description
        if full:
            return word
        word = ' '.join([i if i in chars or i == ' ' else r'\_' for i in word])
        return (word, word == ' '.join([i for i in msg.embeds[0].description]))

    async def game_embed(self, guild, msg_info, u_id, char=None, msg=None):
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
                user_id=msg_info['user_id'],
                msg=msg)
        if phase >= 7:
            return await self.end_embed(
                winner=True, embed=embed, user_id=msg_info['user_id'], msg=msg)
        embed.description += '\n\nGuess the word in this message\'s thread!'
        embed.set_id(
            user_id=msg_info['user_id'],
            message_id=msg_info['message_id'],
            channel_id=msg_info['channel_id'])
        return embed

    async def end_embed(self, winner, embed, user_id, msg):
        user = msg.guild.get_member(int(user_id))
        embed.title = await self.get_word(msg.guild, embed.get_id(), [], True)
        if user:
            if winner:
                embed.description = '{} wins!\n\n{}'.format(
                    user.name if not user.nick else user.nick,
                    embed.description)
            else:
                embed.description = '{} loses!\n\n{}'.format(
                    user.name if not user.nick else user.nick,
                    embed.description)
        embed.set_id()
        embed.mark(EmbedWrapper.ENDED)
        return embed

    def picture(self, phase=0, guessed_chars=[]):
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

    def additional_info(self, prefix):
        return '{}\n{}\n{}\n{}'.format(
            ('* Start the game with "{}hm", then reply ' +
             'with a word in DM.').format(prefix),
            '* You can use letters from A-Z (case insensitive).',
            '* A new thread will be started where other users can guess '
            'the word by typing letters.',
            '* Multiple letters can be guessed at a time ' +
            'separated with " " (example: "a B c d ...")')

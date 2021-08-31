import discord
from utils.misc import random_color
from utils.wrappers import EmbedWrapper, MemberWrapper
from commands.help import Help


class Hangman(Help):
    def __init__(self):
        super().__init__(name='hangman')
        self.description = 'A game of hangman.'
        self.synonyms = ['hgmn', 'hm']
        self.embed_type = 'HANGMAN'
        self.game = True

    async def execute_command(self, msg, user=None):
        if user is None:
            user = msg.author
        dm = await user.create_dm()
        dm_embed = EmbedWrapper(discord.Embed(
            description=('Reply to this message with a single word,' +
                         ' not longer than 20 letters.'),
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.NOT_DELETABLE)
        dm_embed.set_id(channel_id=msg.channel.id)
        await dm.send(embed=dm_embed)

    async def on_dm_reply(self, msg, referenced_msg):
        if not referenced_msg.is_hangman:
            return
        if not referenced_msg.embeds[0].title:
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
                'user2_id': None,
                'message_id': referenced_msg.id,
                'channel_id': None}
            guild = channel.guild
            if not guild:
                return
            embed = await self.game_embed(guild, msg_info, msg.author.id)
            await channel.send(embed=embed)

    async def on_reply(self, msg, referenced_msg):
        if not referenced_msg.is_hangman:
            return
        x = msg.content.split(';')
        if any(len(i.strip()) != 1 for i in x):
            await msg.channel.send(
                'You can only guess a single letter at a time!',
                delete_after=3)
            return
        if any(ord(c.upper()) > 90 or ord(c.upper()) < 65 for c in x):
            await msg.channel.send(
                'You can only guess letters from A to Z!',
                delete_after=3)
            return
        for i in x:
            last = (i == x[-1])
            await self.bot.queue.add_to_queue(
                queue_id='hmmessage:{}'.format(referenced_msg.id),
                item=(
                    msg.channel.id,
                    msg.id,
                    referenced_msg.id,
                    i.strip(),
                    last),
                function=self.guess_letter)

    async def guess_letter(self, item):
        chnl = self.bot.client.get_channel(int(item[0]))
        if chnl is None:
            return
        msg = await chnl.fetch_message(int(item[1]))
        referenced_msg = await chnl.fetch_message(int(item[2]))
        letter = item[3]
        last = item[4]
        msg_info = referenced_msg.embeds[0].get_id()
        if (msg_info['user2_id'] is None and
                str(msg.author.id) != str(msg_info['user_id'])):
            msg_info['user2_id'] = msg.author.id
        if msg_info['user2_id'] != msg.author.id:
            return
        embed = await self.game_embed(
            msg.guild,
            msg_info,
            msg.author.id,
            letter,
            referenced_msg)
        if embed is None:
            return
        await referenced_msg.edit(embed=embed)
        if last:
            await msg.delete(delay=4)

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
        if msg_info['user2_id']:
            u1 = msg.guild.get_member(msg_info['user_id'])
            u2 = msg.guild.get_member(msg_info['user2_id'])
            embed.description = '{} vs {}!\n\n{}'.format(
                u1.name if not u1.nick else u1.nick,
                u2.name if not u2.nick else u2.nick,
                '\n'.join(
                    self.picture(phase=phase, guessed_chars=chars).values()))
        else:
            embed.description = '\n'.join(
                self.picture(phase=phase, guessed_chars=chars).values())
        if word_info[1]:
            return await self.end_embed(
                winner=False,
                embed=embed,
                user_id=msg_info['user_id'],
                msg=msg)
        if phase >= 8:
            return await self.end_embed(
                winner=True, embed=embed, user_id=msg_info['user_id'], msg=msg)
        embed.set_id(
            user_id=msg_info['user_id'],
            user2_id=msg_info['user2_id'],
            message_id=msg_info['message_id'],
            channel_id=msg_info['channel_id'])
        return embed

    async def end_embed(self, winner, embed, user_id, msg):
        user = msg.guild.get_member(int(user_id))
        nm = user.name if not user.nick else user.nick
        embed.title = await self.get_word(msg.guild, embed.get_id(), [], True)
        if winner:
            embed.description = embed.description.replace(
                ' vs ', ' wins vs ', 1)
        else:
            embed.description = embed.description.replace(
                ' vs ', ' loses vs ', 1)
        embed.set_id()
        embed.mark(EmbedWrapper.ENDED)
        return embed

    def picture(self, phase=0, guessed_chars=[]):
        phases = {
            1: (1, '\u2000│/'),
            2: (1, '\u2000│/' + 7 * '\u2000' + '|'),
            3: (2, '\u2000│' + 8 * '\u2000' + '0'),
            4: (3, '\u2000│' + 8 * '\u2000' + '│'),
            5: (3, '\u2000│' + 7 * '\u2000' + '/│'),
            6: (3, '\u2000│' + 7 * '\u2000' + '/│\\'),
            7: (4, '\u2000│' + 7 * '\u2000' + ' /'),
            8: (4, '\u2000│' + 7 * '\u2000' + ' /^\\'),
        }
        if phase > 8:
            return self.picture(8, guessed_chars)
        if phase == 0:
            return {
                -2: 'Wrong guesses: {}/8'.format(phase),
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
        pic[-2] = 'Wrong guesses: {}/8'.format(phase)
        pic[phases[phase][0]] = phases[phase][1]
        return pic

    def additional_info(self, prefix):
        return '{}\n{}\n{}\n{}'.format(
            ('* Start the game with "{}hm", then reply ' +
             'with a word in DM.').format(prefix),
            '* You can use letters from A-Z (case insensitive).',
            '* Another user can then join the game by replying with a letter.',
            '* Multiple letters can be guessed at a time ' +
            'separated with ; (example: "a;b;c;d;...")')

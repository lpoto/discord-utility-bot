import discord
from utils.misc import random_color
from utils.wrappers import EmbedWrapper, MemberWrapper
from commands.help import Help


class Hangman(Help):
    def __init__(self):
        super().__init__(name='hm')
        self.description = 'A game of hangman.'
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
        dm_embed.set_footer(text=msg.channel.id)
        await dm.send(embed=dm_embed)

    async def on_dm_reply(self, msg, referenced_msg):
        if not referenced_msg.is_hangman:
            return
        if not referenced_msg.embeds[0].title:
            if (len(msg.content) > 20 or
                    len(msg.content) < 1 or
                    ' ' in msg.content):
                return
            referenced_msg.embeds[0].description = msg.content.upper()
            referenced_msg.embeds[0].mark(EmbedWrapper.ENDED)
            await referenced_msg.edit(embed=referenced_msg.embeds[0])
            ch_id = referenced_msg.embeds[0].footer.text
            channel = self.bot.client.get_channel(int(ch_id))
            if not channel:
                return
            msg_info = (str(msg.author.id), str(referenced_msg.id))
            guild = channel.guild
            if not guild:
                return
            embed = await self.game_embed(guild, msg_info, msg.author.id)
            await channel.send(embed=embed)

    async def on_reply(self, msg, referenced_msg):
        if not referenced_msg.is_hangman:
            return
        if len(msg.content) != 1:
            return
        ftr = referenced_msg.embeds[0].footer.text.split('\n')[-1]
        msg_info = [ftr[:18], ftr[18:]]
        embed = await self.game_embed(
                msg.guild,
                msg_info,
                msg.author.id,
                msg.content,
                referenced_msg)
        if embed is None:
            return
        await referenced_msg.edit(embed=embed)

    async def get_word(self, guild, usr_id, msg_id, chars):
        user = MemberWrapper(guild.get_member(int(usr_id)))
        if user is None:
            return
        msg = await user.fetch_message(int(msg_id))
        if not msg:
            return
        word = msg.embeds[0].description
        word = ' '.join([i if i in chars else r'\_' for i in word])
        return (word, word.replace(' ', '') == msg.embeds[0].description)

    async def game_embed(self, guild, msg_info, u_id, char=None, msg=None):
        # msg_info = (chanel_id, message_id, user_id)
        if char is not None and msg_info[0] == str(u_id):
            return
        embed = None
        chars = []
        phase = 0
        if msg is None:
            embed = EmbedWrapper(
                discord.Embed(color=random_color()),
                embed_type=self.embed_type,
                marks=EmbedWrapper.NOT_DELETABLE)
        else:
            embed = msg.embeds[0]
            dsc = embed.description.split('\n')
            chars = dsc[1].split('ers: ')[1].strip()
            chars = [] if chars == '' else chars.split(', ')
            phase = int(dsc[0].split('sses: ')[1].split('/')[0])
        if char is not None:
            if char.upper() in chars:
                return
            chars.append(char.upper())
        word_info = await self.get_word(guild, msg_info[0], msg_info[1], chars)
        if not word_info:
            return
        embed.title = word_info[0]
        if char is not None and char.upper() not in embed.title:
            phase += 1
        embed.description = '\n'.join(
            self.picture(phase=phase, guessed_chars=chars).values())
        if word_info[1]:
            return self.end_embed(
                winner=False, embed=embed, user_id=msg_info[0], msg=msg)
        if phase >= 6:
            return self.end_embed(
                winner=True, embed=embed, user_id=msg_info[0], msg=msg)
        embed.set_footer(text='Reply with a letter to play!\n\n{}'.format(
            ''.join(msg_info)))
        return embed

    def end_embed(self, winner, embed, user_id, msg):
        user = msg.guild.get_member(int(user_id))
        nm = user.name if not user.nick else user.nick
        if winner:
            embed.description = '{} wins!\n\n{}'.format(nm, embed.description)
        else:
            embed.description = '{} loses!\n\n{}'.format(nm, embed.description)
        embed.set_footer(text='')
        embed.mark(EmbedWrapper.ENDED)
        return embed

    def picture(self, phase=0, guessed_chars=[]):
        phases = {
            1: (2, '\u2000│' + 8 * '\u2000' + '0'),
            2: (3, '\u2000│' + 8 * '\u2000' + '│'),
            3: (3, '\u2000│' + 7 * '\u2000' + '/│'),
            4: (3, '\u2000│' + 7 * '\u2000' + '/│\\'),
            5: (4, '\u2000│' + 7 * '\u2000' + ' /'),
            6: (4, '\u2000│' + 7 * '\u2000' + ' /^\\'),
        }
        if phase > 6:
            return self.picture(phase, guessed_chars)
        if phase == 0:
            return {
                -2: 'Wrong guesses: {}/6'.format(phase),
                -1: 'Guessed letters: ' + ', '.join(guessed_chars),
                0: 13*r'\_',
                1: '\u2000│' + 8 * '\u2000' + '|',
                2: '\u2000│',
                3: '\u2000│',
                4: '\u2000│',
                5: '\u2000│',
                6: '/ | \\'
            }
        pic = self.picture(phase-1, guessed_chars)
        pic[-2] = 'Wrong guesses: {}/6'.format(phase)
        pic[phases[phase][0]] = phases[phase][1]
        return pic

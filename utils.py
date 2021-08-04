from dotenv import load_dotenv
import os
import sys
from collections import deque
import discord
import random

# enable all intents to get member info etc.
# application on the discord dev website needs to have
# presence and server members intent enabled under BOT

load_dotenv()
DEFAULT_PREFIX = os.environ.get('DEFAULT_PREFIX')


class MessageWrapper(discord.Message):
    """
    Wrapper for discord.Message that avoids permission errors,
    adds additional functionality to editing, reacting, deleting and
    removing reactions from messages and adds properties that check
    for specific message types based on EmbedWrapper embed types.
    """

    def __init__(self, obj):
        self._wrapped_msg = obj
        if not isinstance(self.channel, ChannelWrapper):
            self.channel = ChannelWrapper(
                self._wrapped_msg.channel)
        if (str(self.channel.type) == 'text' and
                not isinstance(self.author, MemberWrapper)):
            self.author = MemberWrapper(self.author)
        for i in range(len(self.embeds)):
            if not isinstance(self.embeds[i], EmbedWrapper):
                self.embeds[i] = EmbedWrapper(self.embeds[i])

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_msg, attr)

    async def edit(
            self,
            text=None,
            embed=None,
            delete_after=None,
            reactions=None,
    ):
        await self._wrapped_msg.edit(
            content=text, embed=embed, delete_after=delete_after)
        if reactions is not None:
            if not isinstance(reactions, list) and not isinstance(
                    reactions, tuple):
                reactions = [reactions]
            for i in reactions:
                await self.react(emoji=i)
        return self

    async def react(
            self,
            emoji):
        if (str(self.channel.type) == 'text' and
            not self.channel.permissions(
                self.guild.me,
                'add_reactions')):
            return
        await self._wrapped_msg.add_reaction(emoji)
        return True

    async def delete(self, delay=None):
        if (self.author.id != self.guild.me.id and
            not self.channel.permissions(
                self.guild.me,
                'send_messages')):
            return
        await self._wrapped_msg.delete(delay=delay)
        del self
        return True

    async def remove_reaction(self, emoji, member=None):
        if member is None:
            if (self.channel.permissions(
                    self.guild.me,
                    'manage_messages')):
                await self.clear_reaction(emoji)
            else:
                await self._wrapped_msg.remove_reaction(emoji, self.guild.me)
            return
        if (self.guild.me.id != member.id and
                not self.channel.permissions(
                    self.guild.me, 'manage_messages')):
            return
        await self._wrapped_msg.remove_reaction(emoji, member)

    # check the type of message based on its embed
    def type_check(self, name, bad_marks=[], good_marks=[]):
        if not isinstance(bad_marks, list) and not isinstance(
                bad_marks, tuple):
            bad_marks = [bad_marks]
        if not isinstance(good_marks, list) and not isinstance(
                good_marks, tuple):
            good_marks = [good_marks]
        if len(self.embeds) != 1:
            return False
        if not isinstance(self.embeds[0], EmbedWrapper):
            self.embeds[0] = EmbedWrapper(self.embeds[0])
        mks = self.embeds[0].get_marks()
        if any(i in mks for i in bad_marks):
            return False
        if any(i not in mks for i in good_marks):
            return False
        if name is None or self.embeds[0].embed_type == name:
            return True
        return False

    @property
    def is_poll(self):
        return self.type_check('POLL', EmbedWrapper.ENDED)

    @property
    def is_roles(self):
        return self.type_check('ROLES')

    @property
    def is_connect_four(self):
        return self.type_check('CONNECT_FOUR', [
            EmbedWrapper.ENDED, EmbedWrapper.INFO])

    @property
    def is_event(self):
        return self.type_check('EVENT', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_help(self):
        return self.type_check('HELP', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_server(self):
        return self.type_check('SERVER', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_config(self):
        return self.type_check('CONFIG', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_fixed(self):
        return self.type_check(None, EmbedWrapper.ENDED, EmbedWrapper.FIXED)

    @property
    def is_rps(self):
        return self.type_check('ROCK_PAPER_SCISSORS', [
            EmbedWrapper.ENDED, EmbedWrapper.INFO])

    @property
    def is_games(self):
        return self.type_check('GAMES', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_deletable(self):
        if self.pinned:
            return False
        if len(self.embeds) != 1:
            return True
        return self.type_check(None, EmbedWrapper.NOT_DELETABLE)


class ChannelWrapper(object):
    """
    Wrapper for discord.Channel that avoids permission errors
    and allows adding reactions when sending a message.
    """

    def __init__(self, chnl):
        self._wrapped_chnl = chnl

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_chnl, attr)

    async def send(
            self,
            text=None,
            embed=None,
            delete_after=None,
            reactions=None,
            file=None):
        if (str(self.type) == 'text' and
            not self.permissions(
                self.guild.me, 'send_messages')[0]):
            return
        msg = MessageWrapper(
            await self._wrapped_chnl.send(
                content=text,
                embed=embed,
                delete_after=delete_after,
                file=file))
        if reactions is not None:
            if not isinstance(reactions, list) and not isinstance(
                    reactions, tuple):
                reactions = [reactions]
            for i in reactions:
                await msg.react(i)
        return msg

    async def fetch_message(self, msg_id):
        return MessageWrapper(
            await self._wrapped_chnl.fetch_message(
                msg_id))

    def permissions(self, member, perms):
        if not isinstance(perms, list) and not isinstance(perms, tuple):
            perms = [perms]
        for i in perms:
            if not dict(iter(member.permissions_in(self)))[i]:
                return (False, i)
        return (True, None)


class MemberWrapper(object):
    """
    Wrapper for discord.User that returns wrapped objects
    when fetching channels and messages.
    """

    def __init__(self, member):
        self._wrapped_member = member

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        if hasattr(self._wrapped_member, attr):
            return getattr(self._wrapped_member, attr)

    async def create_dm(self):
        return ChannelWrapper(
            await self._wrapped_member.create_dm())

    async def fetch_message(self, id):
        return MessageWrapper(
            await self._wrapped_member.fetch_message(id=id))


class Queue():
    """
    Create queues for messages constantly edited by reactions or replies
    to avoid duplicating or missing any of the edits.
    """

    def __init__(self, bot):
        self.bot = bot
        self.queues = {}

    async def add_to_queue(self, queue_id, item, function=None):
        if queue_id not in self.queues:
            self.queues[queue_id] = deque([])
        self.queues[queue_id].append(item)
        if function is not None:
            await self.clear_queue(queue_id, function, False)

    async def clear_queue(self, queue_id, function, ignore_running):
        if queue_id not in self.queues:
            return
        # clear messages or reaction in queue to avoid
        # multiple instances of same command or reactions
        if ((queue_id in self.queues or
             ignore_running) and len(self.queues[queue_id]) > 0):
            item = self.queues[queue_id].popleft()
            try:
                await function(item)
            except Exception as err:
                self.bot.client.dispatch('error', err, *sys.exc_info())
            finally:
                await self.clear_queue(queue_id, function, True)
        else:
            if queue_id in self.queues and len(
                    self.queues[queue_id]) == 0:
                del self.queues[queue_id]


class EmbedWrapper(discord.Embed):
    """wrapper that adds types and marks to the discord.Embed"""
    FIXED = 'F'
    ENDED = 'E'
    NOT_DELETABLE = 'ND'
    INFO = 'I'

    def __init__(self, embed, embed_type=None, marks=()):
        self._wrapped_embed = embed
        self.embed_type = self.get_type() if embed_type is None else embed_type
        self.marks = [
            EmbedWrapper.FIXED,
            EmbedWrapper.ENDED,
            EmbedWrapper.INFO,
            EmbedWrapper.NOT_DELETABLE]
        self.mark(marks=marks)

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_embed, attr)

    def get_type(self):
        if not self.author:
            return None
        return self.author.name.split()[0]

    def set_thumbnail(self, url):
        self.mark(
            marks=self.get_marks(),
            size=36 if url is None else 28)
        self._wrapped_embed.set_thumbnail(url=url)

    def mark(self,
             marks=[],
             size=36):
        if not isinstance(marks, list) and not isinstance(marks, tuple):
            marks = [marks]
        if self.embed_type is None:
            return
        if any(i not in self.marks for i in marks):
            raise Exception('Invalid embed marks!')
            return
        text = self.embed_type
        if len(marks) == 0:
            return self
        text += str((size - len(text) - len(''.join(marks))
                     ) * '\u3000') + ''.join(marks)
        self.set_author(name=text)
        return self

    def get_marks(self):
        if not self.author.name:
            return []
        mks = self.author.name.split()
        if len(self.author.name) not in [28, 36] or len(mks) != 2:
            return []
        marks = []
        for i in self.marks:
            if i in mks[1]:
                marks.append(i)
        self.embed_type = mks[0]
        return marks

    @classmethod
    def mark_info(cls, mark):
        mi = {
            cls.INFO: 'Informational',
            cls.ENDED: 'Ended, bot does not respond to the message.',
            cls.FIXED: 'Fixed, only listening for reactions.',
            cls.NOT_DELETABLE: ('Cannot delete with waste basket ' +
                                'or clear command.')}
        if mark in mi:
            return mi[mark]


# emojis rock, paper, scissors
rps_emojis = [u"\U0001FAA8", u"\U0001F4C4", u"\U00002702\U0000FE0F"]
# waste basket emoji for deleting messages
waste_basket = u"\U0001F5D1\U0000FE0F"
# thumbs up emoji
thumbs_up = u"\U0001F44D"
number_emojis = [u"\U00000031\U0000FE0F\U000020E3",
                 u"\U00000032\U0000FE0F\U000020E3",
                 u"\U00000033\U0000FE0F\U000020E3",
                 u"\U00000034\U0000FE0F\U000020E3",
                 u"\U00000035\U0000FE0F\U000020E3",
                 u"\U00000036\U0000FE0F\U000020E3",
                 u"\U00000037\U0000FE0F\U000020E3"]
# emojis for polls, roles,...
# 20 reactions is maximum (error otherwise)
emojis = [
    u"\U000026AA",
    u"\U0001F534",
    u"\U0001F535",
    u"\U0001F7E0",
    u"\U0001F7E1",
    u"\U0001F7E2",
    u"\U0001F7E3",
    u"\U0001F7E4",
    u"\U000026AB",
    u"\U00002B1C",
    u"\U0001F7E5",
    u"\U0001F7E6",
    u"\U0001F7E7",
    u"\U0001F7E8",
    u"\U0001F7E9",
    u"\U0001F7EA",
    u"\U0001F7EB",
    u"\U00002B1B",
    u"\U0001F536",
    u"\U0001F537"]

black_circle = u"\U000026AB"
white_circle = u"\U000026AA"
black_square = u"\U000026AB"
white_square = u"\U00002B1C"

# colors that match emoji colors by indexes
colors = [
    0xffffff,
    0xc30202,
    0x0099e1,
    0xf75f1c,
    0xf8c300,
    0x008e44,
    0xa652bb,
    0xa5714e,
    0,
    0xffffff,
    0xc30202,
    0x0099e1,
    0xf75f1c,
    0xf8c300,
    0x008e44,
    0xa652bb,
    0xa5714e,
    0,
    0xf75f1c,
    0x0099e1,
]


def random_color():
    """generate a random color"""
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)

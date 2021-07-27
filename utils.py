from dotenv import load_dotenv
import os
from collections import deque
import discord
import random
# enable all intents to get member info etc.
# application on the discord dev website needs to have
# presence and server members intent enabled under BOT

load_dotenv()
# default prefix key used before commands
DEFAULT_PREFIX = os.environ.get('DEFAULT_PREFIX')


def random_color():
    # generate a random color (mostly for embeds)
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)


# wrapper for Message object to avoid erros when editing,
# reacting,....
class Message_wrapper(discord.Message):
    def __init__(self, obj):
        self._wrapped_msg = obj
        self.channel = Channel_wrapper(
            self._wrapped_msg.channel)
        if str(self.channel.type) == 'text':
            self.author = Member_wrapper(self.author)
        self.additional_info = None
        self.waiting_for = None

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_msg, attr)

    async def edit(
            self,
            text=None,
            embed=None,
            delete_after=None,
            reactions=None):
        await self._wrapped_msg.edit(
            content=text, embed=embed, delete_after=delete_after)
        if reactions is not None:
            if not isinstance(reactions, list):
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


# wrapper for Channel object, to avoid errors when sending messages
# and add extra functions
class Channel_wrapper(object):
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
            reactions=None):
        if (str(self.type) == 'text' and
            not self.permissions(
                self.guild.me, 'send_messages')[0]):
            return
        msg = Message_wrapper(
            await self._wrapped_chnl.send(
                content=text,
                embed=embed,
                delete_after=delete_after))
        if reactions is not None:
            if not isinstance(reactions, list):
                reactions = [reactions]
            for i in reactions:
                await msg.react(i)
        return msg

    async def fetch_message(self, msg_id):
        return Message_wrapper(
            await self._wrapped_chnl.fetch_message(
                msg_id))

    def permissions(self, member, perms):
        if not isinstance(perms, list):
            perms = [perms]
        for i in perms:
            if not dict(iter(member.permissions_in(self)))[i]:
                return (False, i)
        return (True, None)


# wrapper for discord guild member object, wraps dm channel
# when created
class Member_wrapper(discord.Member):
    def __init__(self, member):
        self._wrapped_member = member

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_member, attr)

    async def create_dm(self):
        return Channel_wrapper(
            await self._wrapped_member.create_dm())

# create queues for different messages and process editing with reactions
# and such functions in queue, to avoid duplicating or missing any


class Queue():
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
            except Exception as error:
                await self.bot.client.on_error(error, None, None)
            finally:
                await self.clear_queue(queue_id, function, True)
        else:
            if queue_id in self.queues and len(
                    self.queues[queue_id]) == 0:
                del self.queues[queue_id]


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

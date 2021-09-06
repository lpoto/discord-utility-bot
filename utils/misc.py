import sys
import discord
from collections import deque
import random


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
            self.queues[queue_id] = [False, deque([])]
        self.queues[queue_id][1].append(item)
        # start clearing the queue immediately if function provided
        if function is not None:
            await self.clear_queue(queue_id, function, False)

    async def clear_queue(self, queue_id, function, ignore_running):
        if queue_id not in self.queues:
            return
        # clear messages or reaction in queue to avoid
        # multiple instances of same command or reactions
        if (queue_id in self.queues and
            (not self.queues[queue_id][0] or
             ignore_running) and len(self.queues[queue_id][1]) > 0):
            self.queues[queue_id][0] = True
            item = self.queues[queue_id][1].popleft()
            # catch exceptions triggered when clearing the queue
            # and continue clearing
            try:
                await function(item)
            except Exception as err:
                self.bot.client.dispatch('error', err, *sys.exc_info())
            finally:
                await self.clear_queue(queue_id, function, True)
        else:
            # clean up
            if queue_id in self.queues and len(
                    self.queues[queue_id][1]) == 0:
                del self.queues[queue_id]


def delete_button(row=None):
    return discord.ui.Button(
        style=discord.ButtonStyle.blurple,
        label='delete',
        row=row)


def random_color():
    """generate a random color"""
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)


# emojis rock, paper, scissors
rps_emojis = [
        u"\U0001FAA8",
        u"\U0001F5DE\U0000FE0F",
        u"\U00002702\U0000FE0F"]
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

cross = u"\U0000274C"
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

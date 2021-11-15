import sys
import discord
from collections import deque
import random


class Queue():
    """
    Create queues for messages constantly edited by buttons or replies
    to avoid duplicating or missing any of the edits.
    """

    def __init__(self, bot):
        self.bot = bot
        self.queues = {}

    async def add_to_queue(self, queue_id, *args, function=None, idx=None):
        if idx is None:
            self.queues.setdefault(
                queue_id, [False, deque([])])[1].append(args)
        else:
            self.queues.setdefault(
                queue_id, [False, deque([])])[1].insert(idx, args)
        # start clearing the queue immediately if function provided
        if function is not None:
            await self.clear_queue(queue_id, function, False)

    async def clear_queue(self, queue_id, function, ignore_running):
        if queue_id not in self.queues:
            return
        # clear messages or interactions in queue to avoid
        # multiple instances of same command or interactions
        if (queue_id in self.queues and
            (not self.queues[queue_id][0] or
             ignore_running) and len(self.queues[queue_id][1]) > 0):
            self.queues[queue_id][0] = True
            args = self.queues[queue_id][1].popleft()
            # catch exceptions triggered when clearing the queue
            # and continue clearing
            try:
                await function(*args)
            except ValueError as err:
                if str(err) in [
                    'could not find open space for item',
                        'item would not fit at row 4 (6 > 5 width)']:
                    raise ValueError(err)
                else:
                    self.bot.client.dispatch('error', err, *sys.exc_info())
            except Exception as err:
                self.bot.client.dispatch('error', err, *sys.exc_info())
            finally:
                await self.clear_queue(queue_id, function, True)
        else:
            # clean up
            if queue_id in self.queues and len(
                    self.queues[queue_id][1]) == 0:
                del self.queues[queue_id]


def get_component(req_attr, msg, attr='custom_id'):
    for component in msg.components:
        if not hasattr(component, 'children'):
            continue
        for b in component.children:
            if hasattr(b, attr) and (
                    getattr(b, attr) == req_attr):
                return b


def delete_button(row=None):
    return discord.ui.Button(
        style=discord.ButtonStyle.blurple,
        label='delete',
        row=row)


def random_color():
    """generate a random color"""
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)


# emojis rock, paper, scissors
rps_emojis = (
    u"\U0001FAA8",
    u"\U0001F5DE\U0000FE0F",
    u"\U00002702\U0000FE0F")
# thumbs up emoji
thumbs_up = u"\U0001F44D"
number_emojis = (
    '1️⃣',
    '2️⃣',
    '3️⃣',
    '4️⃣',
    '5️⃣',
    '6️⃣',
    '7️⃣'
)
squares = {
    'red': '🟥',
    'blue': '🟦',
    'brown': '🟫',
    'green': '🟩',
    'yellow': '🟨',
    'orange': '🟧',
    'purple': '🟪',
    'white': '⬜',
    'black': '⬛',
}
circles = {
    'red': '🔴',
    'blue': '🔵',
    'orange': '🟠',
    'green': '🟢',
    'yellow': '🟡',
    'brown': '🟤',
    'purple': '🟣',
    'white': '⚪',
    'black': '⚫'
}
emojis = tuple(circles.values())
# colors that match emoji colors by indexes
colors = (
    0xffffff,
    0xc30202,
    0x0099e1,
    0xf75f1c,
    0xf8c300,
    0x008e44,
    0xa652bb,
    0xa5714e,
    0,
)
green_color = 0x008e44
red_color = 0xc30202

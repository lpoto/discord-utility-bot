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

    async def add_to_queue(self, queue_id, item, function=None, idx=None):
        if idx is None:
            self.queues.setdefault(
                queue_id, [False, deque([])])[1].append(item)
        else:
            self.queues.setdefault(
                queue_id, [False, deque([])])[1].insert(idx, item)
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
            item = self.queues[queue_id][1].popleft()
            # catch exceptions triggered when clearing the queue
            # and continue clearing
            try:
                await function(item)
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

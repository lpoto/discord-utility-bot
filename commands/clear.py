import discord
from command import Command
from utils import *
import re


class Clear_chat(Command):
    def __init__(self):
        super().__init__('clear')
        self.description = 'Clear from 1 to 50 messages in chat.'
        self.bot_permissions = ['send_messages', 'manage_messages']
        self.user_permissions = ['send_messages', 'manage_messages']

    async def execute_command(self, msg):
        args = msg.content.split()
        role_channel = await get_roleschannel(msg)
        try:
            # don't allow purging in role-managing channel
            if role_channel is not None and msg.channel == role_channel:
                txt = 'Cannot clear messages in this channel!'
                await message_delete(msg, 5, txt)
                return
            if len(args) < 2:
                txt = 'How many messages do you want to delete?'
                await message_delete(msg, 5, txt)
                return
            count = 0
            try:
                count = int(args[1])
            except Exception:
                txt = 'Argument must be a number between 0 and 50!'
                await message_delete(msg, 5, txt)
                return
            else:
                count = int(args[1])
            # allow deleting only between 1 and 50 messages
            # ... if messages are older than 14 days bot will have to delete
            # messages one by one, so deleting large amounts of messages might
            # take a while and cause problems
            if count > 50:
                txt = 'You cannot delete more than 50 messages at once!'
                await message_delete(msg, 5, txt)
                return
            if count <= 0:
                txt = 'You must delete at least 1 message!'
                await message_delete(msg, 5, txt)
                return
            # purge the messages and send how many were actually deleted
            purged = len(await msg.channel.purge(
                limit=count + 1,
                check=self.purge_filter)) - 1
            if purged < 1:
                txt = 'Could not delete any messages.'
                await message_delete(msg, 3, txt)
            else:
                txt = 'Deleted {count} messages.'.format(count=purged)
                await message_delete(msg, 3, txt)
        except Exception as err:
            await send_error(msg, err, 'clear.py -> execute_command()')

    def purge_filter(self, msg):
        # don't delete pinned messages and polls
        return (re.search('^```.*\nPOLL: ', msg.content) is None
                and not msg.pinned)

    def additional_info(self, prefix):
        return '{}\n{}\n{}\n{}'.format(
            '* deleting messages older than 14 days takes longer.',
            '* Pinned messages will not be deleted.',
            '* Messages in roles channel will not be deleted.',
            '* Polls will not be deleted.')


Clear_chat()

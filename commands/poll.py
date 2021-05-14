import discord
import re
from command import Command
from utils import *


class Poll(Command):
    def __init__(self):
        super().__init__('poll')
        self.description = 'Create a poll to vote on.'
        self.running = False
        self.react_queue = []

    async def execute_command(self, msg):
        try:
            if re.search('(http)|(`)|( :)|(POLL)', msg.content):
                txt = 'Invalid question!'
                await message_delete(msg, 5, txt)
            poll_question = ' '.join(msg.content.split()[1:])
            await msg.channel.send('```0\nPOLL: ' + poll_question + '```')
        except Exception as err:
            await send_error(msg, err, 'poll.py -> execute_command()')

    async def on_message(self, msg):
        try:
            if msg.reference is None or not msg.reference.message_id:
                return
            poll_message = await msg.channel.fetch_message(
                msg.reference.message_id)
            if (poll_message is None or
                    poll_message.author.id != client.user.id or
                    not re.search("^```.*\nPOLL: ", poll_message.content)):
                return
            await self.get_poll_info(msg, poll_message, 0)
        except Exception as err:
            await send_error(msg, err, 'poll.py -> on_message()')

    async def get_poll_info(self, msg, poll, i):
        text = msg.content.split(';')
        response = text[i]
        try:
            if re.search('(http)|(`)|( :)|(POLL)', response):
                txt = 'Invalid question!'
                await message_delete(msg, 5, txt)
            else:
                responses = poll.content[3:][:-3].split('``````')
                if poll.content.startswith('```CSS'):
                    pass
                elif re.search('^(poll)?end(poll)?|(stop)$', response):
                    await self.end_poll(msg, poll)
                elif poll.content.startswith('```apache'):
                    pass
                elif re.search('^(poll)? ?fix ?(poll)?$', response):
                    await self.fix_poll(msg, poll)
                elif re.search('^remove .*$', response):
                    await self.remove_response(response, responses, msg, poll)
                else:
                    poll = await self.add_response(
                        response, responses, msg, poll)
                    num = int(poll.content.split('\nPOLL')[0].split('```')[1])
                    if num >= len(emojis):
                        await self.fix_poll(msg, poll)
                        return
                    if i < len(text) - 1:
                        await self.get_poll_info(msg, poll, i + 1)

        except Exception as err:
            await send_error(msg, err, 'poll.py -> get_poll_info()')

    async def add_response(self, response, responses, msg, poll):
        try:
            num = int(poll.content.split('\nPOLL')[0].split('```')[1])
            if num + 1 >= len(emojis):
                return self.fix_poll(msg, poll)
            responses[0] = responses[0].replace(responses[0][0], str(num + 1))
            emoji = list(emojis.keys())[num]
            await message_react(poll, emoji)
            responses.append('\n{}(0) {}: '.format(emoji, response))
            txt = '```' + '``````'.join(responses) + '```'
            await message_edit(poll, txt)
            return poll
        except Exception as err:
            await send_error(msg, err, 'poll.py -> add_response()')

    async def fix_poll(self, msg, poll):
        try:
            if re.search('^```.*\nPOLL: ', poll.content) is None:
                return poll
            x = poll.content.split('\nPOLL: ')
            x[0] = '```apache'
            await message_edit(poll, '\nPOLL: '.join(x))
            txt = 'Poll has been fixed, you cannot add or remove responses.'
            await message_delete(msg, 5, txt)
            return poll
        except Exception as err:
            await send_error(msg, err, 'poll.py -> fix_poll()')

    async def end_poll(self, msg, poll):
        try:
            x = poll.content.split('\nPOLL: ')
            x[0] = '```CSS'
            await message_edit(poll, '\nPOLL[ended]: '.join(x))
            txt = 'Poll has been ended'
            await message_delete(msg, 5, txt)
            return poll
        except Exception as err:
            await send_error(msg, err, 'poll.py -> end_poll()')

    async def remove_response(self, response, responses, msg, poll):
        try:
            num = response.split()[1]
            try:
                num = int(num)
            except Exception:
                txt = 'Responses can only be removed by indexes (1 - n)'
                await message_delete(msg, 5, txt)
                return poll
            if num > len(responses) - 1 or num < 1:
                txt = ('There are ' + (len(responses) - 1) +
                       ' responses in the poll.')
                await message_delete(msg, 5, txt)
                return poll
            emoji = responses[num].split('(')[0].replace('\n', '')
            del responses[num]
            txt = '```' + '``````'.join(responses) + '```'
            await message_edit(poll, txt)
            await poll.remove_reaction(
                    emoji, client.user)
            return poll
        except Exception as err:
            await send_error(msg, err, 'poll.py -> remove_response()')

    async def on_raw_reaction(self, msg, payload):
        try:
            if re.search('```.*\nPOLL: ', msg.content) is None:
                return
            emoji = payload.emoji.name
            self.react_queue.append((msg, emoji))
            await self.clear_queue(False)
        except Exception as err:
            await send_error(msg, err, 'poll.py -> on_raw_reaction()')

    async def clear_queue(self, ignore_running):
        if (not self.running or ignore_running) and len(self.react_queue) > 0:
            self.running = True
            try:
                command = self.react_queue.pop(0)
                msg = command[0]
                emoji = command[1]
                responses = msg.content[3:][:-3].split('``````')
                index = -1
                for i in range(len(responses)):
                    if responses[i].startswith('\n' + emoji):
                        index = i
                        break
                if index == -1:
                    return await self.clear_queue(True)
                reacts = discord.utils.get(
                    msg.reactions, emoji=emoji)
                reacts_count = 0
                if reacts:
                    reacts_count = reacts.count
                    if reacts.me:
                        reacts_count -= 1
                x = responses[index].split(': ')[0].split(')')[1]
                x = '\n{}({}){}'.format(emoji, reacts_count, x)
                responses[index] = '{}: {}'.format(x, emoji * reacts_count)
                txt = '```' + '``````'.join(responses) + '```'
                await message_edit(msg, txt)
            except Exception as err:
                await send_error(msg, err, 'poll.py -> clear_queue()')
            finally:
                await self.clear_queue(True)
        else:
            self.running = False

    def additional_info(self):
        return ('* {}\n* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Initialize the poll with "poll <question>"',
            "Add responses with replying to the poll.",
            'Multiple responses can be added at once, ' +
            'separated with semicolon (response1;response2;...).',
            'Remove a response with replying "remove <number>".',
            'Fix poll responses with replying "fix".',
            'End the poll with replying "end".'))


Poll()

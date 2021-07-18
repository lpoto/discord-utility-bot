import discord
import re
from command import Command
from utils import *


class Poll(Command):
    def __init__(self):
        super().__init__('poll')
        self.description = 'Create a poll to vote on.'
        self.poll_info_queues = {}
        self.react_queues = {}

    async def execute_command(self, msg):
        try:
            # don't allow links and `, @ ... signs to avoid
            # breaking poll form
            if re.search('http|`|POLL|<@', msg.content):
                txt = 'Invalid question!'
                await message_delete(msg, 5, txt)
                return
            if len(msg.content.split()) < 2:
                txt = 'I need a question!'
                await message_delete(msg, 5, txt)
                return
            # question  is added with the poll command "poll <question>"
            poll_question = ' '.join(msg.content.split()[1:])
            await msg.channel.send('```\nPOLL: ' + poll_question + '```')
            # created poll is edited by replying with responses
        except Exception as err:
            await send_error(msg, err, 'poll.py -> execute_command()')

    async def on_message(self, msg, bot):
        try:
            # check if command is valid (can be used in this channel...)
            if not await bot.check_if_valid(
                    bot.commands[self.name], msg):
                return
            # message must be a reply to a POLL message
            if msg.reference is None or not msg.reference.message_id:
                return
            poll_message = await msg.channel.fetch_message(
                msg.reference.message_id)
            if (poll_message is None or
                    poll_message.author.id != client.user.id or
                    not re.search("^```.*\nPOLL: ", poll_message.content)):
                return
            # get replies from the message
            if poll_message.id not in self.poll_info_queues:
                self.poll_info_queues[poll_message.id] = []
            for r in msg.content.split(';'):
                self.poll_info_queues[poll_message.id].append(
                    (r, poll_message, msg))
            await clear_queue(
                'poll_messages({})'.format(poll_message.id),
                False,
                self.poll_info_queues[poll_message.id],
                self.get_poll_info)
            if self.poll_info_queues[poll_message.id] == []:
                del self.poll_info_queues[poll_message.id]
            # await self.get_poll_info(msg, poll_message, 0, False)
        except Exception as err:
            await send_error(msg, err, 'poll.py -> on_message()')

    async def get_poll_info(self, queue):
        # function used when clearing queue for adding responses,.. to a poll
        try:
            # there can be multiple replies in one message, split with ;
            info = queue.pop(0)
            response = info[0]
            poll = info[1]
            msg = info[2]
            # if max number of responses added, edit apache into hidden text
            # when removing responses, apache will be edited out
            # hidden text allows us to not spam max responses message in chat
            max_responses = False
            if poll.content.split('\n')[0] == '```apache':
                max_responses = True
            # don't allow certain patterns that could break poll form
            if re.search('http|`|POLL|<@', msg.content):
                txt = 'Invalid response!'
                await message_delete(msg, 5, txt)
                return
            else:
                # if poll has ```yaml at the start it is fixed, so
                # no replies can be added or removed
                #  if poll has ```CSS it has been ended
                responses = poll.content[3:][:-3].split('``````')
                if poll.content.startswith('```CSS'):
                    pass
                elif re.search('^ ?(poll)? ?end ?(poll)?|(stop)$', response):
                    await self.end_poll(msg, poll)
                elif poll.content.startswith('```yaml'):
                    pass
                elif re.search('^ ?(poll)? ?fix ?(poll)?$', response):
                    await self.fix_poll(msg, poll)
                elif re.search('^ ?remove .*$', response):
                    await self.remove_response(
                        response, responses, msg, poll)
                elif re.search('^ ?question .*', response):
                    await self.change_question(
                        response, responses, msg, poll)
                elif len(responses) > len(emojis) and not max_responses:
                    poll_txt = poll.content.split('\n')
                    poll_txt[0] = '```apache'
                    await message_edit(poll, '\n'.join(poll_txt))
                    txt = 'Maximum response count reached!'
                    await message_delete(msg, 5, txt)
                elif not max_responses:
                    poll = await self.add_response(
                        response, responses, msg, poll)
        except Exception as err:
            await send_error(msg, err, 'poll.py -> get_poll_info()')

    async def add_response(self, response, responses, msg, poll):
        try:
            emoji = emojis[len(responses) - 1]
            responses[0] = responses[0].split('\n')
            # check for hidden text -> (```<hidden_text>\nPOLL)
            # contains indexes of removed responses
            # so we can reuse the removed emojis
            hidden_txt = responses[0][0]
            if hidden_txt != '':
                hidden_txt = hidden_txt.split('a')
                emoji = emojis[int(hidden_txt[0])]
                del hidden_txt[0]
                hidden_txt = 'a'.join(hidden_txt)
            responses[0] = '{}\n{}'.format(hidden_txt, responses[0][1])
            await message_react(poll, emoji)
            responses.append('\n{}(0) {}: '.format(emoji, response))
            txt = '```' + '``````'.join(responses) + '```'
            await message_edit(poll, txt)
            return poll
        except Exception as err:
            await send_error(msg, err, 'poll.py -> add_response()')
            return poll

    async def change_question(self, question, responses, msg, poll):
        # change the question of the poll
        try:
            question = question.replace('question ', '', 1)
            responses[0] = (responses[0].split('POLL: '))
            responses[0][1] = question
            responses[0] = 'POLL: '.join(responses[0])
            txt = '```' + '``````'.join(responses) + '```'
            await message_edit(poll, txt)
        except Exception as err:
            await send_error(msg, err, 'poll.py -> change_question()')

    async def fix_poll(self, msg, poll):
        # if poll is fixed, no replies can be added or removed
        try:
            if re.search('^```.*\nPOLL: ', poll.content) is None:
                return poll
            x = poll.content.split('\nPOLL: ')
            x[0] = '```yaml'
            await message_edit(poll, '\nPOLL: '.join(x))
            txt = 'Poll has been `fixed`, you cannot add or remove responses.'
            await message_delete(msg, 5, txt)
            return poll
        except Exception as err:
            await send_error(msg, err, 'poll.py -> fix_poll()')

    async def end_poll(self, msg, poll):
        # if poll is ended, it cannot be edited anymore
        try:
            x = poll.content.split('\nPOLL: ')
            x[0] = '```CSS'
            await message_edit(poll, '\nPOLL[ended]: '.join(x))
            txt = 'Poll has been `ended`.'
            await message_delete(msg, 5, txt)
            return poll
        except Exception as err:
            await send_error(msg, err, 'poll.py -> end_poll()')

    async def remove_response(self, response, responses, msg, poll):
        try:
            num = response.split()[1]
            try:
                num = int(num) + 1
                if num >= len(responses) or num < 0:
                    raise Exception
            except Exception:
                txt = ('Responses can only be removed by indexes ' +
                       'from `{}` to `{}`').format(0, len(responses) - 2)
                await message_delete(msg, 5, txt)
                return False
            emoji = responses[num].split('(')[0].replace('\n', '')
            del responses[num]
            responses[0] = responses[0].split('\n')
            # save indexes of removed emojis in hidden_txt so we can
            # reuse them when adding new responses
            hidden_txt = responses[0][0]
            if hidden_txt == '' or hidden_txt == 'apache':
                hidden_txt = emojis.index(emoji)
            else:
                hidden_txt = '{}a{}'.format(
                    hidden_txt, emojis.index(emoji))
            responses[0] = '{}\n{}'.format(hidden_txt, responses[0][1])
            txt = '```' + '``````'.join(responses) + '```'
            await message_edit(poll, txt)
            # remove bot's reaction that belongs to the removed response
            await message_remove_reaction(poll, emoji, client.user)
            return True
        except Exception as err:
            await send_error(msg, err, 'poll.py -> remove_response()')
            return False

    async def on_raw_reaction(self, msg, payload):
        # when a valid reaction is added or removed from the poll,
        # edit the poll accordingly in queue
        # so we don't lose or duplicate any responses
        try:
            if re.search('```.*\nPOLL: ', msg.content) is None:
                return
            emoji = payload.emoji.name
            if msg.id not in self.react_queues:
                self.react_queues[msg.id] = []
            self.react_queues[msg.id].append((msg, emoji))
            # process reactions in queue
            await clear_queue(
                queue_type='poll_reactions ({})'.format(msg.id),
                ignore_running=False,
                queue=self.react_queues[msg.id],
                function=self.queue_function)
        except Exception as err:
            await send_error(msg, err, 'poll.py -> on_raw_reaction()')

    async def queue_function(self, queue):
        # function to be used when processing poll reactions queue
        try:
            command = queue.pop(0)
            msg = command[0]
            emoji = command[1]
            responses = msg.content[3:][:-3].split('``````')
            index = -1
            for i in range(len(responses)):
                if responses[i].startswith('\n' + emoji):
                    index = i
                    break
            if index == -1:
                return
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
            await send_error(msg, err, 'poll.py -> queue_function()')

    def additional_info(self, prefix):
        return ('* {}\n* {}\n* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Initialize the poll with "{}poll <question>"'.format(prefix),
            'Change question by replying "question <new_question>".',
            "Add responses by replying to the poll.",
            'Multiple responses can be added at once, ' +
            'separated with semicolons (response1;response2;...).',
            'Remove a response by replying "remove <number>".',
            'Fix poll responses with replying "fix".',
            'End the poll with replying "end".'))


Poll()

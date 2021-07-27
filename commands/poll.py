from commands.help import Help
from utils import emojis
import discord
import re


class Poll(Help):
    def __init__(self):
        super().__init__(name='poll')
        self.description = 'Create a poll to vote on.'

    async def execute_command(self, msg):
        # don't allow links and `, @ ... signs to avoid
        # breaking poll form
        if re.search('http|`|POLL|<@', msg.content):
            await msg.channel.send(
                text='Invalid question!',
                delete_after=5)
            return
        if len(msg.content.split()) < 2:
            await msg.channel.send(
                text='I need a question!',
                delete_after=5)
            return
        # question  is added with the poll command "poll <question>"
        poll_question = msg.content.replace('{} '.format(
            msg.content.split()[0]), '', 1)
        await msg.channel.send(
            text='```\nPOLL: ' + poll_question + '```')
        # created poll is edited by replying with responses

    async def on_reply(self, msg, poll_message):
        # check if command is valid (can be used in this channel...)
        if not re.search('^```.*\nPOLL:', poll_message.content):
            return
        # get replies from the message
        for r in msg.content.split(';'):
            await self.bot.queue.add_to_queue(
                queue_id='message:{}'.format(poll_message.id),
                item=(r, poll_message.channel.id, poll_message.id),
                function=self.get_poll_info)

    async def get_poll_info(self, item):
        # function used when clearing queue for adding responses,.. to a poll
        # there can be multiple replies in one message, split with ;
        response = item[0]
        channel = self.bot.client.get_channel(int(item[1]))
        if channel is None:
            return
        poll = await channel.fetch_message(int(item[2]))
        if poll is None:
            return
        # if max number of responses added, edit apache into hidden text
        # when removing responses, apache will be edited out
        # hidden text allows us to not spam max responses message in chat
        max_responses = False
        if poll.content.split('\n')[0] == '```apache':
            max_responses = True
        # don't allow certain patterns that could break poll form
        if re.search('http|`|POLL|<@', response):
            await poll.channel.send(
                text='Invalid response!',
                delete_after=5)
            return
        else:
            # if poll has ```yaml at the start it is fixed, so
            # no replies can be added or removed
            #  if poll has ```CSS it has been ended
            responses = poll.content[3:][:-3].split('``````')
            if poll.content.startswith('```CSS'):
                pass
            elif re.search('^ ?(poll)? ?end ?(poll)?|(stop)$', response):
                await self.end_poll(poll)
            elif poll.content.startswith('```yaml'):
                pass
            elif re.search('^ ?(poll)? ?fix ?(poll)?$', response):
                await self.fix_poll(poll)
            elif re.search('^ ?remove .*$', response):
                await self.remove_response(
                    response, responses, poll)
            elif re.search('^ ?question .*', response):
                await self.change_question(
                    response, responses, poll)
            elif len(responses) > len(emojis) and not max_responses:
                poll_txt = poll.content.split('\n')
                poll_txt[0] = '```apache'
                await poll.edit(text='\n'.join(poll_txt))
                await poll.channel.send(
                    text='Maximum response count reached!',
                    delete_after=5)
            elif not max_responses:
                await self.add_response(
                    response, responses, poll)

    async def add_response(self, response, responses, poll):
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
        responses.append('\n{}(0) {}: '.format(emoji, response))
        txt = '```' + '``````'.join(responses) + '```'
        await poll.edit(text=txt, reactions=emoji)

    async def change_question(self, question, responses, poll):
        # change the question of the poll
        question = question.replace('question ', '', 1)
        responses[0] = (responses[0].split('POLL: '))
        responses[0][1] = question
        responses[0] = 'POLL: '.join(responses[0])
        txt = '```' + '``````'.join(responses) + '```'
        await poll.edit(text=txt)

    async def fix_poll(self, poll):
        # if poll is fixed, no replies can be added or removed
        if re.search('^```.*\nPOLL: ', poll.content) is None:
            return
        x = poll.content.split('\nPOLL: ')
        x[0] = '```yaml'
        await poll.edit(text='\nPOLL: '.join(x))
        txt = 'Poll has been `fixed`, you cannot add or remove responses.'
        await poll.channel.send(
            text=txt,
            delete_after=5)

    async def end_poll(self, poll):
        # if poll is ended, it cannot be edited anymore
        x = poll.content.split('\nPOLL: ')
        x[0] = '```CSS'
        await poll.edit(text='\nPOLL[ended]: '.join(x))
        await poll.channel.send(
            text='Poll has been `ended`.',
            delete_after=5)
        return

    async def remove_response(self, response, responses, poll):
        num = response.split()[1]
        try:
            num = int(num) + 1
            if num >= len(responses) or num < 0:
                raise ValueError
        except ValueError:
            await poll.channel.send(
                text=('Responses can only be removed by indexes ' +
                      'from `{}` to `{}`').format(0, len(responses) - 2),
                delete_after=5)
            return
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
        await poll.edit(text=txt)
        # remove bot's reaction that belongs to the removed response
        await poll.remove_reaction(emoji=emoji)

    async def on_raw_reaction(self, msg, payload):
        # when a valid reaction is added or removed from the poll,
        # edit the poll accordingly in queue
        # so we don't lose or duplicate any responses
        if re.search('```.*\nPOLL: ', msg.content) is None:
            return
        emoji = payload.emoji.name
        await self.bot.queue.add_to_queue(
            queue_id='reaction:{}'.format(msg.id),
            item=(msg.id, msg.channel, emoji),
            function=self.queue_function)

    async def queue_function(self, item):
        # function to be used when processing poll reactions queue
        msg_id = item[0]
        channel = item[1]
        try:
            msg = await channel.fetch_message(int(msg_id))
            if msg is None:
                raise ValueError
        except ValueError:
            return
        emoji = item[2]
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
        await msg.edit(text=txt)

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

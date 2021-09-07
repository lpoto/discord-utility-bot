from commands.help import Help
import discord
from utils.misc import emojis, random_color
from utils.wrappers import EmbedWrapper


class Poll(Help):
    def __init__(self):
        super().__init__(name='poll')
        self.description = 'Create a poll to vote on.'
        self.synonyms = ['vote']
        self.token = '⦾'

    async def execute_command(self, msg):
        args = msg.content.split()
        if len(args) < 2:
            await msg.channel.warn(text='Add a question!')
            return
        question = msg.content.replace('{} '.format(args[0]), '', 1)
        m = await msg.channel.send(embed=self.starting_embed(question))
        m.is_poll

    def response_format(self, emoji, count):
        return '{}\u2000({}):\u2000\u2000{}'.format(
            emoji, count, str(count * self.token))

    def response_to_embed(
            self, embed, response, emoji=None, count=0, index=None):
        if emoji is None:
            emoji = emojis[len(embed.fields)]
        if index is None:
            embed.add_field(
                name='\u2000\u2000{}'.format(response),
                value=self.response_format(emoji, count),
                inline=False)
        else:
            embed.set_field_at(
                index=index,
                name='\u2000\u2000{}'.format(response),
                value=self.response_format(emoji, count),
                inline=False)
        return embed

    async def on_raw_reaction(self, poll_msg, payload):
        if not poll_msg.is_poll:
            return
        emoji = payload.emoji.name
        for idx, field in enumerate(poll_msg.embeds[0].fields):
            if field.value.startswith(emoji):
                await self.bot.queue.add_to_queue(
                    queue_id='pollreaction:{}'.format(poll_msg.id),
                    item=(poll_msg.channel.id, poll_msg.id, emoji, idx),
                    function=self.edit_responses)

    async def edit_responses(self, item):
        channel = self.bot.client.get_channel(int(item[0]))
        if channel is None:
            return
        poll_msg = await channel.fetch_message(int(item[1]))
        if poll_msg is None:
            return
        emoji = item[2]
        idx = item[3]
        response = poll_msg.embeds[0].fields[idx].name
        reacts = discord.utils.get(poll_msg.reactions, emoji=emoji)
        count = 0
        if reacts:
            count = reacts.count
            if reacts.me:
                count -= 1
        embed = self.response_to_embed(
            embed=poll_msg.embeds[0],
            response=response,
            emoji=emoji,
            count=count,
            index=idx)
        await poll_msg.edit(embed=embed)

    async def on_reply(self, msg, poll_msg):
        if not poll_msg.is_poll:
            return
        opts = msg.content.split(';')
        for o in opts:
            if len(o) < 1:
                continue
            await self.bot.queue.add_to_queue(
                queue_id='pollmessage:{}'.format(poll_msg.id),
                item=(poll_msg.channel.id, poll_msg.id, o.strip()),
                function=self.add_poll_info)

    async def add_poll_info(self, item):
        channel = self.bot.client.get_channel(int(item[0]))
        if channel is None:
            return
        poll_msg = await channel.fetch_message(int(item[1]))
        if poll_msg is None:
            return
        funcs = {'remove': self.remove_response,
                 'fix': self.fix_poll,
                 'end': self.end_poll,
                 'question': self.change_question}
        option = item[2]
        args = option.split()
        if args[0] in funcs:
            v = option.replace('{} '.format(args[0]), '', 1)
            return await funcs[args[0]](poll_msg, v)
        return await self.add_response(poll_msg, option)

    async def add_response(self, poll_msg, option):
        if (len(poll_msg.embeds[0]) >= 6000 or
                len(poll_msg.embeds[0].fields) >= len(emojis)):
            await poll_msg.channel.warn(
                text='Maximum number of responses reached!')
        marks = poll_msg.embeds[0].get_marks()
        if marks is not None and EmbedWrapper.FIXED in marks:
            return
        info = poll_msg.embeds[0].get_id()
        emoji = emojis[len(poll_msg.embeds[0].fields)]
        if info['extra']:
            ftr = info['extra'].strip().split()
            emoji = emojis[int(ftr[0])]
            if len(ftr) > 1:
                poll_msg.embeds[0].set_id(extra=' '.join(ftr[1:]))
            else:
                poll_msg.embeds[0].set_id()
        embed = self.response_to_embed(
            embed=poll_msg.embeds[0],
            response=option,
            emoji=emoji)
        embed.description = None
        await poll_msg.edit(embed=embed, reactions=emoji)

    async def fix_poll(self, poll_msg, option):
        marks = poll_msg.embeds[0].get_marks()
        if marks is not None and EmbedWrapper.FIXED in marks:
            return
        poll_msg.embeds[0].mark(
            [EmbedWrapper.FIXED, EmbedWrapper.NOT_DELETABLE])
        await poll_msg.edit(embed=poll_msg.embeds[0])
        await poll_msg.channel.notify(
            text='Poll has been fixed, no responses ' +
            'can be added or removed.')

    async def change_question(self, poll_msg, option):
        marks = poll_msg.embeds[0].get_marks()
        if marks is not None and EmbedWrapper.FIXED in marks:
            return
        poll_msg.embeds[0].title = 'Q:\u2000' + option
        await poll_msg.edit(embed=poll_msg.embeds[0])

    async def end_poll(self, poll_msg, option):
        poll_msg.embeds[0].mark(
            [EmbedWrapper.ENDED, EmbedWrapper.NOT_DELETABLE])
        await poll_msg.edit(embed=poll_msg.embeds[0])
        await poll_msg.channel.notify(
            text='Poll has been ended.')

    async def remove_response(self, poll_msg, option):
        marks = poll_msg.embeds[0].get_marks()
        if marks is not None and EmbedWrapper.FIXED in marks:
            return
        try:
            option = int(option)
            if (option >= len(poll_msg.embeds[0].fields) or
                    option < 0):
                raise ValueError
        except ValueError:
            if len(poll_msg.embeds[0].fields) == 0:
                await poll_msg.channel.warn(
                        'There are no responses in the poll!')
                return
            await poll_msg.channel.warn(
                text=('Responses can only be removed by indexes ' +
                      'from `{}` to `{}`').format(
                    0, len(poll_msg.embeds[0].fields) - 1))
            return
        emoji = poll_msg.embeds[0].fields[option].value.split()[0]
        poll_msg.embeds[0].remove_field(option)
        option = emojis.index(emoji)
        info = poll_msg.embeds[0].get_id()['extra']
        if not info:
            poll_msg.embeds[0].set_id(extra=option)
        else:
            poll_msg.embeds[0].set_id(
                extra=info + ' ' + str(option))
        m = await poll_msg.edit(embed=poll_msg.embeds[0])
        await m.remove_reaction(emoji)

    def starting_embed(self, question):
        poll_embed = EmbedWrapper(discord.Embed(
            title='Q:\u2000' + question,
            color=random_color(),
            description='* {}\n* {}\n* {}\n* {}\n* {}\n{}'.format(
                'Reply to this message to add a response.',
                'Reply "remove <idx>" to remove response with index <idx>.',
                'Reply "fix" to disable adding or removing responses.',
                'Reply "end" to finish the poll.',
                'Multiple options can be added at once, separated with ";".\n',
                'Example: "response1; response2; remove 0; response3;fix"')),
            embed_type='POLL',
            marks=EmbedWrapper.NOT_DELETABLE)
        return poll_embed

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

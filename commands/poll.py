from commands.help import Help
import discord
from utils.misc import random_color, black_circle, white_circle

# TODO see lists of users who voted with dropdown menu
# TODO default time to clean up old pollchannel_id


class Poll(Help):
    def __init__(self):
        super().__init__(name='poll')
        self.description = 'Create a poll to vote on.'
        self.synonyms = ['vote']
        self.tokens = [black_circle, white_circle]
        self.tokens_count = 2

    async def execute_command(self, msg):
        args = msg.content.split()
        if len(args) < 2:
            await msg.channel.warn(text='Add a question!')
            return
        question = msg.content.replace('{} '.format(args[0]), '', 1)
        embed = discord.Embed(
            description='POLL - {}{}ND'.format(
                question, (60 - len(question)) * '\u2000'),
            color=random_color())
        embed.set_footer(text='* {}\n* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Reply to this message to add a response.',
            'Reply "remove <idx>" to remove a response by index.',
            'Reply "question <new_question>" to change the question.',
            'Reply "fix" to prevent further adding or removing responses.',
            'Reply "end" to end the poll.',
            ('Multiple responses can be added at once, separated with ";" ' +
             '\n(example: "response1; remove 0; response2")')))
        await msg.channel.send(embed=embed)

    def is_poll(self, msg):
        if (str(msg.channel.type) != 'text' or
                msg.author.id != msg.guild.me.id or
                len(msg.embeds) != 1 or
                not msg.embeds[0].description or
                msg.embeds[0].description.split()[-1] not in ['ND', 'FND'] or
                msg.embeds[0].description.split(' - ')[0] != 'POLL'):
            return False
        return True

    async def on_reply(self, msg, poll_msg):
        if not self.is_poll(poll_msg):
            return
        opts = msg.content.split(';')
        for o in opts:
            if len(o) < 1:
                continue
            await self.bot.queue.add_to_queue(
                queue_id='pollmessage:{}'.format(poll_msg.id),
                item=(poll_msg.channel, poll_msg.id, o.strip()),
                function=self.add_poll_info)

    async def add_poll_info(self, item):
        channel = item[0]
        poll_msg = await channel.fetch_message(int(item[1]))
        if poll_msg is None or not self.is_poll(poll_msg):
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
        if poll_msg.embeds[0].description[-3:] in ['END', 'FND']:
            return
        await self.add_response(poll_msg, option)

    def get_response_name(self, text):
        return text.split('\u3000')[0]

    async def add_response(self, poll_msg, option):
        components = []
        option = '\u2000'.join(option.split())
        if len(option) > 30:
            await poll_msg.channel.warn(
                text='Cannot add responses longer than 20 characters.')
            return
        for i in poll_msg.components:
            for i2 in i.children:
                lbl = self.get_response_name(i2.label)
                if option == lbl.split('\u2000(')[0]:
                    return
                components.append(discord.ui.Button(label=i2.label))
        t = 42 + len(option)//2
        components.append(discord.ui.Button(
            label='{}\u3000{}'.format(
                option, (t - len(option)) * '\u3000')))
        if poll_msg.embeds[0].footer.text:
            poll_msg.embeds[0].set_footer(text=discord.Embed.Empty)
            await poll_msg.edit(
                embed=poll_msg.embeds[0], components=components)
            return
        await poll_msg.edit(components=components)

    async def fix_poll(self, poll_msg, option):
        if poll_msg.embeds[0].description.split()[-1] != 'ND':
            return
        poll_msg.embeds[0].description = poll_msg.embeds[
            0].description[:-3] + 'FND'
        await poll_msg.edit(embed=poll_msg.embeds[0])
        await poll_msg.channel.notify(
            text='Poll has been fixed, no responses ' +
            'can be added or removed.')

    async def change_question(self, poll_msg, option):
        marks = poll_msg.embeds[0].description.split()[-1]
        if marks in ('FND', 'END'):
            return
        poll_msg.embeds[0].description = 'Poll - {}{}{}'.format(
            option, (62 - len(marks) - len(option)) * '\u2000', marks)
        await poll_msg.edit(embed=poll_msg.embeds[0])

    async def end_poll(self, poll_msg, option):
        components = []
        equals = []
        max_len = 0
        for i in poll_msg.components:
            for i2 in i.children:
                components.append(discord.ui.Button(
                    label=i2.label))
                x = len(i2.label.split('\u3000')[1].strip())
                if x == max_len and max_len > 0:
                    equals.append(len(components) - 1)
                elif x > max_len:
                    equals.clear()
                    equals.append(len(components) - 1)
                    max_len = x
        if len(equals) == 1:
            components[equals[0]].style = discord.ButtonStyle.blurple
        elif len(equals) > 1:
            for i in equals:
                components[i].style = discord.ButtonStyle.blurple
        poll_msg.embeds[0].description = poll_msg.embeds[
            0].description[:-3] + 'END'
        await poll_msg.edit(embed=poll_msg.embeds[0], components=components)
        await self.bot.database.use_database(
            self.delete_poll_from_db, poll_msg)
        await poll_msg.channel.notify(
            text='Poll has been ended.')

    async def remove_response(self, poll_msg, option):
        if poll_msg.embeds[0].description[-3:] in ['FND', 'END']:
            return
        c = sum(len(i.children) for i in poll_msg.components)
        try:
            option = int(option)
            if (option >= c or
                    option < 0):
                raise ValueError
        except ValueError:
            if len(poll_msg.components) == 0:
                await poll_msg.channel.warn(
                    'There are no responses in the poll!')
                return
            await poll_msg.channel.warn(
                text=('Responses can only be removed by indexes ' +
                      'from `{}` to `{}`').format(
                    0, len(c) - 1))
            return
        components = []
        count = 0
        name = None
        for i in poll_msg.components:
            for i2 in i.children:
                if count != option:
                    components.append(discord.ui.Button(
                        label=i2.label))
                else:
                    name = self.get_response_name(i2.label)
                count += 1
        await poll_msg.edit(
            components=components)
        if name is not None:
            await poll_msg.channel.notify(
                text='Response `{}` has been removed.'.format(name))

    async def on_button_click(self, button, msg, user, webhook):
        if not self.is_poll(msg):
            return
        await self.bot.queue.add_to_queue(
            queue_id='pollmessage:{}'.format(msg.id),
            item=(msg.channel, msg.id, user, button),
            function=self.handle_button_click)

    async def handle_button_click(self, item):
        channel = item[0]
        msg = await channel.fetch_message(int(item[1]))
        if msg is None:
            return
        user = item[2]
        button = item[3]
        x = button.label.split('\u3000')
        add = await self.bot.database.use_database(
            self.add_or_remove, x[0], msg, user.id)
        components = []
        for idx1, parent in enumerate(msg.components):
            for idx2, v in enumerate(parent.children):
                if v.label != button.label:
                    components.append(discord.ui.Button(
                        label=v.label))
                    continue
                y = x[1].strip()
                if add:
                    if len(y) > 0:
                        y += y[-1]
                    else:
                        y += self.tokens[(idx1 + idx2) % self.tokens_count]
                elif len(y) > 0:
                    y = y[:-1]
                x = x[0]
                t = 42 + len(x) // 2
                ln = len(x + y)
                if ln >= t:
                    t = ln + 1
                components.append(
                    discord.ui.Button(
                        label='{}\u3000{}{}'.format(
                            x, y,
                            (t - len(x + y)) * '\u3000')))
        if not isinstance(x, str):
            return
        await msg.edit(components=components)
        if not add:
            await self.bot.database.use_database(
                self.delete_from_db, x, msg, user.id)
        else:
            await self.bot.database.use_database(
                self.insert_to_db, x, msg, user.id)

    async def add_or_remove(self, cursor, rsp, msg, user_id):
        cursor.execute((
            "SELECT * FROM poll WHERE guild_id = '{}' AND " +
            "channel_id = '{}' AND " +
            "message_id = '{}' AND user_id = '{}' AND response = '{}'"
        ).format(
            msg.guild.id, msg.channel.id, msg.id, user_id, rsp))
        fetched = cursor.fetchone()
        if fetched is None:
            return True
        return False

    async def delete_from_db(self, cursor, rsp, msg, user_id):
        cursor.execute((
            "DELETE FROM poll WHERE guild_id = '{}' AND " +
            "channel_id = '{}' AND " +
            "message_id = '{}' AND user_id = '{}' AND response = '{}'"
        ).format(
            msg.guild.id, msg.channel.id, msg.id, user_id, rsp))

    async def insert_to_db(self, cursor, rsp, msg, user_id):
        cursor.execute((
            "INSERT INTO poll (guild_id, channel_id, message_id, user_id, " +
            "response) VALUES ('{}', '{}', '{}', '{}', '{}')").format(
                msg.guild.id, msg.channel.id, msg.id, user_id, rsp))

    async def delete_poll_from_db(self, cursor, msg):
        cursor.execute((
            "DELETE FROM poll WHERE guild_id = '{}' AND " +
            "channel_id = '{}' AND message_id = '{}'").format(
            msg.guild.id, msg.channel.id, msg.id))

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

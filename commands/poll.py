from commands.help import Help
from datetime import datetime, timedelta
import discord
from utils.misc import random_color, black_circle, white_circle
from utils.wrappers import EmbedWrapper
import utils.decorators as decorators

# TODO what to do if too many people vote and the length
#      of a button label exceedes 80 characters


class Poll(Help):
    def __init__(self):
        super().__init__(name='poll')
        self.description = 'Create a poll for users to vote on.'
        self.synonyms = ['vote']
        self.requires_database = True
        self.interactions_require_database = True
        self.tokens = [black_circle, white_circle]
        self.tokens_count = 2

    def info_menu(self, components):
        # build a dropdown menu that contains all the responses
        if components is None or len(components) < 1:
            return None
        options = []
        for i in components:
            x = i.label.split('\u3000')[0].strip()
            options.append(discord.SelectOption(label=x))
        return discord.ui.Select(
            placeholder='Responses info', options=options,
            row=4)

    @decorators.ExecuteCommand
    async def send_empty_poll_to_channel(self, msg):
        # send a poll with only question added
        # to the channel and add info on adding responses
        args = msg.content.split()
        if len(args) < 2:
            await msg.channel.warn(content='Add a question!')
            return
        question = msg.content.replace('{} '.format(args[0]), '', 1)
        if len(question) >= 60:
            await msg.channel.warn(
                content='Can only add question shorter than 60 characters!')
            return
        embed = EmbedWrapper(
            discord.Embed(color=random_color()),
            embed_type='POLL - {}{}{}'.format(
                question,
                (59 - len(question)) * '\u2000',
                EmbedWrapper.NOT_DELETABLE))
        embed.set_footer(
            text=('* {}\n* {}\n* {}\n* {}\n* {}\n* {}')
            .format(
                'Reply to this message to add a response.',
                'Reply "remove <idx>" to remove a response by index.',
                'Reply "question <new_question>" to change the question.',
                'Reply "fix" to prevent further adding or removing responses.',
                'Reply "end" to close the poll.',
                ('Multiple responses can be added at once, separated ' +
                    'with ";" \n(example: "response1; remove 0; response2")')))

        m = await msg.channel.send(embed=embed)
        await self.bot.database.use_database(
            self.new_poll_to_database, m)

    def is_poll(self, msg, partly_endeded=False):
        # check if the message is a poll message
        if (str(msg.channel.type) != 'text' or
                msg.author.id != msg.guild.me.id or
                len(msg.embeds) != 1 or
                not msg.embeds[0].description or
                msg.embeds[0].description.split(' - ')[0] != 'POLL'):
            return False
        x = ['ND', 'FND']
        if partly_endeded:
            x.append('AND')
        if msg.embeds[0].description.split()[-1] not in x:
            return False
        return True

    @decorators.OnReply
    async def manage_poll_info(self, msg, poll_msg):
        # add or remove responses
        # fix poll -> no more responses can be added or removed
        # end poll -> button clicks don't work anymore
        # but you can still select the response in dropdown to see who voted
        if not poll_msg.is_poll:
            return
        # check if the user who replied has the required permissions
        if await self.bot.check_if_valid(self, msg, msg.author) is False:
            return
        # many options may be added at once separated with ";"
        # process them one by one
        opts = msg.content.split(';')
        for o in opts:
            # don't allow empty replies
            if len(o) < 1:
                continue
            try:
                await self.add_poll_info(
                    poll_msg.channel, poll_msg.id, o.strip())
            except ValueError as err:
                # there can only be 5 rows of buttons and dropdowns
                if str(err) in [
                    'could not find open space for item',
                        'item would not fit at row 4 (6 > 5 width)']:
                    await msg.channel.warn(
                        'Maximum number of responses reached!')
                    return
                else:
                    raise ValueError(err)

    async def add_poll_info(self, channel, poll_msg_id, option):
        # if reply does not contain any of the keywords
        # add a response to the poll, else
        # do whatever it is supposed to do
        poll_msg = await channel.fetch_message(int(poll_msg_id))
        if (poll_msg is None or not poll_msg.is_poll or
                (option != 'end' and poll_msg.is_fixed_poll) or
                option is None):
            return
        funcs = {'remove': self.remove_response,
                 'fix': self.fix_poll,
                 'end': self.end_poll,
                 'question': self.change_question}
        args = option.split()
        if args[0] in funcs:
            v = option.replace('{} '.format(args[0]), '', 1)
            return await funcs[args[0]](poll_msg, v)
        await self.add_response(poll_msg, option)

    def get_response_name(self, text):
        return text.split('\u3000')[0].strip()

    async def add_response(self, poll_msg, option):
        components = []
        option = option.replace('"', "'")
        option = '\u2000'.join(option.split())
        if len(option) > 30:
            await poll_msg.channel.warn(
                content='Cannot add responses longer than 20 characters.')
            return
        for i in sum([i.children for i in poll_msg.components], []):
            if not isinstance(i, discord.Button):
                continue
            lbl = self.get_response_name(i.label)
            if option == lbl.split('\u2000(')[0]:
                return
            components.append(discord.ui.Button(
                label=i.label, row=len(components) // 4))
        option = option.center(15, '\u2000')
        t = 45 + len(option)//2
        components.append(discord.ui.Button(
            label='{}\u3000{}'.format(
                option, (t - len(option)) * '\u3000'),
            row=len(components) // 4))
        x = self.info_menu(components)
        if x is not None:
            components.append(x)
        if poll_msg.embeds[0].footer.text:
            poll_msg.embeds[0].set_footer(text=discord.Embed.Empty)
            await poll_msg.edit(
                embed=poll_msg.embeds[0], components=components)
            return
        await poll_msg.edit(components=components)

    async def fix_poll(self, poll_msg, option):
        if poll_msg.embeds[0].author.name.split()[
                -1] != EmbedWrapper.NOT_DELETABLE:
            return
        # no more responses can be added or removed
        m = EmbedWrapper.FIXED + EmbedWrapper.NOT_DELETABLE
        poll_msg.embeds[0].set_author(
            name=poll_msg.embeds[0].author.name[:-len(m)] + m)
        await poll_msg.edit(embed=poll_msg.embeds[0])
        await poll_msg.channel.notify(
            content='Poll has been fixed, no responses ' +
            'can be added or removed.')

    async def change_question(self, poll_msg, option):
        if len(option) >= 60:
            await poll_msg.channel.warn(
                content='Can only add question shorter than 60 characters!')
            return
        marks = poll_msg.embeds[0].description.split()[-1]
        if marks in ('FND', 'AND'):
            return
        poll_msg.embeds[0].description = 'POLL - {}{}{}'.format(
            option, (62 - len(marks) - len(option)) * '\u2000', marks)
        await poll_msg.edit(embed=poll_msg.embeds[0])

    async def end_poll(self, poll_msg, option):
        components = []
        equals = []
        max_len = 0
        for i in sum([i.children for i in poll_msg.components], []):
            if not isinstance(i, discord.Button):
                components.append(
                    discord.ui.Select(
                        placeholder=i.placeholder,
                        options=i.options))
                continue
            components.append(discord.ui.Button(
                label=i.label,
                row=len(components) // 4))
            x = len(i.label.split('\u3000')[1].strip())
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
        m = EmbedWrapper.PARTLY_ENDED + EmbedWrapper.NOT_DELETABLE
        poll_msg.embeds[0].set_author(
            name=poll_msg.embeds[0].author.name[:-len(m)] + m)
        await poll_msg.edit(embed=poll_msg.embeds[0], components=components)
        await poll_msg.channel.notify(
            content='Poll has been ended.')

    async def remove_response(self, poll_msg, option):
        if poll_msg.embeds[0].description[-3:] in ['FND', 'AND']:
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
                content=('Responses can only be removed by indexes ' +
                         'from `{}` to `{}`').format(
                    0, len(c) - 1))
            return
        components = []
        count = 0
        name = None
        for i in sum([i.children for i in poll_msg.components], []):
            if not isinstance(i, discord.Button):
                continue
            if count != option:
                components.append(discord.ui.Button(
                    label=i.label,
                    row=len(components)//4))
            else:
                name = self.get_response_name(i.label)
            count += 1
        menu = self.info_menu(components)
        if menu is not None:
            components.append(menu)
        await poll_msg.edit(
            components=components)
        if name is not None:
            await poll_msg.channel.notify(
                content='Response `{}` has been removed.'.format(name))

    @decorators.OnButtonClick
    async def add_remove_response(self, button, msg, user, webhook):
        # when a user click on a response, determine whether he already voted
        # for this response (from database)
        # if he voted remove his vote, else add another vote
        if not msg.is_poll:
            return
        x = button.label.split('\u3000')
        add = await self.bot.database.use_database(
            self.add_or_remove, x[0].strip(), msg, user.id)
        components = []
        for idx, v in enumerate(
                sum([i.children for i in msg.components], [])):
            if not isinstance(v, discord.Button):
                continue
            if v.label != button.label:
                components.append(discord.ui.Button(
                    label=v.label,
                    row=len(components) // 4))
                continue
            y = x[1].strip()
            if add:
                if len(y) > 0:
                    y += y[-1]
                else:
                    y += self.tokens[(idx) % self.tokens_count]
            elif len(y) > 0:
                y = y[:-1]
            x = x[0]
            t = 45 + len(x) // 2
            ln = len(x + y)
            if ln >= t:
                t = ln + 1
            components.append(
                discord.ui.Button(
                    label='{}\u3000{}{}'.format(
                        x, y,
                        (t - len(x + y)) * '\u3000'),
                    row=len(components) // 4))
        if not isinstance(x, str):
            return
        i = self.info_menu(components)
        if i is not None:
            components.append(i)
        await msg.edit(components=components)
        if not add:
            await self.bot.database.use_database(
                self.delete_from_db, x.strip(), msg, user.id)
        else:
            await self.bot.database.use_database(
                self.insert_to_db, x.strip(), msg, user.id)

    @decorators.OnMenuSelect
    async def show_response_info(self, interaction, msg, user, webhook):
        if not msg.is_partial_poll:
            return
        # when selecting one of the responses in a dropdown,
        # see the number of votes and the users who voted
        if await self.bot.check_if_valid(self, msg, user, webhook) is False:
            return
        name = interaction.data['values'][0]
        users = await self.bot.database.use_database(
            self.users_who_voted, name, msg)
        if users is None or len(users) == 0:
            return
        embed = discord.Embed(
            title=name,
            color=random_color())
        y = None
        k = 0
        for i in users:
            user = msg.guild.get_member(int(i[3]))
            if user is None:
                continue
            x = user.name
            if user.nick:
                x = '{} ({})'.format(user.nick, user.name)
            x += ' #' + user.discriminator
            y = x if not y else y + '\n' + x
            k += 1
        embed.add_field(name="Votes count", value=k, inline=False)
        embed.add_field(name="Users", value=y, inline=False)
        await webhook.send(embed=embed, ephemeral=True)

    async def users_who_voted(self, cursor, rsp, msg):
        cursor.execute((
            "SELECT * FROM messages WHERE type = 'poll' AND " +
            "channel_id = \"{}\" AND message_id = \"{}\" AND info = \"{}\""
        ).format(
            msg.channel.id, msg.id, rsp))
        fetched = cursor.fetchall()
        return fetched

    async def add_or_remove(self, cursor, rsp, msg, user_id):
        cursor.execute((
            "SELECT * FROM messages WHERE " +
            "type = 'poll' AND channel_id = \"{}\" AND " +
            "message_id = \"{}\" AND user_id = \"{}\" AND info = \"{}\""
        ).format(
            msg.channel.id, msg.id, user_id, rsp))
        fetched = cursor.fetchone()
        if fetched is None:
            return True
        return False

    async def delete_from_db(self, cursor, rsp, msg, user_id):
        cursor.execute((
            "DELETE FROM messages WHERE " +
            "channel_id = \"{}\" AND " +
            "message_id = \"{}\" AND user_id = \"{}\" AND info = \"{}\""
        ).format(
            msg.channel.id, msg.id, user_id, rsp))

    async def insert_to_db(self, cursor, rsp, msg, user_id):
        cursor.execute((
            "INSERT INTO messages (type, channel_id, message_id, user_id, " +
            "info) VALUES ('poll', \"{}\", \"{}\", \"{}\", \"{}\")"
        ).format(
            msg.channel.id, msg.id, user_id, rsp))

    async def new_poll_to_database(self, cursor, msg):
        time = await self.bot.database.get_deletion_time(msg, self.name)
        cur_time = (datetime.now() + timedelta(hours=time + 0.5)
                    ).strftime('%d:%m:%H')
        cursor.execute(
            ("INSERT INTO messages " +
             "(type, channel_id, message_id, user_id, info, deletion_time) " +
             "VALUES ('{}', '{}', '{}', '{}', '{}', '{}')").format(
                'poll', msg.channel.id, msg.id, None, None, cur_time))
        await msg.delete(
            delay=time * 3600)

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

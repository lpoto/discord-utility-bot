import nextcord

import bot.decorators as decorators
import bot.utils as utils


class Poll:
    def __init__(self, client):
        self.client = client
        self.color = utils.colors['green']
        self.description = 'Create a poll for users to vote on.'
        self.tokens = ['⚪', '⚫']
        self.default_deletion_time = 720

    @decorators.MenuSelect
    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def start_command(self, msg, user, data, webhook):
        """
        Edit the main menu message to a main poll menu message
        when a user selects Poll in a dropdown.
        Check if user is allowed to start a poll before editing.
        """
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if (embed.get_type() not in {
            self.client.default_type, self.__class__.__name__}
                or 'values' in data and
                data['values'][0] != self.__class__.__name__):

            if self.valid_poll(msg, partial_ended=True):
                return await self.show_response_info(msg, user, data, webhook)
            return

        self.client.logger.debug(msg=f'Poll main menu: {str(msg.id)}')

        embed = utils.UtilityEmbed(
            type=self.__class__.__name__,
            version=self.client.version,
            title=self.description,
            description='',
            color=self.color)
        components = [
            nextcord.ui.Button(label='New poll'),
            utils.home_button(),
            utils.help_button(),
            utils.delete_button()]
        await msg.edit(embed=embed, view=utils.build_view(components))

    @decorators.ButtonClick
    async def determine_button_click_type(self, msg, user, button, webhook):
        if (
                button.label == 'New poll' and
                msg.embeds[0].title and
                msg.embeds[0].title == self.description
        ):
            await self.send_empty_poll_to_channel(
                msg, user, button, webhook
            )
        elif self.valid_poll(msg):
            await self.add_remove_response(
                msg, user, button, webhook
            )

    @decorators.CheckPermissions
    @decorators.ValidateAuthor
    async def send_empty_poll_to_channel(self, msg, user, button, webhook):
        """
        Send a new empty poll after it has been initialized in the main
        poll menu.
        """
        self.client.logger.debug(msg=f'New poll: {str(msg.id)}')

        # send a poll with only question added
        # to the channel and add info on adding responses
        embed = utils.UtilityEmbed(
            type=self.__class__.__name__,
            version=self.client.version,
            title='New poll',
            description=self.additional_info(self),
            color=utils.random_color())

        await msg.edit(embed=embed, view=None)

        deletion_time = await self.client.database.Config.get_option(
            name='Poll_deletion', guild_id=msg.guild.id)
        if len(deletion_time.get('info')) == 0:
            deletion_time = self.default_deletion_time * 3600
        else:
            deletion_time = int(deletion_time.get('info')[0]) * 3600
        deletion_timestamp = utils.delta_seconds_timestamp(deletion_time)

        await self.client.database.Messages.add_message_info(
            id=msg.id, name='deletion_time', info=deletion_timestamp)
        await self.client.database.Messages.update_message_author(
            id=msg.id, author_id=None)
        await msg.delete(delay=deletion_time)

    def info_menu(self, components):
        # build a dropdown menu that contains all the responses
        if components is None or len(components) < 1:
            return None
        options = []
        for i in components:
            options.append(
                nextcord.SelectOption(label=self.get_response_name(i.label)))
        return nextcord.ui.Select(
            placeholder='Responses info', options=options,
            row=4)

    def valid_poll(self, msg, fixed=False, partial_ended=False):
        return (isinstance(msg.channel, nextcord.TextChannel) and
                (msg.content != '`Ended`' or partial_ended) and
                (len(msg.embeds) == 1) and
                (msg.embeds[0].title not in {'Help', self.description}) and
                (not fixed or msg.content != '`Fixed`'))

    @decorators.Reply
    @decorators.CheckPermissions
    async def manage_poll_info(self, poll_msg, user, msg):
        """
        Add or remove responses to the poll,
        change the poll's question, fix the poll so no more responses
        may be added or removed, or end the poll completely.
        """
        if not self.valid_poll(poll_msg):
            return
        # many options may be added at once separated with ";"
        # process them one by one
        if not msg.content or len(msg.content) < 1:
            return

        self.client.logger.debug(msg=f'Changing poll info: {str(poll_msg.id)}')

        try:
            await self.add_poll_info(
                poll_msg.channel, poll_msg.id, msg.content.strip())
        except ValueError as err:
            # there can only be 5 rows of buttons and dropdowns
            if str(err) in [
                'could not find open space for item',
                    'item would not fit at row 4 (6 > 5 width)']:
                await utils.warn(
                    msg.channel,
                    text='Maximum number of responses reached!')
                return
            else:
                raise ValueError(err)

    async def add_poll_info(self, channel, poll_msg_id, option):
        """
        Add a new options(reply, question, fix, end) to the poll,
        multiple options may be added at once, separated with ;.
        """
        # if reply does not contain any of the keywords
        # add a response to the poll, else
        # do whatever it is supposed to do
        poll_msg = await channel.fetch_message(int(poll_msg_id))
        if (poll_msg is None or option is None or
                not self.valid_poll(poll_msg, fixed=option != 'end')):
            return
        opts = option.split(';')
        q = tuple(filter(lambda x: x.strip().startswith('question '), opts))
        f = tuple(filter(lambda x: x.strip() == 'fix', opts))
        e = tuple(filter(lambda x: x.strip() == 'end', opts))
        rm = tuple(filter(lambda x: x.strip().startswith('remove '), opts))
        r = tuple(filter(
            lambda x: (x not in q and x not in f and x not in rm and
                       x not in e and len(x) > 0), opts))
        if any(len(i) > 25 for i in r):
            await utils.warn(
                poll_msg.channel,
                text='Cannot add responses longer than 25 characters.')
            r = tuple(filter(lambda x: len(x) <= 25, r))
        if len(q) > 0:
            await self.change_question(poll_msg, q[0])
            poll_msg = await channel.fetch_message(int(poll_msg_id))
        if len(r) > 0:
            await self.add_responses(poll_msg, r)
            poll_msg = await channel.fetch_message(int(poll_msg_id))
        if len(rm) > 0:
            await self.remove_responses(poll_msg, rm)
            poll_msg = await channel.fetch_message(int(poll_msg_id))
        if len(f) > 0:
            await self.fix_poll(poll_msg)
            poll_msg = await channel.fetch_message(int(poll_msg_id))
        if len(e) > 0:
            await self.end_poll(poll_msg)

    def get_response_name(self, text) -> str:
        """
        Trim the whitespace, emojis and response count from the
        response's button label.
        """
        return text.split('\u3000')[1].strip()

    def format_response_name(self, name, count, token) -> str:
        """
        Add whitespace and a valid number of tokens to the response's
        button label, so all the responses align.
        """
        name = '({})\u3000{}\u3000'.format(
            count, '{:\u2000<25}'.format(name.center(15, '\u2000')))
        if count > 80 - len(name):
            name += (79 - len(name)) * token + '…'
        else:
            name += count * token
        return '{}{}'.format(name, (80 - len(name)) * '\u3000')

    async def add_responses(self, poll_msg, options):
        components = [nextcord.ui.Button(
            label=i.label,
            custom_id=i.custom_id,
        ) for i in sum(
            [i.children for i in poll_msg.components], [])
            if isinstance(i, nextcord.Button)]
        for option in options:
            option = option.replace('"', "'").strip()
            option = ' '.join(option.split())
            if option == 'New poll':
                await utils.warn(
                    poll_msg.channel,
                    text='Invalid response')
                return
            if any(option == self.get_response_name(i.label)
                    for i in components):
                break
            components.append(nextcord.ui.Button(
                label=self.format_response_name(option, 0, self.tokens[0]),
                row=len(components) // 4))
        if poll_msg.embeds[0].description:
            poll_msg.embeds[0].description = nextcord.Embed.Empty
            await poll_msg.edit(
                embed=poll_msg.embeds[0], view=utils.build_view(components))
            return
        await poll_msg.edit(view=utils.build_view(components))

    async def fix_poll(self, poll_msg):
        # no more responses can be added or removed
        await poll_msg.edit(content='`Fixed`')
        await utils.notify(
            poll_msg.channel,
            text='No more responses can be added or removed.')

    async def change_question(self, poll_msg, option):
        option = option.replace('question ', '', 1)
        if len(option) >= 60:
            await utils.warn(
                poll_msg.channel,
                text='Can only add question shorter than 60 characters!')
            return
        if option == self.description:
            await utils.warn(
                poll_msg.channel,
                text='Invalid question')
            return
        poll_msg.embeds[0].title = option
        await poll_msg.edit(embed=poll_msg.embeds[0])

    async def end_poll(self, poll_msg):
        components = []
        equals = []
        max_len = 0
        for i in sum([i.children for i in poll_msg.components], []):
            if not isinstance(i, nextcord.Button):
                components.append(
                    nextcord.ui.Select(
                        placeholder=i.placeholder,
                        options=i.options,
                        custom_id=i.custom_id))
                continue
            components.append(nextcord.ui.Button(
                label=i.label,
                custom_id=i.custom_id,
                row=len(components) // 4))
            x = int(i.label.split('\u3000')[0][1:][:-1])
            if x == max_len and max_len > 0:
                equals.append(len(components) - 1)
            elif x > max_len:
                equals.clear()
                equals.append(len(components) - 1)
                max_len = x
        if len(equals) == 1:
            components[equals[0]].style = nextcord.ButtonStyle.blurple
        elif len(equals) > 1:
            for i in equals:
                components[i].style = nextcord.ButtonStyle.blurple
        await poll_msg.edit(
            content='`Ended`',
            view=utils.build_view(components))
        await utils.notify(
            poll_msg.channel,
            text='Poll has been ended.')

    async def remove_responses(self, poll_msg, options):
        cmps = list(
            filter(lambda x: isinstance(x, nextcord.Button),
                   sum([i.children for i in poll_msg.components], [])))
        c = len(cmps)
        try:

            options = tuple(int(i.split()[1]) for i in options)
            if any(o >= c or o < 0 for o in options):
                raise ValueError
        except ValueError:
            if len(poll_msg.components) == 0:
                await utils.warn(
                    poll_msg.channel,
                    'There are no responses in the poll!')
                return
            await utils.warn(
                poll_msg.channel,
                text=('Responses can only be removed by indexes ' +
                      'from `{}` to `{}`').format(
                    0, c - 1))
            return
        components = list(nextcord.ui.Button(
            label=i.label,
            custom_id=i.custom_id
        ) for i in cmps)
        remaining_components = list(
            components[i] for i in range(
                len(components)) if i not in options)
        removed = list(self.get_response_name(i.label) for i in components
                       if i not in remaining_components)
        menu = self.info_menu(remaining_components)
        if menu is not None:
            remaining_components.append(menu)
        await poll_msg.edit(
            view=utils.build_view(remaining_components))
        if len(removed) > 0:
            await utils.notify(
                poll_msg.channel,
                text='Removed: `{}`'.format(', '.join(removed)))

    async def add_remove_response(self, msg, user, button, webhook):
        # when a user click on a response, determine whether he already voted
        # for this response (from database)
        # if he voted remove his vote, else add another vote
        msg = await msg.channel.fetch_message(msg.id)
        name = self.get_response_name(button.label)
        msg_info = await self.client.database.Messages.get_message_info(
            msg.id, name=name)
        add = all(i.get('user_id') != user.id for i in msg_info)

        self.client.logger.debug(
            msg='Adding vote on poll {} for user {}: {}'.format(
                msg.id, user.id, add))

        responses_count = len(msg_info) + (1 if add else -1)
        components = []
        for idx, v in enumerate(
                sum([i.children for i in msg.components], [])):
            if not isinstance(v, nextcord.Button):
                continue
            if v.label != button.label:
                components.append(nextcord.ui.Button(
                    label=v.label,
                    custom_id=v.custom_id,
                    row=len(components) // 4))
                continue
            components.append(
                nextcord.ui.Button(
                    label=self.format_response_name(
                        name, responses_count,
                        self.tokens[(idx) % len(self.tokens)]),
                    custom_id=v.custom_id,
                    row=len(components) // 4))
        i = self.info_menu(components)
        if i is not None:
            components.append(i)
        await msg.edit(view=utils.build_view(components))
        if not add:
            await self.client.database.Messages.delete_message_info(
                msg.id, name=name, user_id=user.id)
        else:
            await self.client.database.Messages.add_message_info(
                msg.id, name=name, user_id=user.id)

    async def show_response_info(self, msg, user, data, webhook):
        # when selecting one of the responses in a dropdown,
        # see the number of votes and the users who voted
        name = data['values'][0]
        users = await self.client.database.Messages.get_message_info(
            msg.id, name=name)
        if users is None or len(users) == 0:
            return

        self.client.logger.debug(
            msg=f'Sending response info for poll {str(msg.id)}')

        embed = nextcord.Embed(
            title=name,
            color=utils.random_color())
        y = None
        k = 0
        for i in users:
            user = msg.guild.get_member(i.get('user_id'))
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

    @decorators.Help
    def additional_info(self):
        return '\n'.join((
            'Reply `question <new_question>` to change the question.',
            'Reply `<response>` to add a response.',
            'Reply `remove <idx>` to remove a response by index.',
            'Reply `fix` to disable further adding or removing responses.',
            'Reply `end` to close the poll.',
            ('Multiple options can be added at once, separated ' +
             'with `;` \n(example: `response1; remove 0; response2`)')))

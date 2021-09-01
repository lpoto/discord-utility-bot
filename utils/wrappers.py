import discord
from numpy import base_repr


class MessageWrapper(discord.Message):
    """
    Wrapper for discord.Message that avoids permission errors,
    adds additional functionality to editing, reacting, deleting and
    removing reactions from messages and adds properties that check
    for specific message types based on EmbedWrapper embed types.
    """

    def __init__(self, obj):
        self._wrapped_msg = obj
        if not isinstance(self.channel, ChannelWrapper):
            self.channel = ChannelWrapper(
                self._wrapped_msg.channel)
        if (str(self.channel.type) == 'text' and
                not isinstance(self.author, MemberWrapper)):
            self.author = MemberWrapper(self.author)
        for i in range(len(self.embeds)):
            if not isinstance(self.embeds[i], EmbedWrapper):
                self.embeds[i] = EmbedWrapper(self.embeds[i])

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_msg, attr)

    async def edit(
            self,
            text=None,
            embed=None,
            delete_after=None,
            reactions=None,
    ):
        await self._wrapped_msg.edit(
            content=text, embed=embed, delete_after=delete_after)
        for i in range(len(self._wrapped_msg.embeds)):
            if not isinstance(self._wrapped_msg.embeds[i], EmbedWrapper):
                self._wrapped_msg.embeds[i] = EmbedWrapper(
                    self._wrapped_msg.embeds[i])
        if reactions is not None:
            if not isinstance(reactions, list) and not isinstance(
                    reactions, tuple):
                reactions = [reactions]
            for i in reactions:
                await self.react(emoji=i)
        return self

    async def react(
            self,
            emoji):
        if (str(self.channel.type) == 'text' and
            not self.channel.permissions(
                self.guild.me,
                'add_reactions')):
            return
        await self._wrapped_msg.add_reaction(emoji)
        return True

    async def delete(self, delay=None):
        if (self.author.id != self.guild.me.id and
            not self.channel.permissions(
                self.guild.me,
                'send_messages')):
            return
        await self._wrapped_msg.delete(delay=delay)
        del self
        return True

    async def remove_reaction(self, emoji, member=None):
        if member is None:
            if (self.channel.permissions(
                    self.guild.me,
                    'manage_messages')):
                await self.clear_reaction(emoji)
            else:
                await self._wrapped_msg.remove_reaction(emoji, self.guild.me)
            return
        if (self.guild.me.id != member.id and
                not self.channel.permissions(
                    self.guild.me, 'manage_messages')):
            return
        await self._wrapped_msg.remove_reaction(emoji, member)

    # check the type of message based on its embed
    def type_check(self, name, bad_marks=[], good_marks=[]):
        if not isinstance(bad_marks, list) and not isinstance(
                bad_marks, tuple):
            bad_marks = [bad_marks]
        if not isinstance(good_marks, list) and not isinstance(
                good_marks, tuple):
            good_marks = [good_marks]
        if len(self.embeds) != 1:
            return False
        if not isinstance(self.embeds[0], EmbedWrapper):
            self.embeds[0] = EmbedWrapper(self.embeds[0])
        mks = self.embeds[0].get_marks()
        if any(i in mks for i in bad_marks):
            return False
        if any(i not in mks for i in good_marks):
            return False
        if name is None or self.embeds[0].embed_type == name:
            return True
        return False

    @property
    def is_poll(self):
        return self.type_check('POLL', EmbedWrapper.ENDED)

    @property
    def is_roles(self):
        return self.type_check('ROLES')

    @property
    def is_connect_four(self):
        return self.type_check('CONNECT_FOUR', EmbedWrapper.ENDED)

    @property
    def is_hangman(self):
        return self.type_check('HANGMAN', EmbedWrapper.ENDED)

    @property
    def is_event(self):
        return self.type_check('EVENT', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_help(self):
        return self.type_check('HELP', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_server(self):
        return self.type_check('SERVER', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_config(self):
        return self.type_check('CONFIG', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_fixed(self):
        return self.type_check(None, EmbedWrapper.ENDED, EmbedWrapper.FIXED)

    @property
    def is_info(self):
        return self.type_check(None, EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_rps(self):
        return self.type_check('ROCK_PAPER_SCISSORS', [
            EmbedWrapper.ENDED, EmbedWrapper.INFO])

    @property
    def is_games(self):
        return self.type_check('GAMES', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_deletable(self):
        if self.pinned:
            return False
        if len(self.embeds) != 1:
            return True
        return self.type_check(None, EmbedWrapper.NOT_DELETABLE)


class ChannelWrapper(object):
    """
    Wrapper for discord.Channel that avoids permission errors
    and allows adding reactions when sending a message.
    """

    def __init__(self, chnl):
        self._wrapped_chnl = chnl

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_chnl, attr)

    async def send(
            self,
            text=None,
            embed=None,
            delete_after=None,
            reactions=None,
            file=None):
        if (str(self.type) == 'text' and
            not self.permissions(
                self.guild.me, 'send_messages')[0]):
            return
        msg = MessageWrapper(
            await self._wrapped_chnl.send(
                content=text,
                embed=embed,
                delete_after=delete_after,
                file=file))
        if reactions is not None:
            if not isinstance(reactions, list) and not isinstance(
                    reactions, tuple):
                reactions = [reactions]
            for i in reactions:
                await msg.react(i)
        return msg

    async def fetch_message(self, msg_id):
        return MessageWrapper(
            await self._wrapped_chnl.fetch_message(
                int(msg_id)))

    def permissions(self, member, perms):
        if not isinstance(perms, list) and not isinstance(perms, tuple):
            perms = [perms]
        for i in perms:
            if not dict(iter(self.permissions_for(member)))[i]:
                return (False, i)
        return (True, None)


class MemberWrapper(object):
    """
    Wrapper for discord.User that returns wrapped objects
    when fetching channels and messages.
    """

    def __init__(self, member):
        self._wrapped_member = member

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        if hasattr(self._wrapped_member, attr):
            return getattr(self._wrapped_member, attr)

    async def create_dm(self):
        return ChannelWrapper(
            await self._wrapped_member.create_dm())

    async def fetch_message(self, id):
        return MessageWrapper(
            await self._wrapped_member.fetch_message(id))


class EmbedWrapper(discord.Embed):
    """wrapper that adds types and marks to the discord.Embed"""
    FIXED = 'F'
    ENDED = 'E'
    NOT_DELETABLE = 'ND'
    INFO = 'I'

    def __init__(self, embed, embed_type=None, marks=()):
        self._wrapped_embed = embed
        self.embed_type = self.get_type(embed_type)
        self.marks = [
            EmbedWrapper.FIXED,
            EmbedWrapper.ENDED,
            EmbedWrapper.INFO,
            EmbedWrapper.NOT_DELETABLE]
        self.mark(marks=marks)

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_embed, attr)

    def get_type(self, embed_type):
        if self.author.name:
            embed_type = self.author.name
        elif embed_type is None:
            return
        self.set_author(name=embed_type)
        return embed_type

    def mark(self, marks=[]):
        if not isinstance(marks, list) and not isinstance(marks, tuple):
            marks = [marks]
        if self.embed_type is None:
            return
        if any(i not in self.marks for i in marks):
            raise Exception('Invalid embed marks!')
            return
        if len(marks) == 0:
            return self
        text = '' if not self.footer.text else self.footer.text
        mks = ''.join(marks)
        if not self.footer.text:
            self.set_footer(text='@ @{}'.format(mks))
            return self
        x = text.split('@')[1:]
        self.set_footer(text='@{} @{}'.format(
            x[0][:-1], mks))
        return self

    def get_marks(self):
        if (not self.footer.text or '@' not in self.footer.text
                or self.footer.text.count('@') == 1):
            return []
        x = self.footer.text.split('@')[-1].strip()
        if len(x) > 5:
            return []
        mks = []
        for i in self.marks:
            if i in x:
                mks.append(i)
        return mks

    def set_id(
            self,
            user_id=None,
            user2_id=None,
            channel_id=None,
            message_id=None,
            extra=None):
        content = {'u': user_id, 'v': user2_id,
                   'c': channel_id, 'm': message_id,
                   'e': extra}
        txt = ''
        for k, v in content.items():
            if v is not None:
                if txt != '':
                    txt += '.'
                if k != 'e':
                    txt += '{}{}'.format(k, base_repr(int(v), 32).lower())
                else:
                    txt += '{}{}'.format(k, v)
        if not self.footer.text:
            self.set_footer(text=txt)
        else:
            if '@' not in self.footer.text or self.footer.text.count('@') == 1:
                self.set_footer(text='@' + txt)
            else:
                x = self.footer.text.split('@')[-1]
                self.set_footer(
                    text='@{} @{}'.format(
                        txt, x))

    def get_id(self) -> dict:
        content = {'user_id': None, 'user2_id': None,
                   'channel_id': None, 'message_id': None, 'extra': None}
        text = self._wrapped_embed.footer.text.split('@')[1][:-1].strip()
        if text is None:
            return content
        text = text.split('.')
        for i in text:
            if len(i) > 1 and i[0] == 'u':
                content['user_id'] = int(i[1:], 32)
            elif len(i) > 1 and i[0] == 'v':
                content['user2_id'] = int(i[1:], 32)
            elif len(i) > 1 and i[0] == 'c':
                content['channel_id'] = int(i[1:], 32)
            elif len(i) > 1 and i[0] == 'm':
                content['message_id'] = int(i[1:], 32)
            elif len(i) > 1 and i[0] == 'e':
                content['extra'] = i[1:]
        return content

    @classmethod
    def mark_info(cls, mark):
        mi = {
            cls.INFO: 'Informational',
            cls.ENDED: 'Ended, bot does not respond to the message.',
            cls.FIXED: 'Fixed, only listening for reactions.',
            cls.NOT_DELETABLE: ('Cannot delete with waste basket ' +
                                'or clear command.')}
        if mark in mi:
            return mi[mark]

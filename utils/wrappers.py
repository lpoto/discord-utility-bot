import discord
from utils.misc import red_color, green_color


class MessageWrapper(discord.Message):
    """
    Wrapper for discord.Message that avoids permission errors,
    adds additional functionality to editing and deleting
    messages and adds properties that check
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
            text=False,
            embed=False,
            delete_after=None,
            view=None,
            components=None
    ):
        if view is not None or components is not None:
            view = build_view(components, view)
            if text is False and embed is not False:
                await self._wrapped_msg.edit(
                    embed=embed, delete_after=delete_after,
                    view=view)
            elif embed is False and text is not False:
                await self._wrapped_msg.edit(
                    content=text, delete_after=delete_after,
                    view=view)
            elif embed is False and text is False:
                await self._wrapped_msg.edit(
                    delete_after=delete_after,
                    view=view)
            else:
                await self._wrapped_msg.edit(
                    content=text, embed=embed, delete_after=delete_after,
                    view=view)
        else:
            if text is False and embed is not False:
                await self._wrapped_msg.edit(
                    embed=embed, delete_after=delete_after)
            elif embed is False and text is not False:
                await self._wrapped_msg.edit(
                    content=text, delete_after=delete_after)
            elif embed is False and text is False:
                await self._wrapped_msg.edit(
                    delete_after=delete_after)
            else:
                await self._wrapped_msg.edit(
                    content=text, embed=embed, delete_after=delete_after)
        for i in range(len(self._wrapped_msg.embeds)):
            if not isinstance(self._wrapped_msg.embeds[i], EmbedWrapper):
                self._wrapped_msg.embeds[i] = EmbedWrapper(
                    self._wrapped_msg.embeds[i])
        return self

    async def delete(self, delay=None):
        if (str(self.channel.type) not in ['text', 'public_thread'] or
                self.author.id != self.guild.me.id and
            not self.channel.permissions(
                self.guild.me,
                'manage_messages')):
            return False
        await self._wrapped_msg.delete(delay=delay)
        return True

    # check the type of message based on its embed
    def type_check(self, name, bad_marks=None, good_marks=None):
        if len(self.embeds) != 1:
            return False
        if not isinstance(self.embeds[0], EmbedWrapper):
            self.embeds[0] = EmbedWrapper(self.embeds[0])
        mks = self.embeds[0].get_marks()
        if name is not None and self.embeds[0].embed_type != name:
            return False
        if bad_marks is not None:
            if not isinstance(bad_marks, list) and not isinstance(
                    bad_marks, tuple):
                bad_marks = [bad_marks]
            if any(i in mks for i in bad_marks):
                return False
        if good_marks is not None:
            if not isinstance(good_marks, list) and not isinstance(
                    good_marks, tuple):
                good_marks = [good_marks]
            if any(i not in mks for i in good_marks):
                return False
        return True

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
    def is_ended(self):
        return self.type_check(None, good_marks=EmbedWrapper.ENDED)

    @property
    def is_info(self):
        return self.type_check(None, EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_rps(self):
        return self.type_check('ROCK_PAPER_SCISSORS', EmbedWrapper.ENDED)

    @property
    def is_games(self):
        return self.type_check('GAMES', EmbedWrapper.ENDED, EmbedWrapper.INFO)

    @property
    def is_deletable(self):
        if len(self._wrapped_msg.embeds) != 1:
            return True
        if self.pinned:
            return False
        if (self.embeds[0].description is not discord.Embed.Empty and
                'ND' in self.embeds[0].description.split()[-1]):
            return False
        return self.type_check(None, EmbedWrapper.NOT_DELETABLE)


class ChannelWrapper(object):
    """
    Wrapper for discord.Channel that avoids permission errors
    and builds a view from list of components.
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
            file=None,
            view=None,
            components=None):
        if (str(self.type) == 'text' and
            not self.permissions(
                self.guild.me, 'send_messages')[0]):
            return
        if components is not None:
            view = build_view(components, view)
        msg = MessageWrapper(
            await self._wrapped_chnl.send(
                content=text,
                embed=embed,
                delete_after=delete_after,
                file=file,
                view=view))
        return msg

    async def warn(self, text, webhook=None, delete_after=None):
        if webhook:
            await webhook.send(text, ephemeral=True)
            return
        embed = discord.Embed(
            color=red_color,
            description=text)
        d = delete_after
        if str(self.type) == 'text' and delete_after is None:
            d = 5
        await self.send(embed=embed, delete_after=d)

    async def notify(self, text, delete_after=None):
        embed = discord.Embed(
            color=green_color,
            description=text)
        d = delete_after
        if str(self.type) == 'text' and delete_after is None:
            d = 5
        elif delete_after is False or delete_after == -1:
            d = None
        await self.send(embed=embed, delete_after=d)

    async def fetch_message(self, msg_id):
        return MessageWrapper(
            await self._wrapped_chnl.fetch_message(
                int(msg_id)))

    def permissions(self, member, perms) -> (bool, str or None):
        if not isinstance(perms, list) and not isinstance(perms, tuple):
            perms = [perms]
        for i in perms:
            if not dict(iter(self.permissions_for(member)))[i]:
                return (False, i)
        return (True, None)

    async def delete(self):
        if str(self.type) in ['public_thread', 'private_thread']:
            if not self.permissions(self.guild.me, 'manage_threads')[0]:
                return
        elif str(self.type) == 'text':
            if not self.permissions(self.guild.me, 'manage_channels')[0]:
                return
        await self._wrapped_chnl.delete()


def build_view(components, view=None):
    if not isinstance(components, list) and not isinstance(
            components, tuple):
        components = [components]
    if view is None:
        view = discord.ui.View(timeout=None)
    for i in components:
        view.add_item(i)
    return view


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
    PARTLY_ENDED = 'A'

    def __init__(
            self,
            embed,
            embed_type=None,
            marks=None,
            info=None):
        self._wrapped_embed = embed
        self.embed_type = self.get_type(embed_type)
        self.marks = [
            EmbedWrapper.FIXED,
            EmbedWrapper.ENDED,
            EmbedWrapper.PARTLY_ENDED,
            EmbedWrapper.INFO,
            EmbedWrapper.NOT_DELETABLE]
        if marks is not None:
            self.mark(marks=marks)
        if info is not None:
            self.set_info(info, marks)

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

    def mark(self, marks):
        if not isinstance(marks, list) and not isinstance(marks, tuple):
            marks = [marks]
        if self.embed_type is None:
            return
        if any(i not in self.marks for i in marks):
            raise Exception('Invalid embed marks!')
            return
        if len(marks) == 0:
            return self
        text = self.get_info()
        mks = ''.join(marks)
        if not text:
            self._wrapped_embed.set_footer(text='@{}'.format(mks))
            return
        self.set_info(text, marks)
        return self

    def get_marks(self):
        if (not self.footer.text or '@' not in self.footer.text):
            return []
        x = self.footer.text.split('@')[-1].strip()
        if len(x) > 5:
            return []
        mks = []
        for i in self.marks:
            if i in x:
                mks.append(i)
        return mks

    def set_info(
            self,
            text=None,
            marks=None):
        if marks is None:
            marks = self.get_marks()
        if text is None:
            self._wrapped_embed.set_footer(
                text='@' + ''.join(marks))
        else:
            self._wrapped_embed.set_footer(
                text=text + '\n@' + ''.join(marks))

    def get_info(self) -> str or None:
        if (self._wrapped_embed.footer.text is discord.Embed.Empty or
                '@' not in self._wrapped_embed.footer.text):
            return
        text = self._wrapped_embed.footer.text.split('@')
        if len(text) < 2:
            return
        text = text[0][::-1].replace(('@' + text[-1])[::-1], '', 1)[::-1]
        if len(text) > 0 and text[-1] == '\n':
            text = text[:-1]
        return text

    @classmethod
    def mark_info(cls, mark):
        mi = {
            cls.INFO: 'Informational',
            cls.FIXED: 'Fixed, only listening for interactions.',
            cls.ENDED: 'Ended, bot does not respond to the message.',
            cls.PARTLY_ENDED: 'Ended, but some interactions still work.',
            cls.NOT_DELETABLE: ('Cannot delete with a delete button ' +
                                'or clear command.')}
        if mark in mi:
            return mi[mark]

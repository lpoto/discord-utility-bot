import nextcord


class UtilityEmbed():
    def __init__(
        self, version, embed=None, type=None,
            title=None, description=None, color=None,
            author=None
    ):
        self.version = version
        self.type = type
        if author is not None:
            self.author = author
        if embed is not None:
            self._wrapped_embed = embed
        else:
            self._wrapped_embed = nextcord.Embed(description='')
        if description is not None:
            self._wrapped_embed.description = description
        elif not self._wrapped_embed.description:
            self._wrapped_embed.description = ''
        if color is not None:
            self._wrapped_embed.color = color
        if title is not None:
            self._wrapped_embed.title = title
        v_t_info = self.get_type()
        if not v_t_info:
            self.set_type_and_version(type, version)

        # TODO wrap lines that are too long

    def __setattr__(self, name, value):
        if '_wrapped_embed' not in self.__dict__:
            self.__set_wrapper_attr__(name, value)
        else:
            setattr(self._wrapped_embed, name, value)

    def __set_wrapper_attr__(self, name, value):
        self.__dict__[name] = value

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_embed, attr)

    def remove_author(self):
        if (
                not self._wrapped_embed.description or
                '@author' not in self._wrapped_embed.description
        ):
            return
        self._wrapped_embed.description = (
            self._wrapped_embed.description.split('@author')[0].strip('\n\n')
        )

    def set_author(self, author):
        self.__set_wrapper_attr__('author', author)
        if not self.type:
            self.__set_wrapper_attr__('type', self.get_type())
        self.set_type_and_version(self.type, self.version)

    def get_type(self) -> str or None:
        """
        Return embed's type from it's footer
        """
        if (
                not self._wrapped_embed.footer or
                not self._wrapped_embed.footer.text or
                '@type' not in self._wrapped_embed.footer.text
        ):
            return
        txt = self._wrapped_embed.footer.text.split('\n')[0].replace(
            '@type', '', 1
        ).strip().split('\u2000\u2000')[0].strip()
        return txt

    def set_type(self, type: str):
        return self.set_type_and_version(type, self.version)

    def expand_text(self, text, version):
        spacer = '\u2000\u2000'
        if len(text) <= 57:
            spacer = (59 - len(text) - len(version)) * '\u2000'
        for i in range(1, len(text) // 10 + 1):
            spacer += i * ' \u2000'
        for i in range(1, len(version) // 10 + 1):
            spacer += i * ' \u2000'
        return text + spacer + version

    def set_type_and_version(self, type: str, version: str) -> None:
        """
        Set type and version in the embed's footer text
        """
        self.__set_wrapper_attr__('version', version)
        self.__set_wrapper_attr__('type', type)
        t = '@type\u2000\u2000\u2000\u2000'
        if not version:
            version = 'dev'
        if type is not None:
            t += type
        if self.author:
            t += '\n' + self.expand_text(
                '@author \u2000\u2000{}'.format(
                    self.author.name
                    if not self.author.nick
                    else self.author.nick
                ),
                version
            )
        else:
            t = self.expand_text(t, version)
        self._wrapped_embed.set_footer(text=t)

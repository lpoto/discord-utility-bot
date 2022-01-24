import nextcord


class UtilityEmbed():
    def __init__(self, version=None, embed=None, type=None,
                 title=None, description=None, color=None):
        if embed is not None:
            self._wrapped_embed = embed
        else:
            self._wrapped_embed = nextcord.Embed(description='')
        if color is not None:
            self._wrapped_embed.color = color
        if description is not None:
            self._wrapped_embed.description = description
        if title is not None:
            self._wrapped_embed.title = title
        v_t_info = self.get_type()
        if not v_t_info:
            self.set_type_and_version(type, version)

        # TODO wrap lines that are too long

    def __setattr__(self, name, value):
        if '_wrapped_embed' not in self.__dict__:
            self.__dict__[name] = value
        else:
            setattr(self._wrapped_embed, name, value)

    def __getattr__(self, attr):
        if attr in self.__dict__:
            return getattr(self, attr)
        return getattr(self._wrapped_embed, attr)

    def get_type(self) -> str or None:
        """Return embed's type from it's footer"""
        if (not self._wrapped_embed.footer or
                not self._wrapped_embed.footer.text or
                self._wrapped_embed.footer.text[0] != '@'):
            return
        version = self._wrapped_embed.footer.text.split()[-1]
        if not version:
            return
        return self._wrapped_embed.footer.text[:-len(version)].strip()[1:]

    def set_type_and_version(self, type: str, version: str) -> None:
        """Set type and version in the embed's footer text"""
        t = '@'
        if not version:
            version = 'dev'
        if type is not None:
            t += type
        spacer = (61 - len(t) - len(version)) * '\u2000'
        for i in range(1, len(t) // 10 + 1):
            spacer += i * ' \u2000'
        for i in range(1, len(version) // 10 + 1):
            spacer += i * ' \u2000'
        self._wrapped_embed.set_footer(text=t + spacer + version)

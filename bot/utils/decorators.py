class ExecuteCommand(object):
    """
    Commands' instance methods, called when a message in
    a discord channel starts with a prefix and the name
    of the Command.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject, c=None):
        def g():
            for name in dir(subject):
                method = getattr(subject, name)
                if isinstance(method, ExecuteCommand if c is None else c):
                    yield name, method
        return {name: method for name, method in g()}


class ExecuteWithInteraction(object):
    """
    Commands' instance methods, called when a
    clicked button's label or a selected dropdown
    option matches the command's name.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        return ExecuteCommand.methods(subject, ExecuteWithInteraction)


class OnButtonClick(object):
    """
    Commands' instance methods, called when a
    button on an active bot's message is clicked.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        return ExecuteCommand.methods(subject, OnButtonClick)


class OnMenuSelect(object):
    """
    Commands' instance methods, called when a
    dropdown menu option on an active bot's message
    is selected.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        return ExecuteCommand.methods(subject, OnMenuSelect)


class OnReply(object):
    """
    Commands' instance methods, called when a
    bot's active message receives a reply in a discord text channel.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        return ExecuteCommand.methods(subject, OnReply)


class OnDmReply(object):
    """
    Commands' instance methods, called when a
    bot's active message receives a reply in a private discord channel.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        return ExecuteCommand.methods(subject, OnDmReply)


class OnThreadMessage(object):
    """
    Commands' instance methods, called when a
    message is sent in a public thread started by the bot.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        return ExecuteCommand.methods(subject, OnThreadMessage)


class CleanUp(object):
    """
    Commands' instance methods, called when a
    SystemExit occurs.
    """

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        return ExecuteCommand.methods(subject, CleanUp)

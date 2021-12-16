class ButtonClick(object):

    def __init__(self, method):
        self._method = method

    def __call__(self, obj, *args, **kwargs):
        return self._method(obj, *args, **kwargs)

    @classmethod
    def methods(cls, subject):
        def g():
            for name in dir(subject):
                method = getattr(subject, name)
                if isinstance(method, ButtonClick):
                    yield name, method
        return {name: method for name, method in g()}

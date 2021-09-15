from commands.help import Help
from utils.decorators import ExecuteCommand
from utils.wrappers import MessageWrapper


class ClearChat(Help):
    def __init__(self):
        super().__init__(name='clear')
        self.synonyms = ['delete', 'clean', 'purge']
        self.description = 'Bulk delete 1-50 messages in a text channel.'
        self.bot_permissions = ['send_messages', 'manage_messages']
        self.user_permissions = ['manage_messages']

    @ExecuteCommand
    async def purge_messages_in_channel(self, msg):
        args = msg.content.split()
        # only 1 - 50 messages can be deleted at once
        # messages older than 14 days cannot be bulk deleted, so they
        # will be deleted normaly one after another (much slower)
        # deleting more than 50 messages older than 14 days
        # would take a while and cause problems
        if len(args) < 2:
            await msg.channel.warn(
                content='How many messages do you want to delete?')
            return
        count = 0
        try:
            count = int(args[1])
        except Exception:
            await msg.channel.warn(
                content='Argument must be a number between 0 and 50!')
            return
        else:
            count = int(args[1])
        if count > 50:
            await msg.channel.warn(
                content='You cannot delete more than 50 messages at once!')
            return
        if count <= 0:
            await msg.channel.warn(
                content='You must delete at least 1 message!')
            return
        # purge the messages and send how many were actually deleted
        purged = len(await msg.channel.purge(
            limit=count + 1,
            check=self.purge_filter)) - 1
        if purged < 1:
            await msg.channel.warn(
                content='Could not delete any messages.')
        else:
            await msg.channel.notify(
                content='Deleted {count} messages.'.format(count=purged))

    def purge_filter(self, msg):
        # don't delete pinned messages and
        # messages marked with NOT DELETABLE
        if not isinstance(msg, MessageWrapper):
            msg = MessageWrapper(msg)
        if not hasattr(msg, 'is_deletable'):
            return False
        return msg.is_deletable

    def additional_info(self, prefix):
        return '* {}\n* {}'.format(
            'Messages with "ND" embed mark in the top right corner ' +
            'and pinned messages will not be deleted.',
            'deleting messages older than 14 days takes longer.')

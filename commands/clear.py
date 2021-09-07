from commands.help import Help
from utils.wrappers import MessageWrapper


class ClearChat(Help):
    def __init__(self):
        super().__init__(name='clear')
        self.synonyms = ['delete', 'clean', 'purge']
        self.description = 'Clear from 1 to 50 messages in chat.'
        self.bot_permissions = ['send_messages', 'manage_messages']
        self.user_permissions = ['send_messages', 'manage_messages']

    async def execute_command(self, msg):
        args = msg.content.split()
        # don't allow purging in role-managing channel
        if len(args) < 2:
            await msg.channel.warn(
                text='How many messages do you want to delete?')
            return
        count = 0
        try:
            count = int(args[1])
        except Exception:
            await msg.channel.warn(
                text='Argument must be a number between 0 and 50!')
            return
        else:
            count = int(args[1])
        # allow deleting only between 1 and 50 messages
        # ... if messages are older than 14 days bot will have to delete
        # messages one by one, so deleting large amounts of messages might
        # take a while and cause problems
        if count > 50:
            await msg.channel.warn(
                text='You cannot delete more than 50 messages at once!')
            return
        if count <= 0:
            await msg.channel.warn(
                text='You must delete at least 1 message!')
            return
        # purge the messages and send how many were actually deleted
        purged = len(await msg.channel.purge(
            limit=count + 1,
            check=self.purge_filter)) - 1
        if purged < 1:
            await msg.channel.warn(
                text='Could not delete any messages.')
        else:
            await msg.channel.notify(
                text='Deleted {count} messages.'.format(count=purged))

    def purge_filter(self, msg):
        # don't delete pinned messages and polls
        return (MessageWrapper(msg).is_deletable)

    def additional_info(self, prefix):
        return '* {}\n* {}'.format(
            'Messages with "ND" embed mark in the top right corner ' +
            'and pinned messages will not be deleted.',
            'deleting messages older than 14 days takes longer.')

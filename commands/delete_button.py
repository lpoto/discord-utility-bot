import discord
from commands.help import Help
from utils.misc import green_color
from utils.decorators import ExecuteWithInteraction
from utils.wrappers import EmbedWrapper


class DeleteButton(Help):
    def __init__(self):
        super().__init__(name='delete')
        self.description = (
            'Delete a bot\'s message with a button click.')
        self.bot_permissions = None
        self.user_permissions = ['manage_messages']
        self.executable = False

    @ExecuteWithInteraction
    async def delete_message(self, msg, user=None, webhook=None):
        # when a delete button is pressed, if the message is
        # deletable, edit it to a "msg was deleted" notification
        # and delete it after 2 seconds
        if (str(msg.channel.type) != 'text' or
                not webhook or not user or
                msg.author.id != msg.guild.me.id or
                not hasattr(msg, 'is_deletable')):
            return
        if msg.pinned and webhook:
            await webhook.send(
                'This message is pinned!',
                ephemeral=True)
            return
        if not msg.is_deletable:
            return
        x = await self.bot.check_permissions(self, msg, user, webhook)
        if not x:
            return
        await msg.edit(content=None,
                       embed=discord.Embed(
                           color=green_color,
                           description='Message has been deleted!'),
                       components=[],
                       delete_after=2)

    def additional_info(self, prefix):
        return '* {}\n* {}'.format(
            'Pinned messages will not be deleted.',
            'Messages with "{}" mark will not be deleted.'.format(
                EmbedWrapper.NOT_DELETABLE))

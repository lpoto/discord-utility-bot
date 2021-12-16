import bot.utils as utils
import bot.decorators as decorators

# TODO


class RockPaperScissors:
    def __init__(self, client):
        self.client = client
        self.description = 'A simple game of choice between two players.'
        self.color = utils.colors['brown']

    @decorators.MenuSelect
    async def start_command(self, msg, user, data, webhook):
        embed = utils.UtilityEmbed(embed=msg.embeds[0])
        if (embed.get_type() != 'Games' or
            'values' in data and
                data['values'][0] != self.__class__.__name__):
            return
        await webhook.send('Sorry, this game is currently unavailible :(',
                           ephemeral=True)

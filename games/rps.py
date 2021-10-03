import discord
from utils.misc import rps_emojis, random_color, delete_button
from datetime import datetime, timedelta
import utils.decorators as decorators
from utils.wrappers import EmbedWrapper, build_view
from commands.help import Help


class Rps(Help):
    def __init__(self):
        super().__init__(name='rock_paper_scissors')
        self.description = 'A simple game of choice between two players.'
        self.synonyms = ['rps']
        self.embed_type = 'ROCK_PAPER_SCISSORS'
        self.emojis = {rps_emojis[i]: v for i, v in enumerate(['r', 'p', 's'])}

    @decorators.ExecuteCommand
    async def send_game_menu(self, msg):
        # if rps is called via command in the chat,
        # send a game menu from which you can start the rps game
        await self.bot.special_methods['ExecuteCommand']['games'][0](
            msg, False)

    @decorators.ExecuteWithInteraction
    async def start_the_game(self, msg, user, webhook):
        # when rps is selected in games menu send an ephemeral message
        # in which the first user can make his choice
        components = [discord.ui.Button(emoji=i) for i in rps_emojis]
        view = build_view(components)
        if view is None:
            return
        embed = EmbedWrapper(discord.Embed(
            color=random_color()),
            embed_type=self.embed_type,
            marks=EmbedWrapper.INFO,
            info='Choose one of the options to start the game.')
        await webhook.send(embed=embed, view=view, ephemeral=True)

    @decorators.OnButtonClick
    async def user_selection(self, button, msg, user, webhook):
        # if message is ephemeral, it means the first user is making his choice
        # if the message is not ephemeral, the first user has already chosen
        # and the second user, that is not the same as the first user, must
        # make his choice
        if not msg.is_rps:
            return
        if button.emoji.name not in rps_emojis:
            return
        if ('ephemeral', True) in msg.flags:
            await self.ephemeral_button_click(button, msg, user, webhook)
            return
        game = await self.bot.database.use_database(
            self.choice_from_database, msg)
        user1 = msg.guild.get_member(int(game[3]))
        choice1 = list(self.emojis.keys())[
            list(self.emojis.values()).index(game[4])]
        if choice1 is None or user1 is None:
            return
        if user1.id == user.id:
            return
        # after the second user has chosen, compare the choices
        # and change the game's type in database to "deleting"
        # so it auto deletes after time, but does not respond
        # to rps interactions
        await self.game_results(
            user1, user, choice1, button.emoji.name,
            msg)
        await self.bot.database.use_database(
            self.delete_from_database, msg)

    async def ephemeral_button_click(self, button, msg, user, webhook):
        msg.embeds[0].mark(EmbedWrapper.ENDED)
        components = []
        idx = None
        for i, v in enumerate(rps_emojis):
            if v == button.emoji.name:
                idx = i
            components.append(discord.ui.Button(emoji=v))
        components[idx].style = discord.ButtonStyle.green
        # edit the ephemeral message through webhook
        # change the selected button to green
        msg.embeds[0].set_info(None)
        await webhook.edit_message(
            message_id=msg.id,
            embed=msg.embeds[0],
            view=build_view(components))
        # send a non ephemeral message to the channel so another user can join
        new_embed = EmbedWrapper(discord.Embed(
            title='{} is waiting for an opponent'.format(
                user.name if not user.nick else user.nick),
            color=random_color()),
            embed_type=self.embed_type,
            info='Select one of the options to join the game.',
            marks=EmbedWrapper.NOT_DELETABLE)
        # if user has nickname set up use nickname, else use username
        components[idx].style = discord.ButtonStyle.gray
        new_msg = await msg.channel.send(
            embed=new_embed,
            components=components)
        await self.bot.database.use_database(
            self.choice_to_database,
            self.emojis[button.emoji.name],
            new_msg, user.id)

    async def game_results(self, user1, user2, emoji1, emoji2, msg):
        # find the winner of the game
        # edit the existing game message accordingly
        user_names = [user1.name, user2.name]
        # if nicknames are set up use nicknames
        if user1.nick:
            user_names[0] = user1.nick
        if user2.nick:
            user_names[1] = user2.nick
        # if same reactions -> draw
        embed = msg.embeds[0]
        if emoji1 == emoji2:
            embed.title = '{} and {} draw with {} vs {}!'.format(
                user_names[0], user_names[1], emoji1, emoji2)
            embed.set_info(None)
        else:
            info = {}
            # get winner
            if ((emoji1 == rps_emojis[0] and
                 emoji2 == rps_emojis[2]) or
                (emoji1 == rps_emojis[1] and
                    emoji2 == rps_emojis[0]) or
                    (emoji1 == rps_emojis[2] and
                        emoji2 == rps_emojis[1])):
                info['winner_name'] = user_names[0]
                info['winner_id'] = user1.id
                info['winner_emoji'] = emoji1
                info['winner_avatar'] = user1.avatar
                info['loser_name'] = user_names[1]
                info['loser_emoji'] = emoji2
            else:
                info['winner_name'] = user_names[1]
                info['winner_id'] = user2.id
                info['winner_emoji'] = emoji2
                info['winner_avatar'] = user2.avatar
                info['loser_name'] = user_names[0]
                info['loser_emoji'] = emoji1
            embed = await self.add_winner(embed, msg, info)
        embed.mark(EmbedWrapper.ENDED)
        components = []
        for i in rps_emojis:
            if i == emoji2:
                components.append(discord.ui.Button(
                    style=discord.ButtonStyle.green, emoji=i))
            else:
                components.append(discord.ui.Button(emoji=i))
        components.append(delete_button())
        await msg.edit(embed=embed, components=components)

    async def add_winner(self, embed, msg,  info):
        # show in title who won against who with
        # what against what
        embed.title = (
            '{} wins against {}!').format(
            info['winner_name'], info['loser_name'])
        embed.description = '{} against {}'.format(
            info['winner_emoji'], info['loser_emoji'])
        wins = await self.bot.database.use_database(
            self.wins_to_database, msg, info['winner_id'])
        extra = None
        # if database connnection, fetch wins from database
        # and add wins to footer info
        if wins is not None:
            extra = '{} total wins: {}\u3000'.format(
                info['winner_name'], wins)
        embed.set_info(extra)
        if info['winner_avatar']:
            embed.set_thumbnail(url=info['winner_avatar'])
        return embed

    # ---------------------------------------------------------- DATABASE STUFF

    async def choice_to_database(self, cursor, choice, msg, user_id):
        time = await self.bot.database.get_deletion_time(msg, self.name)
        cur_time = (datetime.now() + timedelta(hours=time + 0.5)
                    ).strftime('%d:%m:%H')
        cursor.execute(
            ("INSERT INTO messages " +
             "(type, channel_id, message_id, user_id, info, deletion_time) " +
             "VALUES ('{}', '{}', '{}', '{}', '{}', '{}')").format(
                'rps', msg.channel.id, msg.id, user_id, choice, cur_time))
        await msg.delete(
            delay=time * 3600)

    async def choice_from_database(self, cursor, msg):
        cursor.execute((
            "SELECT * FROM messages " +
            "WHERE type = 'rps' AND channel_id = '{}' AND message_id = '{}'"
        ).format(
            msg.channel.id, msg.id))
        return cursor.fetchone()

    async def delete_from_database(self, cursor, msg):
        # only update the type to "deleting"
        cursor.execute((
            "UPDATE messages SET type = 'deleting' WHERE " +
            "channel_id = '{}' AND message_id = '{}'").format(
            msg.channel.id, msg.id))

    async def wins_to_database(self, cursor, msg, user_id):
        # add a win for the user to the database and return total win count
        cursor.execute((
            "SELECT * FROM wins WHERE game = 'rps' AND" +
            " guild_id = '{}' AND user_id = '{}'").format(
                msg.guild.id, user_id))
        fetched = cursor.fetchone()
        count = 1
        if fetched is None:
            cursor.execute(
                ("INSERT INTO wins (game, guild_id, user_id, " +
                 "wins) VALUES ('rps', '{}', '{}', 1)").format(
                    msg.guild.id, user_id))
        else:
            count = fetched[3] + 1
            cursor.execute(
                ("UPDATE wins SET wins = {} WHERE game = 'rps' AND " +
                 "guild_id = '{}' and user_id = '{}'").format(
                     count, msg.guild.id, user_id))
        return count

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Typing this command open a game menu.',
            'Clicking on this game in a game menu starts the game.',
            'Select your choice in a message only you can see.',
            'Then another makes his choice to play against you.',
            'A record of wins is kept.')

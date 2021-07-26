import discord
import re
from datetime import datetime
from threading import Timer
from command import Command
from utils import *

# TODO -> remove event from channel
#      -> show running events for the guild


class Events(Command):
    def __init__(self):
        super().__init__(name='event')
        self.description = 'Set up events for bot to send notifications.'
        # dict {datetime: [(f1, args), (f2, args),...]}
        # functions to be called independently at certain times
        self.events = {}
        # timer between events
        self.timer = None

    async def start_timer(self):
        # start the timer that waits until closest event
        if self.timer is not None and self.timer.is_alive():
            self.timer.cancel()
        if len(self.events) == 0:
            return
        next_e = await self.next_event()
        if next_e is None:
            return
        self.timer = Timer(
            next_e[0], self.timer_function, args=(next_e[1], ))
        self.timer.start()

    async def next_event(self):
        # find closest event
        dates = [datetime.strptime(x, '%d-%m,%H:%M'
                                   ) for x in self.events.keys()]
        next_time = min(dates)
        cur_time = datetime.now().strftime("%d-%m,%H:%M")
        cur_time = datetime.strptime(cur_time, "%d-%m,%H:%M")
        dif = await self.compare_times(cur_time, next_time)
        if dif is None:
            return
        return ((dif), next_time.strftime('%d-%m,%H:%M'))

    def timer_function(self, time):
        # start the event
        self.bot.client.dispatch('event_time', time)

    async def add_event(self, times_functions, start=True):
        # times_function = {datetime: (function, args)}
        cur_time = datetime.now().strftime("%d-%m,%H:%M")
        time = next(iter(times_functions))
        if time not in self.events:
            self.events[time] = []
        self.events[time].append(times_functions[time])
        if start:
            await self.start_timer()

    async def compare_times(self, now, time2):
        dif = abs(time2 - now)
        if now > time2:
            time2 = time2.strftime('%d-%m,%H:%M')
            if dif.days == 0 and dif.seconds <= 30 * 60:
                self.bot.client.dispatch('event_time', time2)
            else:
                self.bot.client.dispatch('event_time', time2, False)
            return
        return dif.seconds

    async def remove_event(self, time):
        if time not in self.events:
            return
        if self.bot.database.connected:
            cursor = self.bot.database.cnx.cursor(buffered=True)
            cursor.execute("DELETE FROM events WHERE datetime = '{}'".format(
                time))
            self.bot.database.cnx.commit()
            cursor.close()
        del self.events[time]

    async def execute_command(self, msg):
        args = msg.content.split()
        if len(args) < 2:
            await msg_send(
                channel=msg.channel,
                text='Please add a name for the event!',
                delete_after=5)
            return
        name = msg.content.replace('{} '.format(args[0]), '', 1)
        embed_var = discord.Embed(
            title='Event: ' + name,
            description='date:\ntime:\nchannel: {}\ntext:\ntags:'.format(
                msg.channel.id),
            color=random_color())
        embed_var.set_footer(
            text=('* Add options by replying "<opt> <value>" ' +
                  '\n* Multiple options can be added at one,' +
                  ' separated with ";".\n' +
                  '* Date should be given in day and month format.\n' +
                  '* Time should be given in hours and minutes format.\n'
                  '* Name can also be changed.\n' +
                  '* Channel should be given with its name.\n'
                  '* After adding desired options (date and time are ' +
                  'mandatory) reply "commit" to start the event.\n' +
                  'Example:\n"date 27. 7.; time 16:00; text Test text; "' +
                  'name new_name; tags test_tags; channel general; commit".'))
        await msg_send(channel=msg.channel, embed=embed_var)

    async def on_reply(self, msg, referenced_msg):
        # on reply add options to created event
        # multiple may be added, separated with ;
        if (len(referenced_msg.embeds) != 1 or
                not referenced_msg.embeds[0].title.startswith('Event:')):
            return
        args = msg.content.split(';')
        opts = {'text': self.add_text,
                'date': self.add_date,
                'time': self.add_time,
                'tags': self.add_tags,
                'channel': self.add_channel,
                'name': self.change_name,
                'commit': self.commit_event}
        for i in args:
            opt = (i.split()[0]).strip()
            if opt not in opts:
                await msg_send(
                    channel=msg.channel,
                    text='Invalid option `{}`.'.format(opt),
                    delete_after=5)
                continue
            await opts[opt](referenced_msg, i.replace(
                '{} '.format(i.split()[0]), '', 1).strip())

    async def add_text(self, msg, args):
        if len(args) > 300:
            await msg_send(
                channel=msg.channel,
                text='Maximum 300 charaters!',
                delete_after=5)
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[3] = 'text: {}'.format(args)
        embed_var.description = '\n'.join(desc)
        await msg_edit(msg=msg, embed=embed_var)

    async def add_date(self, msg, args):
        date = await self.valid_date(msg, args)
        if date is None:
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[0] = 'date: {}'.format(date)
        embed_var.description = '\n'.join(desc)
        await msg_edit(msg=msg, embed=embed_var)

    async def add_time(self, msg, args):
        time = await self.valid_time(msg, args)
        if time is None:
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[1] = 'time: {}'.format(time)
        embed_var.description = '\n'.join(desc)
        await msg_edit(msg=msg, embed=embed_var)

    async def add_tags(self, msg, args):
        if len(args) > 300:
            await msg_send(
                channel=msg.channel,
                text='Maximum 300 characters!',
                delete_after=5)
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[4] = 'tags: {}'.format(args)
        embed_var.description = '\n'.join(desc)
        await msg_edit(msg=msg, embed=embed_var)

    async def add_channel(self, msg, args):
        channel_id = await self.valid_channel(msg, args)
        if channel_id is None:
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[2] = 'channel: {}'.format(str(channel_id))
        embed_var.description = '\n'.join(desc)
        await msg_edit(msg=msg, embed=embed_var)

    async def change_name(self, msg, args):
        if len(args) > 100:
            await msg_send(
                channel=msg.channel,
                text='Maximum 100 characters in name!',
                delete_after=5)
            return
        embed_var = msg.embeds[0]
        embed_var.title = 'Event: {}'.format(args)
        await msg_edit(msg=msg, embed=embed_var)

    async def valid_time(self, msg, time):
        nums = [int(x) for x in re.findall(r'\d+', time)]
        if len(nums) != 2 or 0 > nums[0] > 23 or 0 > nums[1] > 23:
            await msg_send(
                channel=msg.channel,
                text='`{}` is not a valid time!'.format(time),
                delete_after=5)
            return
        for i in range(len(nums)):
            if len(str(nums[i])) == 1:
                nums[i] = '0{}'.format(nums[i])
        return '{}:{}'.format(nums[0], nums[1])

    async def valid_date(self, msg, date):
        nums = [int(x) for x in re.findall(r'\d+', date)]
        if (len(nums) != 2 or nums[1] > 12 or nums[0] > 31 or
            (nums[1] == 2 and nums[0] > 28) or
            (nums[1] < 6 and nums[1] % 2 == 0 and nums[0] > 30) or
                nums[1] > 6 and nums[1] % 2 != 0 and nums[0] > 30):
            await msg_send(
                channel=msg.channel,
                text='`{}` is not a valid date!'.format(date),
                delete_after=5)
            return
        for i in range(len(nums)):
            if len(str(nums[i])) == 1:
                nums[i] = '0{}'.format(nums[i])
        return '{}-{}'.format(nums[0], nums[1])

    async def valid_channel(self, msg, channel):
        if not msg.guild:
            return
        ch = discord.utils.get(msg.guild.channels, name=channel)
        if ch is None or str(ch.type) == 'voice':
            await msg_send(
                channel=msg.channel,
                text='`{}` is not a valid text channel!'.format(channel),
                delete_after=5)
            return
        return ch.id

    async def commit_event(self, msg, args):
        embed_var = msg.embeds[0]
        info = embed_var.description.split('\n')
        if info[0] == 'date:' or info[1] == 'time:':
            await msg_send(
                channel=msg.channel,
                text='Date and time need to be set!',
                delete_after=5)
            return
        info = [(info[0].replace('date: ', '', 1) + ',' +
                 info[1].replace('time: ', '', 1)),
                info[2].replace('channel: ', '', 1),
                embed_var.title.replace('Event: ', '', 1),
                info[3].replace('text: ', '', 1),
                info[4].replace('tags: ', '', 1)
                ]
        await self.schedule_event(info)
        self.event_to_database(info)
        embed_var.title = embed_var.title.replace(
            'Event:', 'Event(commited):', 1)
        embed_var.set_footer(text='')
        await msg_edit(msg=msg, embed=embed_var, reactions=waste_basket)

    async def send_event(self, channel_id, event, text, tags):
        # send scheduled event at the right time
        # timed by threading.Timer()
        channel = self.bot.client.get_channel(int(channel_id))
        if channel is None:
            return
        embed_var = discord.Embed(
            title=event,
            color=random_color(),
            description=text)
        await msg_send(channel=channel, text=tags, embed=embed_var)

    async def schedule_event(self, event, start=True):
        # add a new event to the schedule
        e = {event[0]: {
            'function': self.send_event,
            'args': (event[1], event[2], event[3], event[4])
        }}
        # add the event to events and reset the timer
        # timer waits until closest event
        await self.add_event(e, start)

    async def events_from_database(self):
        if not self.bot.database.connected:
            return
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute('SELECT * FROM events')
        fetched = cursor.fetchall()
        if fetched is None or len(fetched) == 0:
            return
        for e in fetched:
            await self.schedule_event(e, False)
        cursor.close()

    def event_to_database(self, info):
        if not self.bot.database.connected:
            return
        cursor = self.bot.database.cnx.cursor(buffered=True)
        cursor.execute(('INSERT INTO events ' +
                        '(datetime, channel_id, event, text, tags) VALUES' +
                        "('{}', '{}', '{}', '{}', '{}')".format(
                            info[0], info[1], info[2], info[3], info[4])))
        self.bot.database.cnx.commit()
        cursor.close()

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}'.format(
            'Initialize new event with "{}event <event-name>"'.format(prefix),
            "Add event's information as described in the started event.",
            'The events may be delayed by a minute.')

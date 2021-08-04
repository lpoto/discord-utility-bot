import discord
import re
from datetime import datetime
from threading import Timer
from commands.help import Help
from utils import random_color, waste_basket, EmbedWrapper

# TODO     -> Remove event from channel.


class Events(Help):
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
        self.bot.client.dispatch('time', time)

    async def on_time(self, time, execute=True):
        # send the event to the channel
        if not execute or time not in self.events:
            return
        for f in self.events[time]:
            if 'args' in f:
                await f['function'](*f['args'])
            else:
                await f['function']
        await self.remove_event(time)
        await self.start_timer()

    async def add_event(self, times_functions, start=True):
        # times_function = {datetime: (function, args)}
        time = next(iter(times_functions))
        if time not in self.events:
            self.events[time] = []
        self.events[time].append(times_functions[time])
        if start:
            await self.start_timer()

    async def compare_times(self, now, time2):
        dif = abs(time2 - now)
        dif = dif.seconds + (dif.days * (24 * 60 * 60))
        if now > time2:
            time2 = time2.strftime('%d-%m,%H:%M')
            if dif <= 30 * 60:
                self.bot.client.dispatch('time', time2)
            else:
                self.bot.client.dispatch('time', time2, False)
            return
        return dif

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
            await msg.channel.send(
                text='Please add a name for the event!',
                delete_after=5)
            return
        events = await self.bot.database.use_database(
            self.show_server_events, msg)
        if args[1] in ['stop', 'remove', 'end', 'cancel']:
            if len(args) < 3:
                await msg.channel.send(
                    text='Which event do you want to delete?',
                    delete_after=5)
                return
            e = msg.content.replace('{} {} '.format(
                args[0], args[1]), '', 1)
            if e not in events.keys():
                await msg.channel.send(
                    text='No such event.',
                    delete_after=5)
            else:
                await self.bot.database.use_database(
                    self.remove_server_event, msg, e, events[e])
            return
        if args[1] in ['show', 'events', 'see'] and len(args) == 2:
            if events is None:
                await msg.channel.send(
                    text='No scheduled events.',
                    delete_after=5)
                return
            embed_var = EmbedWrapper(discord.Embed(
                title='Scheduled events',
                color=random_color()),
                embed_type='EVENT',
                marks=EmbedWrapper.INFO)
            for k, v in events.items():
                embed_var.add_field(name=k, value=v)
            await msg.channel.send(embed=embed_var, reactions=waste_basket)
            return
        name = msg.content.replace('{} '.format(args[0]), '', 1)
        if events is not None and name in events.keys():
            await msg.channel.send(
                text='Event with this name already exists in this server.',
                delete_after=5)
            return
        embed_var = EmbedWrapper(discord.Embed(
            title=name,
            description='date:\ntime:\nchannel: {}\ntext:\ntags:'.format(
                msg.channel.id),
            color=random_color()),
            embed_type='EVENT',
            marks=EmbedWrapper.INFO)
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
        await msg.channel.send(embed=embed_var)

    async def on_reply(self, msg, referenced_msg):
        # on reply add options to created event
        # multiple may be added, separated with ;
        if not referenced_msg.is_event:
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
            if len(i) < 1:
                continue
            opt = (i.split()[0]).strip()
            if opt not in opts:
                await msg.channel.send(
                    text='Invalid option `{}`.'.format(opt),
                    delete_after=5)
                continue
            await opts[opt](referenced_msg, i.replace(
                '{} '.format(i.split()[0]), '', 1).strip())

    async def add_text(self, msg, args):
        if len(args) > 300:
            await msg.channel.send(
                text='Maximum 300 charaters!',
                delete_after=5)
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[3] = 'text: {}'.format(args)
        embed_var.description = '\n'.join(desc)
        await msg.edit(embed=embed_var)

    async def add_date(self, msg, args):
        date = await self.valid_date(msg, args)
        if date is None:
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[0] = 'date: {}'.format(date)
        embed_var.description = '\n'.join(desc)
        await msg.edit(embed=embed_var)

    async def add_time(self, msg, args):
        time = await self.valid_time(msg, args)
        if time is None:
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[1] = 'time: {}'.format(time)
        embed_var.description = '\n'.join(desc)
        await msg.edit(embed=embed_var)

    async def add_tags(self, msg, args):
        if len(args) > 300:
            await msg.channel.send(
                text='Maximum 300 characters!',
                delete_after=5)
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[4] = 'tags: {}'.format(args)
        embed_var.description = '\n'.join(desc)
        await msg.edit(embed=embed_var)

    async def add_channel(self, msg, args):
        channel_id = await self.valid_channel(msg, args)
        if channel_id is None:
            return
        embed_var = msg.embeds[0]
        desc = embed_var.description.split('\n')
        desc[2] = 'channel: {}'.format(str(channel_id))
        embed_var.description = '\n'.join(desc)
        await msg.edit(embed=embed_var)

    async def change_name(self, msg, args):
        if len(args) > 100:
            await msg.channel.send(
                channel=msg.channel,
                text='Maximum 100 characters in name!',
                delete_after=5)
            return
        embed_var = msg.embeds[0]
        embed_var.title = 'Event: {}'.format(args)
        await msg.edit(embed=embed_var)

    async def valid_time(self, msg, time):
        nums = [int(x) for x in re.findall(r'\d+', time)]
        if len(nums) != 2 or 0 > nums[0] > 23 or 0 > nums[1] > 23:
            await msg.channel.send(
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
            await msg.channel.send(
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
            await msg.channel.send(
                text='`{}` is not a valid text channel!'.format(channel),
                delete_after=5)
            return
        return ch.id

    async def commit_event(self, msg, args):
        embed_var = msg.embeds[0]
        info = embed_var.description.split('\n')
        if info[0] == 'date:' or info[1] == 'time:':
            await msg.channel.send(
                text='Date and time need to be set!',
                delete_after=5)
            return
        info = [(info[0].replace('date: ', '', 1) + ',' +
                 info[1].replace('time: ', '', 1)),
                info[2].replace('channel: ', '', 1),
                embed_var.title.replace('Event: ', '', 1),
                info[3].replace('text: ', '', 1).replace('text:', '', 1),
                info[4].replace('tags: ', '', 1).replace('tags:', '', 1)
                ]
        await self.schedule_event(info)
        await self.bot.database.use_database(
            self.event_to_database, info)
        embed_var.title = embed_var.title.replace(
            'Event:', 'Event(commited):', 1)
        embed_var.set_footer(text='')
        embed_var = EmbedWrapper(embed_var,
                                 embed_type="EVENT",
                                 marks=EmbedWrapper.ENDED)
        await msg.edit(embed=embed_var, reactions=waste_basket)

    async def send_event(self, channel_id, event, text, tags):
        # send scheduled event at the right time
        # timed by threading.Timer()
        channel = self.bot.client.get_channel(int(channel_id))
        if channel is None:
            return
        embed_var = EmbedWrapper(discord.Embed(
            title=event,
            color=random_color(),
            description=text),
            embed_type="EVENT",
            marks=EmbedWrapper.INFO)
        await channel.send(
            text=None if len(tags) < 1 else tags, embed=embed_var)

    async def schedule_event(self, event, start=True):
        # add a new event to the schedule
        e = {event[0]: {
            'function': self.send_event,
            'args': (event[1], event[2], event[3], event[4])
        }}
        # add the event to events and reset the timer
        # timer waits until closest event
        await self.add_event(e, start)

    async def remove_server_event(self, cursor, msg,  event, info):
        info = info.split('\n')
        dt = ','.join([info[0][6:], info[1][6:]])
        channel = discord.utils.get(self.bot.client.get_all_channels(),
                                    name=info[2][9:])
        if channel is None or dt not in self.events or len(
                self.events[dt]) == 0:
            return
        for e in self.events[dt]:
            if ('args' in e and len(e['args']) >= 2 and
                    e['args'][0] == str(channel.id) and
                    e['args'][1] == event):
                self.events[dt].remove(e)
                break
        if len(self.events[dt]) == 0:
            del self.events[dt]
        if not self.bot.database.connected:
            return
        cursor.execute(("DELETE FROM events WHERE datetime = '{}' " +
                        "AND channel_id = '{}' AND event = '{}'").format(
            dt, channel.id, event))
        self.bot.database.cnx.commit()
        await msg.channel.send(
            text='Removed event `{}`.'.format(event))

    async def events_from_database(self, cursor):
        cursor.execute('SELECT * FROM events')
        fetched = cursor.fetchall()
        if fetched is None or len(fetched) == 0:
            cursor.close()
            return
        for e in fetched:
            await self.schedule_event(e, False)

    def event_to_database(self, cursor, info):
        cursor.execute(('INSERT INTO events ' +
                        '(datetime, channel_id, event, text, tags) VALUES' +
                        "('{}', '{}', '{}', '{}', '{}')".format(
                            info[0], info[1], info[2], info[3], info[4])))
        self.bot.database.cnx.commit()

    async def show_server_events(self, cursor, msg):
        cursor.execute('SELECT * FROM events')
        fetched = cursor.fetchall()
        if fetched is None or len(fetched) == 0:
            return
        events = {}
        for e in fetched:
            channel = msg.guild.get_channel(int(e[1]))
            if channel is None:
                continue
            date = e[0].split(',')[0]
            time = e[0].split(',')[1]
            events[e[2]] = 'Date: {}\nTime: {}\nChannel: {}'.format(
                date, time, channel.name)
        if len(events) == 0:
            return
        return events

    def additional_info(self, prefix):
        return '* {}\n* {}\n* {}\n* {}\n* {}'.format(
            'Initialize an event with "{}event <event-name>"'.format(prefix),
            "Add event's information as described in the started event.",
            'The events may be delayed by a minute.',
            'See scheduled events for the server with "{}event show".'.format(
                prefix),
            'Remove event with "{}event remove <event_name>".'.format(
                prefix))

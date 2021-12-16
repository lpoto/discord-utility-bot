from datetime import datetime, timedelta
import random


def timestamp_string():
    return '%d-%m-%y %H:%M:%S'


def cur_timestamp():
    return datetime.now().strftime(timestamp_string())


def delta_seconds_timestamp(seconds):
    return (datetime.now() + timedelta(seconds=seconds)).strftime(
        timestamp_string())


def time_dif(timestamp):
    """Returns seconds between timestamp and current timestamp"""
    then = datetime.strptime(timestamp, timestamp_string())
    now = datetime.strptime(cur_timestamp(), timestamp_string())
    tdelta = then - now
    return tdelta.total_seconds()


def random_color():
    """generate a random color"""
    return int("%06x" % random.randint(0, 0xFFFFFF), 16)


colors = {
    'white': 0xffffff,
    'red': 0xc30202,
    'blue': 0x0099e1,
    'orange': 0xf75f1c,
    'yellow': 0xf8c300,
    'green': 0x008e44,
    'purple': 0xa652bb,
    'brown': 0xa5714e,
    'black': 0,
}
# emojis rock, paper, scissors
rps_emojis = (
    u'\U0001FAA8',
    u'\U0001F5DE\U0000FE0F',
    u'\U00002702\U0000FE0F')
# thumbs up emoji
thumbs_up = u'\U0001F44D'
number_emojis = (
    '1️⃣',
    '2️⃣',
    '3️⃣',
    '4️⃣',
    '5️⃣',
    '6️⃣',
    '7️⃣'
)
squares = {
    'red': '🟥',
    'blue': '🟦',
    'brown': '🟫',
    'green': '🟩',
    'yellow': '🟨',
    'orange': '🟧',
    'purple': '🟪',
    'white': '⬜',
    'black': '⬛',
}
circles = {
    'red': '🔴',
    'blue': '🔵',
    'orange': '🟠',
    'green': '🟢',
    'yellow': '🟡',
    'brown': '🟤',
    'purple': '🟣',
    'white': '⚪',
    'black': '⚫'
}
emojis = tuple(circles.values())

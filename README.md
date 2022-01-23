# Discord music bot

## commands:

- skip,
- pause,
- continue,
- replay,
- stop,
- loop,
- loop queue,
- queue,
- shuffle,
- `<count>`

## Features

- Bot does not work with a prefix. When mentioned it opens a thread
in which all the music commands work by simply typing the name of the
command, the name of the song or the url of the song.

- Message in a thread may be prefixed with `play` or `command` to ensure the
correct bot response.

- Passing the url of a youtube playlist adds the whole playlist to the queue.

- Only a single music thread may be active at once in a server.

- On stop command the bot leaves the channel and closes its running music thread.

- User may only use music commands if they are in a voice channel and bot is either
in the same channel or not connected to any.

- Skipping allows you to skip either 1 or multiple songs.

- Bot leaves the channel after being alone in the channel or after not
playing anything for 10 minutes.

- Bot keeps track of 50 most commonly played songs. Typing a number (`<count>`) in
a music thread adds `<count>` of those songs to the queue.

- Bot requires a `DJ` role. Only users with the same role may use the
music commands.

## Required permissions

- View Channels
- Send Messages
- Create Public Threads
- Connect
- Speak


## Secondary features

- Different roles may be set up for different commands

- `playlist` command. `playlist <name>` adds the playlist `<name>` to the queue.

- adding `playlist` to the bot mention opens a new playlist thread where you add songs to 
the playlist. Typing `save <name>` saves the playlist.

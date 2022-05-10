# Discord bots

A collection of discord bots using using [discord.js](https://discord.js.org/#/) in [nodeJS](https://nodejs.org/en/about/).

Utility bot: [invite to server](https://discord.com/api/oauth2/authorize?client_id=763366736586080257&permissions=326685953024&scope=applications.commands%20bot)
Music bot: [invite to server](https://discord.com/api/oauth2/authorize?client_id=806226473069314048&permissions=326454283264&scope=bot%20applications.commands)

**NOTE** Bots only work when given all the required permissions (listed below).

## Music bot

A bot for playing music.

### Features

-   `/music` command sends a new queue message and opens a music thread on that message.

-   Only a single queue with a music thread may be active at once in a server.

-   The queue may only be deleted by clicking the `◼` button.

-   Songs are added by typing the name/url of a youtube song/playlist in the music thread.

-   Bot requires at least one unmuted (non bot) listener.

    -   If no unmuted members are in the channel, bot will eventually disconnect.
    -   Reconnect it by clicking `Join`.

-   Queue message offers a variety of commands by clicking on buttons. (ex. loop, skip, shuffle, ... )

-   User may only use music commands if they are undeafened in a voice channel and bot is either in the same channel or not connected to any.

-   Bot requires a `DJ` role. Only users with the same role may use the music commands.

-   `/config` command allows setting which roles are allowed to use a command.

-   For more info on the commands, use `/help` slash command or click on `?` in the queue message in a discord channel.

### Required permissions

-   View Channels
-   Send Messages
-   Read Message History
-   Create Public Threads
-   Manage Threads
-   Connect
-   Speak
-   Use Voice Activity

## Utility bot

A bot for managing smaller discord servers.

**NOTE** Uncommited messages become unresponsive after 24h.

## Features

-   Hosting polls,
-   Adding and removing roles with button clicks,
-   Configuring which roles may use which commands.

-   For more info, use `/help` slash command in a discord server.

### Required permissions

-   View Channels
-   Send Messages
-   Read Message History
-   Create Public Threads
-   Manage Roles
-   Manage Threads

## Development

For more info on developing the bot see [config](docs/CONFIG.md)

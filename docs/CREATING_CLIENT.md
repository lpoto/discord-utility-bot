## Creating your discord bot client

Visit [discord developer portal](https://discord.com/developers) and log in to your discord account.

Under `Applications` click on `New application` and name your discord bot.

Under `Bot` click on `Add bot` and then:

-   under `Privileged Gateway Intents` check `PRESENCE INTENT`, `SERVER MEMBERS INTENT` and `MESSAGE CONTENT INTENT`,
-   copy `TOKEN` to your `.env`.

Add the bot to your discord server:

-   Under `OAuth2/URL Generator` under `SCOPES` select:

    -   bot,
    -   applications.commands

-   Under `BOT PERMISSIONS` select:

    -   Send Messages,
    -   Create Public Threads,
    -   Send Messages in Threads,
    -   Read Message History,
    -   Use Voice Activity,
    -   Connect,
    -   Speak

-   Copy `GENERATED URL` and paste it into the browser.

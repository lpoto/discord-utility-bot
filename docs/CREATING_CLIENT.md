## Creating your discord bot client

Visit [discord developer portal](https://discord.com/developers) and log in to your discord account.

Under `Applications` click on `New application` and name your discord bot.

Under `Bot` click on `Add bot` and then:

- under `Privileged Gateway Intents` check `PRESENCE INTENT` and `SERVER MEMBERS INTENT`,
- copy `TOKEN` to your `.env`.

Add the bot to your discord server:

- Under `General information` copy `CLIENT ID`.
- Visit https://discordapi.com/permissions.html, paste your client's id under `Client ID`,
  select desired permissions and copy the link on the bottom of the page.
- paste the link into your browser.

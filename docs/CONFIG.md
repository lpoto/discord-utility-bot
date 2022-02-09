## Requirements

- nodeJS
- npm
- typescript

## Prerequisites

- Create your [discord bot client](CREATING_CLIENT.md)

- Clone the repository:

```
git clone https://github.com/lpoto/discord-music-bot.git
cd discord-music-bot
```

- Install dependencies:

```
npm install
```

- Create `config.json` file in `src/` and add your discord bot token:

```
{
    "token": "discord-bot-token",
    "musicRole": "DJ"
}
```

**NOTE** a different music role may be used (role required to use the bot commands)

## Running the bot


- Compile:

```
npm run build
```

- Run:

```
npm run start
```

- Alternatively run the bot with nodemon:

```
npm run dev
```


## Run the bot in a docker container

TODO

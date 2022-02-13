## Requirements

- nodeJS
- npm
- your own [discord bot client](CREATING_CLIENT.md)

## Running the bot

```bash
git clone https://github.com/lpoto/discord-music-bot.git
cd ./discord-music-bot
npm install
```
```bash
export DISCORD_TOKEN=your-discord-client-token
```
```bash
npm run build
npm run start
#or
npm run dev
```

## Running the bot in a docker container


- Create a `.env` file and add your discord token:

```bash
DISCORD_TOKEN: your-token
```

- Run with docker-compose:

```bash
docker-compose up -d --build
```

**NOTE** You can add multiple discord tokens in the `.env` file and 
create additional services in `docker-compose.yaml`, so you can run multiple instances
of the bot at once.

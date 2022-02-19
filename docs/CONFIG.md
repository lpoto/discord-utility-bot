## Requirements

- nodeJS
- npm
- your own [discord bot client](CREATING_CLIENT.md)

## Prerequisites

- Clone the repository:
```bash
git clone https://github.com/lpoto/discord-music-bot.git
cd ./discord-music-bot
```

- Add your discord token to [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/client/environment/DISCORD_TOKEN`.

**NOTE** You may also replace other environment variables' values (ex. `POSTGRES_PASSWORD`)

## Run the bot in a docker container

```bash
cd .dockerenv
docker-compose up -d --build
```

**NOTE** You can add additional client services `docker-compose.yaml`, so you can run multiple instances
of the bot at once.

## Requirements

- [Docker](https://www.docker.com/)
- [Your own discord bot client](CREATING_CLIENT.md)

## Prerequisites

- Clone the repository:

```bash
git clone https://github.com/lpoto/discord-utility-bot.git
cd discord-utility-bot
```

- Add your discord bot token to [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/client/environment/DISCORD_TOKEN`.

**NOTE** you may also change other environment variables' values.
**NOTE**  Tables and indexes on the database will be created automatically.

## Running the bot in a docker container

```bash
cd .dockerenv
docker-compose up -d --build
```

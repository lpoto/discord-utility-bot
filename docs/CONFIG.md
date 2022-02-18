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

- Create `.env` file in the project's root directory and add the following values:

```bash
DISCORD_TOKEN=your-token

DATABASE_USER=database_user
DATABASE_PASSWORD=database_password
```

## Run the bot in a docker container

```bash
docker-compose up -d --build
```

**NOTE** You can add multiple discord tokens in the `.env` file and 
create additional services in `docker-compose.yaml`, so you can run multiple instances
of the bot at once.

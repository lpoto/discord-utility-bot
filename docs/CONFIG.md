## Requirements

- Python 3.9
- pip 20.x

## Prerequisites

- Clone the repository and install packages:

```
git clone https://github.com/potocnikluka/discord-utility-bot.git
cd discord-utility-bot
pip install -r requirements.txt
```

- Create your [discord bot client](CREATING_CLIENT.md)

- Create `.env` file in project's root directory and add:

```
DEV_DISCORD_TOKEN="your-discord-client-token"

DEV_BOT_LOGGING=<0-50>
```

- Create a database and add info to `.env` file:

```
DEV_DATABASE="database-name"
DEV_HOST="host-type"
DEV_USER="user"
DEV_PASSWORD="your-database-password"

DEV_DB_LOGGING=<0-50>
```

## Running the bot

Run the following command in your bot's root directory:

```
python main.py --dev
```

or

```
python main.py --prod
```

**NOTE** drop env variables' `DEV_` prefix to run with `--prod` flag

## Running the bot in a docker container

```
docker build -t discordbot .
```

```
docker run -it -d --restart always --network="host" discordbot:latest
```

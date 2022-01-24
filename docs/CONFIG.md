## Requirements

- Python 3.9
- pip 20.x
- mysql

## Prerequisites

- Create your [discord bot client](CREATING_CLIENT.md)

- Clone the repository:

```
git clone https://github.com/potocnikluka/discord-utility-bot.git
cd discord-utility-bot
```

- Create `.env` file in project's root directory and add:

```
DISCORD_TOKEN="your-discord-client-token"

CLIENT_LOGGING=<0-50>
```

- Create a mysql database and add it's info to the `.env` file:

```
MYSQL_DATABASE="discord_utility_bot"
MYSQL_HOST="localhost"
MYSQL_USER="user"
MYSQL_PASSWORD="password"

MYSQL_LOGGING=<0-50>
```

**NOTE**  tables and indexes on the database will be created automatically

## Running the bot in a docker container

```
docker-compose up -d --build
```

## Running the bot without a docker

- Install packages:

```
pip install -r requirements.txt
```

- Run the bot

```
python main.py
```


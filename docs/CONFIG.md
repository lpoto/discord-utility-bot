## Requirements

- Python 3.9
- pip 20.x
- mysql
- [Your own discord bot client](CREATING_CLIENT.md)

## Prerequisites

- Clone the repository:

```
git clone https://github.com/lpoto/discord-utility-bot.git
cd discord-utility-bot
```

- Create `.env` file in project's root and add options following [example.env](../example.env).

**NOTE**  Tables and indexes on the database will be created automatically.

## Running the bot in a docker container

```
docker-compose up -d --build
```

## Running the bot without a docker

- Install packages:

```
pip install -r requirements.txt
```

- Run the bot:

```
python main.py
```


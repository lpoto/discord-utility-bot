## Requirements

-   [Docker](https://www.docker.com/), docker-compose
-   your own [discord bot client](CREATING_CLIENT.md)

## Prerequisites

-   Clone the repository:

```bash
git clone https://github.com/lpoto/discord-bots.git
cd ./discord-bots
```

-   Add your discord tokens to [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/bots/environment`.

**NOTE** You may provide from 0 up to 4 tokens for every bot type (the tokens must be different).
**NOTE** You may split the bots service into multiple services, if you want to run the bots in separate containers.

## Run the bots in a docker container

```bash
cd .dockerenv
docker-compose up -d --build
```

## Pushing image to docker hub

```bash
cd .dockerenv
bash build.sh
```

**NOTE** [build.sh](../.dockerenv/build.sh) will automatically add image tag from repo, name and version in [package.json](../package.json).

You can then replace `build` section with `image: "pushed-image"` in [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/bots`,
to run the pushed image with docker-compose.

## Running the bot without a docker

### Requirements

-   NodeJS v17+
-   npm

##

```bash
export MUSIC_BOT_TOKEN=your_music_bot_token
#export MUSIC_BOT1_TOKEN=your_music_bot_token1
#export MUSIC_BOT2_TOKEN=your_music_bot_token2
#export MUSIC_BOT3_TOKEN=your_music_bot_token3
export MUSIC_BOT_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
#export MUSIC_BOT1_LOG_LEVEL=INFO
#export MUSIC_BOT2_LOG_LEVEL=INFO
#export MUSIC_BOT2_LOG_LEVEL=INFO

export UTILITY_BOT_TOKEN=your_utility_bot_token
#export UTILITY_BOT1_TOKEN=your_utility_bot_token1
#export UTILITY_BOT2_TOKEN=your_utility_bot_token2
#export UTILITY_BOT3_TOKEN=your_utility_bot_token3
export UTILITY_BOT_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
#export UTILITY1_BOT_LOG_LEVEL=INFO
#export UTILITY2_BOT_LOG_LEVEL=INFO
#export UTILITY3_BOT_LOG_LEVEL=INFO

export POSTGRES_DB=database_name
export POSTGRES_USER=database_user
export POSTGRES_PASSWORD=database_password
export POSTGRES_HOST=database_host
export POSTGRES_PORT=database_port

export REGISTER_SLASH_COMMANDS=true
export LOGGER_SHOW_TIMESTAMP=true

#install dependencies
npm install
```

```bash
npm run build
npm run start
# or
npm run dev
```

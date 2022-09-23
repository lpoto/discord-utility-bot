## Requirements

-   [Docker](https://www.docker.com/), docker-compose
-   your own [discord bot client](CREATING_CLIENT.md)

## Prerequisites

-   Clone the repository:

-   Add your discord token to [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/utility-bot/environment`.

**NOTE** up to 4 different tokens may be added to start multiple instances
of the bot

## Run the bot in a docker container

```bash
cd .dockerenv
docker-compose up -d --build
```

## Pushing image to docker hub

```bash
.dockerenv/build
```

**NOTE** [build](../.dockerenv/build) will automatically add image tag from repo, name and version in [package.json](../package.json).

You can then replace `build` section with `image: "pushed-image"` in [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/utility-bot`,
to run the pushed image with docker-compose.

## Running the bot without a docker

### Requirements

-   NodeJS v17+
-   npm

##

```bash
export UTILITY_BOT_TOKEN=your_utility_bot_token
#export UTILITY_BOT1_TOKEN=your_utility_bot_token
#export UTILITY_BOT2_TOKEN=your_utility_bot_token
#export UTILITY_BOT3_TOKEN=your_utility_bot_token

export UTILITY_BOT_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
#export UTILITY_BOT1_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
#export UTILITY_BOT2_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
#export UTILITY_BOT3_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG

export POSTGRES_DB=database_name
export POSTGRES_USER=database_user
export POSTGRES_PASSWORD=database_password
export POSTGRES_HOST=database_host
export POSTGRES_PORT=database_port

export LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
export LOGGER_SHOW_TIMESTAMP=true

export REGISTER_SLASH_COMMANDS=true

#install dependencies
npm install
```

```bash
npm run build
npm run start
# or
npm run dev
```

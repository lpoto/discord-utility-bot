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

**NOTE** You may also provide token for only a single bot, which allows splitting the bots in separate containers.

## Run the bots in a docker container

```bash
cd .dockerenv
docker-compose up -d --build
```

**NOTE** You can add additional client services `docker-compose.yaml`, so you can run multiple instances
of bots at once.

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
export MUSIC_BOT_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG

export UTILITY_BOT_TOKEN=your_utility_bot_token
export UTILITY_BOT_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG

export POSTGRES_DB=database_name
export POSTGRES_USER=database_user
export POSTGRES_PASSWORD=database_password
export POSTGRES_HOST=database_host
export POSTGRES_PORT=database_port

export REGISTER_SLASH_COMMANDS=true

npm install
```

```bash
npm run build
npm run start
# or
npm run dev
```

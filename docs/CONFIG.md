## Requirements

- [Docker](https://www.docker.com/), docker-compose
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

## Pushing image to docker hub

```bash
cd .dockerenv
bash build.sh <your-docker-id> <your-docker-repo>
```

**NOTE** [build.sh](../.dockerenv/build.sh) will automatically add image tag from name and version in [package.json](../package.json).

You can then replace `build` section with `image: "pushed-image"` in [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/client`,
to run the pushed image with docker-compose.

## Running the bot without a docker

### Requirements

- NodeJS v16+
- npm

##

```bash
export DISCORD_TOKEN=your_token
export POSTGRES_DB=database_name
export POSTGRES_USER=database_user
export POSTGRES_PASSWORD=database_password
export POSTGRES_HOST=database_host
export POSTGRES_PORT=database_port

npm install
```
```bash
npm run build
npm run start
# or
npm run dev
```

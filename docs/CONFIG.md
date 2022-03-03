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

## Pushing image to docker hub

```bash
cd .dockerenv
bash build.sh <your-docker-id> <your-docker-repo> <image-tag-name>
```

**NOTE** [build.sh](../.dockerenv/build.sh) will automatically add image version from version in [version.py](../version.py).
**NOTE** `discord-bot` repo and `utility-bot` tag name will be used as default.

You can then replace `build` section with `image: "pushed-image"` in [docker-compose.yaml](../.dockerenv/docker-compose.yaml) under `services/client`,
to run the pushed image with docker-compose.

## Running the bot without a docker

### Requirements

- python 3
- pip3

##

```bash
export DISCORD_TOKEN=your_token
# Logging levels: 50 (CRITICAL), 40 (ERROR), 30 (WARNING), 20 (INFO), 10 (DEBUG)
export CLIENT_LOGGING=10
export POSTGRES_LOGGING=10
export POSTGRES_DB=database_name
export POSTGRES_USER=database_user
export POSTGRES_PASSWORD=database_password
export POSTGRES_HOST=database_host
export POSTGRES_PORT=database_port

pip install -r requirements.txt
```
```bash
python3 main.py
```

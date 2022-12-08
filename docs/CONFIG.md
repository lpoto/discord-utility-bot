## Requirements

-   NodeJS v17+
-   npm
-   your own [discord bot client](CREATING_CLIENT.md)

## Running the bot

```bash
export UTILITY_BOT_TOKEN=your_utility_bot_token
export LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
export UTILITY_BOT_LOG_LEVEL=INFO #or WARN, ERROR, DEBUG
export POSTGRES_DB=database_name
export POSTGRES_USER=database_user
export POSTGRES_PASSWORD=database_password
export POSTGRES_HOST=database_host
export POSTGRES_PORT=database_port

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

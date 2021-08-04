## Prerequisites

* Python 3.9
* pip 20.x

## Installation

* Clone the repository and install packages:
```
	git clone https://github.com/potocnikluka/discord-utility-bot.git
	cd discord-utility-bot
	pip install -r requirements.txt
```

* Create your [discord bot client](creating_client.md)

* Create `.env` file in project's root directory and add:
```
	DISCORD_TOKEN="<your-discord-client-token>"
	DEFAULT_PREFIX="<prefix-key>"
```
* you can optionally add mysql database:
	- Create a database and add info to `.env` file:
```
	DATABASE="database-name"
	HOST="host-type"
	USER="user"
	PASSWORD="your-database-password"
```

* Add filename to `.env` if you want error logs in a file:
```
	LOGFILE='error.log'
```
## Running the bot
Run the following command in your bot's root directory:

	`python main.py`

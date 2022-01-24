import nextcord
import inspect
from functools import wraps


async def check_permissions(*args):
    try:
        if (len(args) < 3 or
                not isinstance(args[1], nextcord.Message) or
                not isinstance(args[2], nextcord.Member)):
            return True
        cmd, msg, user = args[0], args[1], args[2]

        if not cmd or not msg or not user:
            return False

        cmd.client.logger.debug(
            'Checking permissions: user: {}, message: {}'.format(
                user.id,
                msg.id
            )
        )

        if msg.channel.permissions_for(user).administrator:
            return True

        required_roles = await cmd.client.database.Config.get_option(
            guild_id=msg.guild.id, name=cmd.__class__.__name__)

        if required_roles and required_roles.get('info'):
            required_roles = set(required_roles.get('info'))
        user_roles = set(str(x.name) for x in user.roles)

        return len(required_roles.intersection(user_roles)) > 0
    except Exception:
        return True


def CheckPermissions(func):
    """
    Check if user has the required roles and permissions.
    Should be defined below a class decorator.
    """
    @wraps(func)
    async def wrapper(*args):
        if not await check_permissions(*args):
            return
        if not inspect.iscoroutinefunction(func):
            return func(*args)
        return await func(*args)
    return wrapper


async def validate_author(*args):
    try:
        if (len(args) < 3 or
                not isinstance(args[1], nextcord.Message) or
                not isinstance(args[2], nextcord.Member)):
            return True
        cmd, msg, user = args[0], args[1], args[2]

        if not cmd or not msg or not user:
            return False

        cmd.client.logger.debug(
            'Validating author: user: {}, message: {}'.format(
                user.id,
                msg.id
            )
        )

        if msg.channel.permissions_for(user).administrator:
            return True

        client = cmd.client
        msg_info = await client.database.Messages.get_message(
            id=msg.id
        )
        if msg_info and msg_info.get('author_id'):
            if str(msg_info.get('author_id')) != str(user.id):
                return False
        return True

    except Exception:
        return True


def ValidateAuthor(func):
    @wraps(func)
    async def wrapper(*args):
        if not await validate_author(*args):
            return
        if not inspect.iscoroutinefunction(func):
            return func(*args)
        return await func(*args)
    return wrapper

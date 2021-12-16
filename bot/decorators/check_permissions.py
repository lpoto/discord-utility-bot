import nextcord
import inspect
from functools import wraps


async def check_permissions(*args):
    if (len(args) < 3 or
            not isinstance(args[1], nextcord.Message) or
            not isinstance(args[2], nextcord.Member)):
        return True
    cmd, msg, user = args[0], args[1], args[2]

    if msg.channel.permissions_for(user).administrator:
        return True

    required_roles = await cmd.client.database.Config.get_option(
        guild_id=msg.guild.id, name=cmd.__class__.__name__)
    if (required_roles):
        required_roles = required_roles.get('info')
    user_roles = {str(x.name) for x in user.roles}
    return (not required_roles or len(required_roles) == 0 or
            any(i in user_roles for i in required_roles))


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

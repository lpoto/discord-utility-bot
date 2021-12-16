import nextcord


def get_component(req_attr, msg: nextcord.Message, attr='custom_id'):
    for component in msg.components:
        if not hasattr(component, 'children'):
            continue
        for b in component.children:
            if hasattr(b, attr) and (
                    getattr(b, attr) == req_attr):
                return b


def delete_button(row: int = None):
    return nextcord.ui.Button(
        style=nextcord.ButtonStyle.blurple,
        label='delete',
        row=row)


def help_button(row: int = None):
    return nextcord.ui.Button(
        style=nextcord.ButtonStyle.gray,
        label='help',
        row=row)


def back_button(row: int = None):
    return nextcord.ui.Button(
        style=nextcord.ButtonStyle.gray,
        label='back',
        row=row)


def home_button(row: int = None):
    return nextcord.ui.Button(
        style=nextcord.ButtonStyle.gray,
        label='home',
        row=row)


def build_view(components: list, view: nextcord.ui.View = None):
    if not isinstance(components, list) and not isinstance(
            components, tuple):
        components = [components]
    if view is None:
        view = nextcord.ui.View(timeout=None)
    for i in components:
        view.add_item(i)
    return view


async def reset_message_view(msg):
    components = []
    for i in sum([i.children for i in msg.components], []):
        if isinstance(i, nextcord.Button):
            components.append(nextcord.ui.Button(
                label=i.label,
                custom_id=i.custom_id,
                style=i.style,
                emoji=i.emoji,
                disabled=i.disabled
            ))
        else:
            components.append(nextcord.ui.Select(
                placeholder=i.placeholder,
                options=i.options,
                disabled=i.disabled,
                max_values=i.max_values,
                min_values=i.min_values
            ))
    await msg.edit(view=build_view(components))

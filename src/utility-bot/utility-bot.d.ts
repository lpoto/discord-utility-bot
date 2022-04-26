import {
    ButtonInteraction,
    CommandInteraction,
    Message,
    SelectMenuInteraction,
} from 'discord.js';
import { CustomClientOptions } from '../common/common';
import * as Events from './events';

export type UtilityClientOptions = CustomClientOptions;

export type Event =
    | Events.OnReady.Type
    | Events.OnInteractionCreate.Type
    | Events.OnSlashCommand.Type
    | Events.OnHelpSlashCommand.Type
    | Events.OnPollSlashCommand.Type
    | Events.OnRolesSlashCommand.Type
    | Events.OnConfigSlashCommand.Type
    | Events.OnHandleRolesMessage.Type
    | Events.OnHelpSlashCommand.Type
    | Events.OnButtonClick.Type
    | Events.OnMessageDelete.Type
    | Events.OnMenuSelect.Type
    | Events.OnMessageCreate.Type
    | Events.OnError.Type;

interface HandleMessageOptions {
    type: 'create' | 'update';
    messageId: string;
    interaction?:
        | ButtonInteraction
        | SelectMenuInteraction
        | CommandInteraction;
    threadMessage?: Message;
    repliedMessage?: Message;
}

interface HandleRolesMessageOptions extends HandleMessageOptions {
    type: 'create' | 'update' | 'selectMenu' | 'reply' | 'buttonClick';
}

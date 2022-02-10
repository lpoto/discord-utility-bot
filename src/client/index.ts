import { ClientOptions, PermissionResolvable } from 'discord.js';
import { LanguageString } from '../translation';

export { MusicClient } from './client';

export interface MusicClientOptions extends ClientOptions {
    defaultLanguage: LanguageString;
    requiredMemberRoles: string[];
    clientVoicePermissions: PermissionResolvable[];
    clientTextPermissions: PermissionResolvable[];
}

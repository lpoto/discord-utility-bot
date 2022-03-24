import { ButtonInteraction } from 'discord.js';
import { CommandName } from '../../';
import { MusicClient } from '../client';

export class ActiveCommandsOptions {
    private client: MusicClient;
    private toDefer: {
        [guildId: string]: { [name: string]: ButtonInteraction[] };
    };

    public constructor(client: MusicClient) {
        this.client = client;
        this.toDefer = {};
    }

    public hasDeferOption(name: CommandName, guildId: string): boolean {
        return guildId in this.toDefer && name in this.toDefer[guildId];
    }

    public getToDeferOption(
        name: CommandName,
        guildId: string,
    ): ButtonInteraction[] | undefined {
        if (!(guildId in this.toDefer)) this.toDefer[guildId] = {};
        if (!(name in this.toDefer[guildId])) return undefined;
        return this.toDefer[guildId][name];
    }

    public addToDeferOption(
        name: CommandName,
        guildId: string,
        interaction?: ButtonInteraction,
    ): void {
        if (!(guildId in this.toDefer)) this.toDefer[guildId] = {};
        if (!(name in this.toDefer[guildId])) this.toDefer[guildId][name] = [];
        if (interaction) this.toDefer[guildId][name].push(interaction);
    }

    public deferInteractions(
        name: CommandName,
        guildId: string,
        doNotDefer?: boolean,
    ): void {
        if (!(guildId in this.toDefer)) return;
        if (!(name in this.toDefer[guildId])) return;
        if (!doNotDefer)
            for (const i of this.toDefer[guildId][name])
                i.deferUpdate().catch((e) => {
                    this.client.emitEvent('error', e);
                });
        delete this.toDefer[guildId][name];
    }

    public clearOptions(guildId: string) {
        if (guildId in this.toDefer) delete this.toDefer[guildId];
    }
}

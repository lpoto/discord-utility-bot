import { ButtonInteraction } from 'discord.js';
import { CommandName } from '../../';
import { MusicClient } from '../client';

export class ActiveCommandsOptions {
    private client: MusicClient;
    private toDefer: {
        [name: string]: { [guildId: string]: ButtonInteraction[] };
    };

    public constructor(client: MusicClient) {
        this.client = client;
        this.toDefer = {};
    }

    public hasDeferOption(name: CommandName, guildId: string): boolean {
        return name in this.toDefer && guildId in this.toDefer[name];
    }

    public getToDeferOption(
        name: CommandName,
        guildId: string,
    ): ButtonInteraction[] | undefined {
        if (!(name in this.toDefer)) this.toDefer[name] = {};
        if (!(guildId in this.toDefer[name])) return undefined;
        return this.toDefer[name][guildId];
    }

    public addToDeferOption(
        name: CommandName,
        guildId: string,
        interaction?: ButtonInteraction,
    ): void {
        if (!(name in this.toDefer)) this.toDefer[name] = {};
        if (!(guildId in this.toDefer[name])) this.toDefer[name][guildId] = [];
        if (interaction) this.toDefer[name][guildId].push(interaction);
    }

    public deferInteractions(
        name: CommandName,
        guildId: string,
        doNotDefer?: boolean,
    ): void {
        if (!(name in this.toDefer)) return;
        if (!(guildId in this.toDefer[name])) return;
        if (!doNotDefer)
            for (const i of this.toDefer[name][guildId])
                i.deferUpdate().catch((e) => {
                    this.client.emitEvent('error', e);
                });
        delete this.toDefer[name][guildId];
    }

    public clearOptions(guildId: string) {
        for (const name in Object.keys(this.toDefer)) {
            try {
                this.deferInteractions(name as CommandName, guildId, true);
            } catch (e) {
                continue;
            }
        }
    }
}

import { CommandInteraction } from 'discord.js';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnHelpSlashCommand extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(interaction: CommandInteraction): Promise<void> {
        this.eventQueue.addToQueue(interaction.id, () =>
            this.execute(interaction),
        );
    }

    private async execute(interaction: CommandInteraction): Promise<void> {
        let helpString: string = this.translate(['utility', 'name']);
        const spacer = '\n> \u3000\u3000-\u2000';
        helpString += '  ' + this.client.version + '\n\n';
        helpString += this.client.translator
            .getFullLanguage()
            .utility.slashCommands.map((c) => {
                let s = `> \`/${c.name}\`: ${c.description}`;
                if (c.help && c.help.length > 0)
                    s += spacer + c.help.join(spacer);
                return s;
            })
            .join('\n');
        interaction
            .reply({
                content: helpString,
                ephemeral: true,
            })
            .catch((e) => this.client.emitEvent('error', e));
    }
}

export namespace OnHelpSlashCommand {
    export type Type = [
        'helpSlashCommand',
        ...Parameters<OnHelpSlashCommand['callback']>,
    ];
}

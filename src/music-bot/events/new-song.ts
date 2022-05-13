import { NewSongOptions } from '../music-bot';
import { MusicClient } from '../client';
import { CustomAudioPlayer, SongFinder } from '../utils';
import { Queue, Song } from '../entities';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnNewSong extends AbstractMusicEvent {
    private songsToUpdateCount: {
        [guildId: string]: { [key in 'toUpdate' | 'updated']: number };
    };
    private songsToUpdate: {
        [guildId: string]: { [key: number]: Song[] };
    };

    public constructor(client: MusicClient) {
        super(client);
        this.songsToUpdate = {};
        this.songsToUpdateCount = {};
    }

    public async callback(options: NewSongOptions): Promise<void> {
        if (!this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            guildId: options.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;

        this.client.logger.debug(
            `Adding ${options.songNames.length} song/s in`,
            `guild '${options.guildId}'`,
        );

        // limit songs
        if (queue.size >= 10000) {
            this.client.logger.debug(
                `Queue in guild '${options.guildId}' has over 10000 songs`,
            );
            return;
        }
        const songs: string[] = options.songNames.slice(0, 1000);

        if (
            !(queue.guildId in this.songsToUpdateCount) ||
            this.songsToUpdateCount[queue.guildId].toUpdate === undefined ||
            this.songsToUpdateCount[queue.guildId].updated === undefined
        ) {
            this.songsToUpdateCount[queue.guildId] = {
                toUpdate: 0,
                updated: 0,
            };
        }

        this.songsToUpdateCount[queue.guildId].toUpdate += songs.length;

        for (let i = 0; i < songs.length; i++) {
            /* filter songs, if both name and url provided, extract url
             * else it will be determined when fetchign songs from youtube
             * */
            const s: string = songs[i];
            let n: string = s.trim();
            if (n[0] === '{' && n.includes('url:')) {
                n = s.substring(1, n.length - 1);
                n = n.split('url:')[1].split(',')[0].trim();
            }
            if (
                (n[0] === '"' && n[n.length - 1] === '"') ||
                // eslint-disable-next-line
                (n[0] === "'" && n[n.length - 1] === "'") ||
                (n[0] === '`' && n[n.length - 1] === '`')
            )
                n = n.substring(1, n.length - 1);
            new SongFinder(n, this.client).getSongs().then((songs2) => {
                if (songs2 && songs2.length > 0) {
                    if (!(queue.guildId in this.songsToUpdate))
                        this.songsToUpdate[queue.guildId] = {};
                    this.songsToUpdate[queue.guildId][i] = songs2;
                    this.checkIfNeedsUpdate(
                        queue.guildId,
                        songs2.length,
                        options.toFront,
                    );
                } else {
                    this.songsToUpdateCount[queue.guildId].updated += 1;
                }
            });
        }
    }

    private checkIfNeedsUpdate(
        guildId: string,
        add?: number,
        toFront?: boolean,
    ): void {
        if (
            !this.client.user ||
            !this.songsToUpdateCount[guildId] ||
            this.songsToUpdateCount[guildId].updated === undefined
        )
            return;
        if (add) {
            if (add > 1) this.songsToUpdateCount[guildId].toUpdate += add - 1;
            this.songsToUpdateCount[guildId].updated += add;
        }
        const updateAndDelete: boolean =
            this.songsToUpdateCount[guildId].updated ===
            this.songsToUpdateCount[guildId].toUpdate;
        const onlyUpdate: boolean = updateAndDelete
            ? false
            : (this.songsToUpdateCount[guildId].updated + 1) % 200 === 0;
        if (updateAndDelete || onlyUpdate) {
            if (updateAndDelete) delete this.songsToUpdateCount[guildId];
            if (!(guildId in this.songsToUpdate))
                this.songsToUpdate[guildId] = {};
            let songs: Song[] = [];
            for (const s of Object.values(this.songsToUpdate[guildId]))
                songs = songs.concat(s);
            Song.saveAll(songs, guildId, this.client.user.id, toFront)
                .then(() => {
                    if (!this.client.user) return;
                    Queue.findOne({
                        guildId: guildId,
                        clientId: this.client.user.id,
                    }).then((queue) => {
                        if (!queue) return;
                        const audioPlayer: CustomAudioPlayer | null =
                            this.client.getAudioPlayer(guildId);
                        if (
                            !audioPlayer ||
                            (!audioPlayer.playing && audioPlayer.paused)
                        ) {
                            this.client.emitEvent('executeCommand', {
                                name: 'Play',
                                guildId: guildId,
                            });
                        }
                    });
                })
                .catch((e) => {
                    if (guildId in this.songsToUpdate)
                        delete this.songsToUpdate[guildId];
                    this.client.emitEvent('error', e);
                });
            delete this.songsToUpdate[guildId];
        }
    }
}

export namespace OnNewSong {
    export type Type = ['newSong', ...Parameters<OnNewSong['callback']>];
}

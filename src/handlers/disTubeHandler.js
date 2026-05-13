const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendMusicMessage, editMusicMessage } = require('../utils/musicWebhook');
const { generateMusicPanel } = require('../utils/musicUI');

module.exports = (client) => {
    client.distube
        .on('playSong', async (queue, song) => {
            const { embeds, components } = generateMusicPanel(queue);

            const handle = await sendMusicMessage(queue.textChannel, embeds, components);
            if (client.emitMusicUpdate) client.emitMusicUpdate(queue.id);

            const currentMsgId = handle.msg?.id;
            queue._activeMessageId = currentMsgId;
            queue._lastHandle = handle;

            if (queue._liveInterval) clearInterval(queue._liveInterval);
            if (!handle.msg) return;

            queue._liveInterval = setInterval(async () => {
                try {
                    if (queue._activeMessageId !== currentMsgId) return clearInterval(queue._liveInterval);
                    const currentQueue = client.distube.getQueue(queue.textChannel.guildId);
                    if (!currentQueue || !currentQueue.songs.length || currentQueue.paused) return;

                    const { embeds: updateEmbeds, components: updateComponents } = generateMusicPanel(currentQueue);
                    await editMusicMessage(handle, updateEmbeds, updateComponents);
                } catch (err) { clearInterval(queue._liveInterval); }
            }, 10000);
        })
        .on('addSong', async (queue, song) => {
            const embed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle('✅ เพิ่มเพลงเข้าคิวแล้ว!')
                .setDescription(`**[${song.name}](${song.url})**`)
                .setThumbnail(song.thumbnail || null);
            queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
            if (client.emitMusicUpdate) client.emitMusicUpdate(queue.id);
        })
        .on('addList', async (queue, playlist) => {
            const embed = new EmbedBuilder()
                .setColor(0x3B82F6)
                .setTitle('📑 เพิ่มเพลย์ลิสต์แล้ว!')
                .setDescription(`**[${playlist.name}](${playlist.url})**`);
            queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
            if (client.emitMusicUpdate) client.emitMusicUpdate(queue.id);
        })
        .on('finishSong', async (queue, song) => {
            if (queue._liveInterval) clearInterval(queue._liveInterval);
        })
        .on('error', (error, queueOrChannel) => {
            if (queueOrChannel?._liveInterval) clearInterval(queueOrChannel._liveInterval);
            if (queueOrChannel?.guildId && client.emitMusicUpdate) client.emitMusicUpdate(queueOrChannel.guildId);
        })
        .on('empty', async queue => {
            if (queue._liveInterval) clearInterval(queue._liveInterval);

            if (queue._lastHandle?.msg) {
                try {
                    const disabledRows = queue._lastHandle.msg.components.map(row => {
                        return new ActionRowBuilder().addComponents(
                            row.components.map(comp => ButtonBuilder.from(comp).setDisabled(true))
                        );
                    });

                    await editMusicMessage(
                        queue._lastHandle,
                        [new EmbedBuilder().setColor(0xEF4444).setDescription('❌ คิวเพลงว่างแล้วเมี๊ยว! กด /music show ใหม่เพื่อเรียกแผงควบคุมอีกครั้ง')],
                        disabledRows
                    );
                } catch (e) {
                    // ignore
                }
            }

            if (client.emitMusicUpdate) client.emitMusicUpdate(queue.id);
        });
};

function makeProgressBar(current, total) {
    const size = 15;
    const progress = Math.min(Math.round((current / total) * size), size);
    return `\`${fmt(current)}\` ${'▓'.repeat(progress)}${'░'.repeat(size - progress)} \`${fmt(total)}\``;
}

function fmt(sec) {
    if (!sec || sec < 0) return '0:00';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

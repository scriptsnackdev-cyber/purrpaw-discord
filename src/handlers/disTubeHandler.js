const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendMusicMessage, editMusicMessage } = require('../utils/musicWebhook');

module.exports = (client) => {
    client.distube
        .on('playSong', async (queue, song) => {
            const current = queue.currentTime;
            const total = song.duration;
            const progress = total > 0 ? makeProgressBar(current, total) : '🔴 ถ่ายทอดสด (LIVE)';

            const embed = new EmbedBuilder()
                .setColor(0x7C3AED)
                .setDescription(`**[${song.name}](${song.url})**`)
                .addFields({ name: '📊 ความคืบหน้า', value: progress })
                .setThumbnail(song.thumbnail || null)
                .setTimestamp();

            if (song.uploader?.name) embed.setAuthor({ name: `📺 ${song.uploader.name}` });

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_leave').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_mute').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('music_autoplay').setLabel('📻 Auto').setStyle(queue.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_queue_btn').setLabel('📋 คิว').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_add_modal').setLabel('➕ เพิ่มเพลง').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setLabel('🌐 เว็บควบคุม')
                    .setURL(`${process.env.WEB_BASE_URL || 'http://localhost:3000'}/music-panel?guildId=${queue.textChannel.guildId}`)
                    .setStyle(ButtonStyle.Link),
            );

            const handle = await sendMusicMessage(queue.textChannel, [embed], [row1, row2]);
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

                    const songNow = currentQueue.songs[0];
                    const pb = songNow.duration > 0 ? makeProgressBar(currentQueue.currentTime, songNow.duration) : '🔴 LIVE';

                    const updateEmbed = new EmbedBuilder()
                        .setColor(0x7C3AED)
                        .setDescription(`**[${songNow.name}](${songNow.url})**`)
                        .setThumbnail(songNow.thumbnail || null)
                        .addFields({ name: '📊 ความคืบหน้า', value: pb })
                        .setTimestamp();
                    if (songNow.uploader?.name) updateEmbed.setAuthor({ name: `📺 ${songNow.uploader.name}` });

                    await editMusicMessage(handle, [updateEmbed]);
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

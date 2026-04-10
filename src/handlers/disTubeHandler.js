const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendMusicMessage, editMusicMessage } = require('../utils/musicWebhook');

module.exports = (client) => {
    client.distube
        // ── กำลังเล่นเพลง ──
        .on('playSong', async (queue, song) => {
            const current = queue.currentTime;
            const total = song.duration;
            const progress = total > 0 ? makeProgressBar(current, total) : '🔴 ถ่ายทอดสด (LIVE)';

            const embed = new EmbedBuilder()
                .setColor(0x7C3AED)
                .setDescription(`**[${song.name}](${song.url})**`)
                .addFields(
                    { name: '📊 ความคืบหน้า', value: progress }
                )
                .setThumbnail(song.thumbnail || null)
                .setTimestamp();

            if (song.uploader?.name) {
                embed.setAuthor({ name: `📺 ${song.uploader.name}` });
            }

            // --- 🎮 สร้างปุ่มควบคุมเพลง (Music Controller) ---
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
            );

            // ส่งข้อความผ่าน musicWebhook (Persona ถ้าตั้งไว้ หรือ Default)🐾
            const handle = await sendMusicMessage(queue.textChannel, [embed], [row1, row2]);

            // เก็บ ID ข้อความที่ "ทำงานอยู่" ในปัจจุบันไว้เมี๊ยว🐾
            const currentMsgId = handle.msg?.id;
            queue._activeMessageId = currentMsgId;
            queue._lastHandle = handle;
            queue._lastSong = song;

            // --- ⏱️ LIVE TIMER: อัปเดตเวลาทุก 10 วินาทีเมี๊ยว ---
            if (queue._liveInterval) clearInterval(queue._liveInterval);
            if (!handle.msg) return;

            queue._liveInterval = setInterval(async () => {
                try {
                    // 🛡️ ระบบป้องกันข้ามเพลงเมี๊ยว: ถ้าข้อความนี้ไม่ใช่ข้อความล่าสุดของคิวแล้ว ให้หยุดเมี๊ยว🐾
                    if (queue._activeMessageId !== currentMsgId) {
                        return clearInterval(queue._liveInterval);
                    }

                    const currentQueue = client.distube.getQueue(queue.textChannel.guildId);
                    if (!currentQueue || !currentQueue.songs.length) {
                        return clearInterval(queue._liveInterval);
                    }
                    if (currentQueue.paused) return;

                    const songNow = currentQueue.songs[0];
                    const currentTime = currentQueue.currentTime;
                    const totalTime = songNow.duration;
                    // ปัดเวลาให้ลงตัว 10 วินาทีเมี๊ยว🐾 (0:10, 0:20, ...)
                    const displayTime = Math.floor(currentTime / 10) * 10;
                    const pb = totalTime > 0 ? makeProgressBar(displayTime, totalTime) : '🔴 ถ่ายทอดสด (LIVE)';

                    const updateEmbed = new EmbedBuilder()
                        .setColor(0x7C3AED)
                        .setDescription(`**[${songNow.name}](${songNow.url})**`)
                        .setThumbnail(songNow.thumbnail || null)
                        .addFields(
                            { name: '📊 ความคืบหน้า', value: pb }
                        )
                        .setTimestamp();

                    if (songNow.uploader?.name) {
                        updateEmbed.setAuthor({ name: `📺 ${songNow.uploader.name}` });
                    }

                    // ใช้ editMusicMessage ที่รองรับทั้ง Webhook และ Normal Message🐾
                    await editMusicMessage(handle, [updateEmbed]);

                } catch (err) {
                    console.error('Timer Update Error:', err);
                    clearInterval(queue._liveInterval);
                }
            }, 10000);
        })

        // ── เพิ่มเพลงลงคิว ──
        .on('addSong', async (queue, song) => {
            const position = queue.songs.length - 1;
            const embed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle('✅ เพิ่มเพลงเข้าคิวให้แล้วนะเมี๊ยว!')
                .setDescription(`**[${song.name}](${song.url})**`)
                .addFields(
                    { name: '⏱️ ความยาว', value: `\`${fmt(song.duration)}\``, inline: true },
                    { name: '📋 ลำดับที่', value: `#${position}`, inline: true },
                    { name: '👤 เพิ่มโดยคุณ', value: `${song.member?.displayName || song.user?.tag || 'ทาสแมวไม่ระบุตัวตน'}`, inline: true },
                )
                .setThumbnail(song.thumbnail || null);

            queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
        })

        // ── เพิ่ม Playlist ──
        .on('addList', async (queue, playlist) => {
            const embed = new EmbedBuilder()
                .setColor(0x3B82F6)
                .setTitle('📑 เพิ่มเพลย์ลิสต์เข้าคิวให้แล้วเมี๊ยว!')
                .setDescription(`**[${playlist.name}](${playlist.url || 'N/A'})**`)
                .addFields(
                    { name: '🎵 จำนวนเพลง', value: `${playlist.songs.length}`, inline: true },
                    { name: '⏱️ ความยาวรวม', value: `\`${fmt(playlist.songs.reduce((a, s) => a + s.duration, 0))}\``, inline: true },
                    { name: '👤 เพิ่มโดยคุณ', value: `${playlist.songs[0]?.member?.displayName || 'ทาสแมวไม่ระบุตัวตน'}`, inline: true },
                )
                .setThumbnail(playlist.thumbnail || null);

            queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
        })

        // ── จบเพลงแต่ละเพลง ──
        .on('finishSong', async (queue, song) => {
            // เมื่อจบเพลง ให้หยุดเดินเวลาและเซ็ต Progress ให้เต็ม 100% เมี๊ยว🐾
            if (queue._liveInterval) clearInterval(queue._liveInterval);
            
            if (queue._lastHandle) {
                const fullBar = makeProgressBar(song.duration, song.duration);
                const doneEmbed = new EmbedBuilder()
                    .setColor(0x6B7280)
                    .setDescription(`**[${song.name}](${song.url})**`)
                    .setThumbnail(song.thumbnail || null)
                    .addFields(
                        { name: '📊 ความคืบหน้า', value: fullBar }
                    )
                    .setTimestamp();

                if (song.uploader?.name) {
                    doneEmbed.setAuthor({ name: `📺 ${song.uploader.name}` });
                }

                await editMusicMessage(queue._lastHandle, [doneEmbed]).catch(() => {});
            }
        })

        // ── Error Handling ──
        .on('error', (error, queueOrChannel) => {
            console.error('--- DisTube Error ---');
            console.error(error);
            
            if (queueOrChannel?._liveInterval) clearInterval(queueOrChannel._liveInterval);

            const textChannel = queueOrChannel?.textChannel || 
                                 (queueOrChannel?.send ? queueOrChannel : null);
            
            if (textChannel?.send) {
                const msg = error.message || error.toString() || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุเมี๊ยว...';
                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setTitle('❌ มีปัญหาเกิดขึ้นกับเสียงเพลงเมี๊ยว!')
                    .setDescription(`\`\`\`${msg.slice(0, 1900)}\`\`\``)
                    .setTimestamp();
                textChannel.send({ embeds: [embed] }).catch(() => {});
            }
        })

        // ── ห้องเสียงว่าง ──
        .on('empty', queue => {
            if (queue._liveInterval) clearInterval(queue._liveInterval);
            const embed = new EmbedBuilder()
                .setColor(0xF59E0B)
                .setDescription('💨 ห้องเงียบเหงาเกินไปแล้วเมี๊ยว... บอทขอกลับบ้านก่อนนะ🐾');
            queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
        })

        // ── เล่นเพลงจบหมดคิว ──
        .on('finish', async queue => {
            if (queue._liveInterval) {
                clearInterval(queue._liveInterval);
                // อัปเดต progress bar เป็นเต็มก่อนเมี๊ยว🐾
                if (queue._lastHandle && queue._lastSong) {
                    const s = queue._lastSong;
                    const fullBar = makeProgressBar(s.duration, s.duration);
                    const doneEmbed = new EmbedBuilder()
                        .setColor(0x6B7280)
                        .setDescription(`**[${s.name}](${s.url})**`)
                        .setThumbnail(s.thumbnail || null)
                        .addFields(
                            { name: '📊 ความคืบหน้า', value: fullBar }
                        )
                        .setTimestamp();
                    await editMusicMessage(queue._lastHandle, [doneEmbed]).catch(() => {});
                }
            }
            const embed = new EmbedBuilder()
                .setColor(0x6B7280)
                .setDescription('🏁 เพลงในคิวหมดแล้วเมี๊ยว! เพิ่มเพลงใหม่ได้ด้วยคำสั่ง `/music play` นะ🐾');
            queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
        })

        // ── ไม่เจอเพลง ──
        .on('searchNoResult', (message, query) => {
            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setDescription(`❌ แงง หาเพลง \`${query}\` ไม่เจอเลยเเมี๊ยวว!`);
            message.channel?.send({ embeds: [embed] }).catch(() => {});
        })

        // ── ตัดการเชื่อมต่อ ──
        .on('disconnect', queue => {
            if (queue._liveInterval) clearInterval(queue._liveInterval);
            const embed = new EmbedBuilder()
                .setColor(0x6B7280)
                .setDescription('🔌 บอทถูกตัดการเชื่อมต่อจากห้องพูดคุยแล้วนะเมี๊ยวว!🐾');
            queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
        });
};

function fmt(sec) {
    if (!sec || sec === 0) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function makeProgressBar(current, total, size = 15) {
    const percent = Math.min(current / total, 1);
    const filled = Math.round(size * percent);
    const bar = '▓'.repeat(filled) + '░'.repeat(size - filled);
    return `\`${fmt(current)}\` ${bar} \`${fmt(total)}\``;
}

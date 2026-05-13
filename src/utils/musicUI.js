const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * สร้าง Embed และ Components สำหรับแผงควบคุมเพลงเมี๊ยว🐾
 * @param {import('distube').Queue} queue 
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function generateMusicPanel(queue) {
    if (!queue || !queue.songs.length) {
        return {
            embeds: [new EmbedBuilder().setColor(0xEF4444).setDescription('❌ ตอนนี้ไม่มีเพลงกำลังเล่นอยู่แล้วเมี๊ยว!')],
            components: []
        };
    }

    const song = queue.songs[0];
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
        new ButtonBuilder()
            .setCustomId('music_pause')
            .setEmoji(queue.paused ? '▶️' : '⏸️')
            .setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_leave').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('music_loop')
            .setEmoji('🔁')
            .setStyle(queue.repeatMode > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_mute')
            .setEmoji(queue.volume === 0 ? '🔇' : '🔊')
            .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_autoplay')
            .setLabel('📻 Auto')
            .setStyle(queue.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_queue_btn').setLabel('📋 คิว').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_add_modal').setLabel('➕ เพิ่มเพลง').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel('🌐 เว็บควบคุม')
            .setURL(`${process.env.WEB_BASE_URL || 'http://localhost:3000'}/music-panel?guildId=${queue.id}`)
            .setStyle(ButtonStyle.Link),
    );

    return { embeds: [embed], components: [row1, row2] };
}

function makeProgressBar(current, total) {
    const size = 15;
    const progress = Math.min(Math.round((current / total) * size), size);
    const bar = '▓'.repeat(progress) + '░'.repeat(size - progress);
    return `\`${fmt(current)}\` ${bar} \`${fmt(total)}\``;
}

function fmt(sec) {
    if (!sec || sec < 0) return '0:00';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

module.exports = { generateMusicPanel, makeProgressBar, fmt };

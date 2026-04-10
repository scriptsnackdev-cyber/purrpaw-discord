const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('🎵 คำสั่งเครื่องเล่นเพลงของเจ้าเหมียว')
        
        // ── เล่นเพลง ──
        .addSubcommand(sub => 
            sub.setName('play')
                .setDescription('🎶 เล่นเพลง (หรือเพิ่มเข้าคิวถ้ากำลังเล่นอยู่เมี๊ยว)')
                .addStringOption(opt => 
                    opt.setName('query').setDescription('ชื่อเพลงหรือลิงก์ YouTube เมี๊ยว').setRequired(true)))

        // ── เพิ่มเพลงเข้าคิว ──
        .addSubcommand(sub => 
            sub.setName('add')
                .setDescription('➕ เพิ่มเพลงเข้าคิวเมี๊ยว')
                .addStringOption(opt => 
                    opt.setName('query').setDescription('ชื่อเพลงหรือลิงก์ YouTube เมี๊ยว').setRequired(true)))

        // ── ดูคิว ──
        .addSubcommand(sub => 
            sub.setName('queue')
                .setDescription('📋 ดูคิวเพลงที่กำลังต่อแถวอยู่เมี๊ยว'))

        // ── ดูเพลงที่กำลังเล่น ──
        .addSubcommand(sub => 
            sub.setName('nowplaying')
                .setDescription('🎧 ดูรายละเอียดเพลงที่กำลังเล่นอยู่ตอนนี้เมี๊ยว'))

        // ── ลบเพลงจากคิว ──
        .addSubcommand(sub => 
            sub.setName('remove')
                .setDescription('🗑️ เอาเพลงออกจากคิวเมี๊ยว')
                .addIntegerOption(opt => 
                    opt.setName('position').setDescription('ลำดับในคิว (ดูจาก /music queue)เมี๊ยว').setRequired(true).setMinValue(1)))

        // ── ย้ายตำแหน่งเพลงในคิว ──
        .addSubcommand(sub => 
            sub.setName('move')
                .setDescription('↕️ ย้ายลำดับเพลงในคิวเมี๊ยว')
                .addIntegerOption(opt => 
                    opt.setName('from').setDescription('ตำแหน่งเดิมเมี๊ยว').setRequired(true).setMinValue(1))
                .addIntegerOption(opt => 
                    opt.setName('to').setDescription('ตำแหน่งใหม่เมี๊ยว').setRequired(true).setMinValue(1)))

        // ── ข้ามเพลง ──
        .addSubcommand(sub => 
            sub.setName('skip')
                .setDescription('⏭️ ข้ามเพลงนี้ไปเมี๊ยว'))

        // ── ย้อนกลับเพลงก่อนหน้า ──
        .addSubcommand(sub => 
            sub.setName('previous')
                .setDescription('⏮️ ย้อนไปฟังเพลงก่อนหน้าเมี๊ยว'))

        // ── หยุดชั่วคราว ──
        .addSubcommand(sub => 
            sub.setName('pause')
                .setDescription('⏸️ พักหายใจแป๊บ (หยุดชั่วคราวเมี๊ยว)'))

        // ── เล่นต่อ ──
        .addSubcommand(sub => 
            sub.setName('resume')
                .setDescription('▶️ เล่นเพลงต่อเลยเมี๊ยว!'))

        // ── หยุดเพลง + ออกจากช่อง ──
        .addSubcommand(sub => 
            sub.setName('leave')
                .setDescription('⏹️ สั่งให้บอทออกจากห้องพูดคุย (Disconnect) เมี๊ยว'))

        // ── ปรับเสียง ──
        .addSubcommand(sub => 
            sub.setName('volume')
                .setDescription('🔊 ปรับระดับความดังของเสียงเมี๊ยว')
                .addIntegerOption(opt => 
                    opt.setName('percent').setDescription('ระดับเสียง (1–100) เมี๊ยว').setRequired(true).setMinValue(1).setMaxValue(100)))

        // ── วนซ้ำ ──
        .addSubcommand(sub => 
            sub.setName('loop')
                .setDescription('🔁 ตั้งค่าการเล่นวนซ้ำเมี๊ยว')
                .addStringOption(opt => 
                    opt.setName('mode').setDescription('โหมดการวนซ้ำเmi๊ยว').setRequired(true)
                        .addChoices(
                            { name: '❌ ปิด', value: '0' },
                            { name: '🔂 วนเพลงเดียว', value: '1' },
                            { name: '🔁 วนทั้งคิว', value: '2' })))

        // ── สุ่มคิว ──
        .addSubcommand(sub => 
            sub.setName('shuffle')
                .setDescription('🔀 สลับคิวเพลงแบบสุ่มเมี๊ยว'))

        // ── ข้ามไปตำแหน่งในเพลง ──
        .addSubcommand(sub => 
            sub.setName('seek')
                .setDescription('⏩ ข้ามไปยังวินาทีที่ต้องการเมี๊ยว')
                .addIntegerOption(opt => 
                    opt.setName('seconds').setDescription('ตำแหน่งวินาทีที่ต้องการเมี๊ยว').setRequired(true).setMinValue(0)))

        // ── ล้างคิวทั้งหมด ──
        .addSubcommand(sub => 
            sub.setName('clear')
                .setDescription('🧹 ล้างคิวเพลงทั้งหมดที่ต่อแถวอยู่เมี๊ยว (แต่ยังเล่นเพลงเดิมอยู่นะ🐾)'))

        // ── เปิด/ปิด Auto-Play ──
        .addSubcommand(sub => 
            sub.setName('autoplay')
                .setDescription('📻 เปิด/ปิด ระบบเล่นเพลงต่อเนื่องเมี๊ยว'))

        // ── ตั้งค่า Persona สำหรับ Music Bot ──
        .addSubcommand(sub => 
            sub.setName('settings')
                .setDescription('⚙️ ตั้งค่าตัวตนของแมวนักดนตรีเมี๊ยว (Admin เท่านั้นเมี๊ยว)')
                .addStringOption(opt => 
                    opt.setName('name').setDescription('ชื่อที่จะให้บอทใช้แสดงเมี๊ยว').setRequired(false))
                .addStringOption(opt => 
                    opt.setName('avatar').setDescription('ลิงก์รูปโปรไฟล์ที่จะให้บอทใช้เมี๊ยว').setRequired(false))
                .addStringOption(opt =>
                    opt.setName('action').setDescription('การทำงานพิเศษเมี๊ยว').setRequired(false)
                        .addChoices(
                            { name: '👀 ดูการตั้งค่าปัจจุบัน', value: 'view' },
                            { name: '🗑️ รีเซ็ตเป็นค่าเริ่มต้น', value: 'reset' })))
        
        // ── เรียกแผงควบคุมใหม่ ──
        .addSubcommand(sub => 
            sub.setName('show')
            .setDescription('🎧 เรียกแผงควบคุมเพลง (Control Panel) มาใหม่เมี๊ยว')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { member, guild, channel, client } = interaction;

        // ── เรียกแผงใหม่ (SUMMON UI) เมี๊ยว🐾 ──
        if (sub === 'show') {
            const queue = client.distube.getQueue(guild.id);
            if (!queue) return interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่นอยู่ตอนนี้นะเมี๊ยว!', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });

            try {
                // ดึง Logic จาก disTubeHandler มาใช้เพื่อสร้าง UI ใหม่เมี๊ยว🐾
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const { sendMusicMessage } = require('../../utils/musicWebhook');
                const song = queue.songs[0];
                const totalTime = song.duration;
                const currentTime = queue.currentTime;
                
                // --- PROGRESS BAR: ใช้ฟังก์ชันเดียวกับใน Handler แต่ก๊อปมาไว้นี่เพื่อความง่ายเมี๊ยว🐾 ---
                const makeProgressBar = (current, total) => {
                    const size = 15;
                    const percent = current / total;
                    const progress = Math.round(size * percent);
                    const emptyProgress = size - progress;
                    const progressText = '▓'.repeat(progress);
                    const emptyProgressText = '░'.repeat(emptyProgress);
                    const fmt = (s) => {
                        const m = Math.floor(s / 60);
                        const sec = Math.floor(s % 60);
                        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
                    };
                    return `\`${fmt(current)}\` ${progressText}${emptyProgressText} \`${fmt(total)}\``;
                };

                const pb = totalTime > 0 ? makeProgressBar(currentTime, totalTime) : '🔴 ถ่ายทอดสด (LIVE)';

                const embed = new EmbedBuilder()
                    .setColor(0x7C3AED)
                    .setDescription(`**[${song.name}](${song.url})**`)
                    .setThumbnail(song.thumbnail || null)
                    .addFields({ name: '📊 ความคืบหน้า', value: pb })
                    .setTimestamp();

                if (song.uploader?.name) embed.setAuthor({ name: `📺 ${song.uploader.name}` });

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_pause').setEmoji(queue.paused ? '▶️' : '⏸️').setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_leave').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(queue.repeatMode > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_mute').setEmoji(queue.volume === 0 ? '🔇' : '🔊').setStyle(ButtonStyle.Secondary),
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('music_autoplay').setLabel('📻 Auto').setStyle(queue.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_queue_btn').setLabel('📋 คิว').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_add_modal').setLabel('➕ เพิ่มเพลง').setStyle(ButtonStyle.Secondary),
                );

                const handle = await sendMusicMessage(channel, [embed], [row1, row2]);
                
                // ⭐ ย้าย TIMER: อัปเดต ID เพื่อให้ Timer ทำงานต่อที่ข้อความใหม่เมี๊ยว🐾
                queue._activeMessageId = handle.msg?.id;
                queue._lastHandle = handle;
                queue._lastSong = song;

                return interaction.editReply('✅ เรียกแผงควบคุมพรีเมียมมาให้แล้วนะเมี๊ยวว!🐾🌸');
            } catch (err) {
                console.error('Music Show Error:', err);
                return interaction.editReply('❌ เกิดข้อผิดพลาดในการเรียกแผงควบคุมเมี๊ยว...');
            }
        }

        // ────────────────────────────────
        // ⚙️ SETTINGS (ไม่ต้องอยู่ใน voice channel)
        // ────────────────────────────────
        if (sub === 'settings') {
            // ต้องเป็น Admin (Manage Guild)
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ **Manage Server** ก่อนนะเมี๊ยว!', flags: 64 });
            }

            const action = interaction.options.getString('action');
            const newName = interaction.options.getString('name');
            const newAvatar = interaction.options.getString('avatar');

            // 👀 View current settings
            if (action === 'view' || (!action && !newName && !newAvatar)) {
                const { data } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
                const s = data?.settings || {};
                const embed = new EmbedBuilder()
                    .setColor(0x7C3AED)
                    .setTitle('⚙️ ตั้งค่าแมวนักดนตรีเมี๊ยว')
                    .addFields(
                        { name: '📛 ชื่อบอท', value: s.bot_name || '*(เริ่มต้น)*', inline: true },
                        { name: '🖼️ ลิงก์รูปโปรไฟล์', value: s.bot_avatar ? `[จิ้มตรงนี้](${s.bot_avatar})` : '*(เริ่มต้น)*', inline: true },
                    )
                    .setThumbnail(s.bot_avatar || interaction.client.user.displayAvatarURL())
                    .setFooter({ text: 'ใช้ /music settings name:"ชื่อใหม่" avatar:"ลิงก์รูป" เพื่อเปลี่ยนนะเมี๊ยว🐾' });
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            // 🗑️ Reset to default
            if (action === 'reset') {
                await supabase.from('guilds').update({
                    settings: supabase.raw(`settings || '{"bot_name": "", "bot_avatar": ""}'::jsonb`),
                }).eq('id', guild.id);

                const { data: current } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
                const updated = { ...(current?.settings || {}), bot_name: '', bot_avatar: '' };
                await supabase.from('guilds').update({ settings: updated }).eq('id', guild.id);

                return interaction.reply({ content: '🗑️ รีเซ็ตตัวตนแมวนักดนตรีเป็นค่าเริ่มต้นเรียบร้อยแล้วเมี๊ยว!', flags: 64 });
            }

            // ✏️ Update settings
            const { data: current } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
            const settings = { ...(current?.settings || {}) };
            if (newName) settings.bot_name = newName;
            if (newAvatar) settings.bot_avatar = newAvatar;

            await supabase.from('guilds').update({ settings }).eq('id', guild.id);

            const embed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle('✅ อัปเดตการตั้งค่าสำเร็จแล้วเมี๊ยว!')
                .addFields(
                    { name: '📛 ชื่อบอท', value: settings.bot_name || '*(เริ่มต้น)*', inline: true },
                    { name: '🖼️ รูปโปรไฟล์', value: settings.bot_avatar ? `[จิ้มตรงนี้](${settings.bot_avatar})` : '*(เริ่มต้น)*', inline: true },
                )
                .setThumbnail(settings.bot_avatar || interaction.client.user.displayAvatarURL())
                .setFooter({ text: 'ข้อความแจ้งเตือนเพลงจะใช้ข้อมูลนี้ผ่าน Webhook นะเมี๊ยว🐾' });

            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // เช็คว่าคนใช้อยู่ใน voice channel (สำหรับคำสั่งอื่นๆ)
        if (!member.voice.channel) {
            return interaction.reply({ content: '❌ คุณต้องเข้าห้องพูดคุย (Voice Channel) ก่อนนะเเมี๊ยว!', flags: 64 });
        }

        const distube = interaction.client.distube;
        const queue = distube.getQueue(guild.id);

        // ────────────────────────────────
        // 🎵 PLAY / ADD
        // ────────────────────────────────
        if (sub === 'play' || sub === 'add') {
            const query = interaction.options.getString('query');
            
            // ใช้ deferReply (ephemeral)
            await interaction.deferReply({ flags: 64 });
            
            try {
                await distube.play(member.voice.channel, query, {
                    textChannel: interaction.channel,
                    member: member,
                });
                await interaction.editReply(`✅ กำลังค้นหาและเตรียมเพลง \`${query}\` ให้อยู่นะเมี๊ยวว!🐾`);
            } catch (error) {
                console.error('Music Play Error:', error);
                await interaction.editReply(`❌ เล่นเพลงไม่ได้เมี๊ยวว: \`${error.message}\``);
            }
            return;
        }

        // ────────────────────────────────
        // 📋 QUEUE
        // ────────────────────────────────
        if (sub === 'queue') {
            if (!queue || !queue.songs.length) {
                return interaction.reply({ content: '📭 คิวเพลงว่างเปล่าเลยเมี๊ยว!', flags: 64 });
            }

            const current = queue.songs[0];
            const upcoming = queue.songs.slice(1);
            const loopModes = ['❌ ปิด', '🔂 วนเพลงเดียว', '🔁 วนทั้งคิว'];

            const embed = new EmbedBuilder()
                .setColor(0x7C3AED)
                .setTitle('🎶 คิวเพลงของบ้านเราเมี๊ยว')
                .setDescription(
                    `**กำลังเล่น:**\n` +
                    `🎵 [${current.name}](${current.url}) — \`${fmt(current.duration)}\`\n` +
                    `*ขอโดยคุณ ${current.member?.displayName || 'ทาสแมวไม่ระบุตัวตน'}*`
                )
                .setThumbnail(current.thumbnail || null)
                .setFooter({ 
                    text: `รวมทั้งสิ้น ${queue.songs.length} เพลง • ` +
                          `ความยาวรวม: ${fmt(queue.songs.reduce((a, s) => a + s.duration, 0))} • ` +
                          `เสียง: ${queue.volume}% • วนซ้ำ: ${loopModes[queue.repeatMode] || 'ปิด'}`
                });

            if (upcoming.length > 0) {
                const list = upcoming.slice(0, 15).map((s, i) => 
                    `**${i + 1}.** [${trunc(s.name, 42)}](${s.url}) — \`${fmt(s.duration)}\``
                ).join('\n');
                const extra = upcoming.length > 15 ? `\n*...และอีก ${upcoming.length - 15} เพลงเมี๊ยว*` : '';
                embed.addFields({ name: '📋 เพลงต่อแถวเมี๊ยว', value: list + extra });
            }

            return interaction.reply({ embeds: [embed] });
        }

        // ────────────────────────────────
        // 🎵 NOW PLAYING
        // ────────────────────────────────
        if (sub === 'nowplaying') {
            if (!queue) return interaction.reply({ content: '❌ ยังไม่มีเพลงไหนเล่นอยู่เลยนะเมี๊ยว!', flags: 64 });

            const song = queue.songs[0];
            const current = queue.currentTime;
            const total = song.duration || 0;
            const progress = total > 0 ? makeProgressBar(current, total) : '🔴 ถ่ายทอดสด (LIVE)';

            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle('🎵 ตอนนี้กำลังฟังเพลง...')
                .setDescription(`**[${song.name}](${song.url})**`)
                .addFields(
                    { name: 'ระยะเวลา', value: `\`${fmt(current)} / ${fmt(total)}\``, inline: true },
                    { name: 'ขอโดยคุณ', value: `${song.member?.displayName || 'ทาสแมวไม่ระบุตัวตน'}`, inline: true },
                    { name: 'ระดับเสียง', value: `${queue.volume}%`, inline: true },
                    { name: 'ความคืบหน้า', value: progress },
                )
                .setThumbnail(song.thumbnail || null);

            if (song.uploader?.name) {
                embed.setAuthor({ name: song.uploader.name, url: song.uploader.url || undefined });
            }

            return interaction.reply({ embeds: [embed] });
        }

        // ────────────────────────────────
        // ⏹️ LEAVE (สั่งให้ออกจากห้อง)
        // ────────────────────────────────
        if (sub === 'leave') {
            const voice = distube.voices.get(guild.id);
            if (!voice) return interaction.reply({ content: '❌ บอทไม่ได้อยู่ในห้องพูดคุยตอนนี้นะเมี๊ยว!', flags: 64 });

            // เช็คว่าเปิดโหมด TTS ไว้อยู่ไหมเมี๊ยว🐾
            const isTTSActive = client.ttsManager.ttsChannels.has(guild.id);
            
            if (isTTSActive) {
                // ถ้ามี TTS ให้ล้างเพลงทิ้งเฉยๆ เมี๊ยว🐾
                if (queue) queue.stop(); 
                return interaction.reply('⏹️ หยุดเพลงให้แล้วนะเมี๊ยว! แต่ระบบ TTS ยังทำงานต่ออยู่นะ🐾🎶');
            } else {
                // ถ้าไม่มีอะไรทำแล้ว ค่อยออกแบบจริงจังเมี๊ยว🐾
                await voice.leave();
                return interaction.reply('⏹️ แยกย้ายกันกลับบ้านนะเมี๊ยวว! ไว้มาสนุกกันใหม่นะ🐾🌸');
            }
        }

        // ── จากนี้เป็นต้นไป ต้องมี queue อยู่ ──
        if (!queue) return interaction.reply({ content: '❌ ยังไม่มีเพลงเล่นอยู่เลยนะเมี๊ยว!', flags: 64 });

        // ────────────────────────────────
        // 🗑️ REMOVE
        // ────────────────────────────────
        if (sub === 'remove') {
            if (queue.songs.length <= 1) {
                return interaction.reply({ content: '❌ ไม่มีเพลงอื่นในคิวให้เอาออกแล้วเมี๊ยว! ลองใช้ `/music skip` เพื่อข้ามเพลงปัจจุบันดูนะ🐾', flags: 64 });
            }
            const pos = interaction.options.getInteger('position');
            if (pos < 1 || pos > queue.songs.length - 1) {
                return interaction.reply({ content: `❌ ลำดับไม่ถูกต้องเมี๊ยว! เลือกได้ตั้งแต่ **1** ถึง **${queue.songs.length - 1}** (ดูจาก \`/music queue\` นะเมี๊ยว)`, flags: 64 });
            }
            const removed = queue.songs.splice(pos, 1)[0];
            return interaction.reply(`🗑️ ดึงเพลง **${trunc(removed.name, 50)}** ออกจากคิวเรียบร้อยเมี๊ยว (เพลงนี้เคยอยู่ลำดับที่ #${pos} นะ🐾)`);
        }

        // ────────────────────────────────
        // 🔀 MOVE
        // ────────────────────────────────
        if (sub === 'move') {
            const maxPos = queue.songs.length - 1;
            if (maxPos < 1) return interaction.reply({ content: '❌ ไม่มีเพลงพอให้ย้ายที่กันเลยเมี๊ยว!', flags: 64 });

            const from = interaction.options.getInteger('from');
            const to = interaction.options.getInteger('to');
            if (from < 1 || from > maxPos || to < 1 || to > maxPos) {
                return interaction.reply({ content: `❌ ลำดับต้องอยู่ระหว่าง **1** ถึง **${maxPos}** นะเมี๊ยว🐾`, flags: 64 });
            }

            const [song] = queue.songs.splice(from, 1);
            queue.songs.splice(to, 0, song);
            return interaction.reply(`↕️ ย้ายเพลง **${trunc(song.name, 50)}** จากลำดับที่ #${from} → ไปยัง #${to} สำเร็จเมี๊ยว!🐾`);
        }

        // ────────────────────────────────
        // ⏭️ SKIP
        // ────────────────────────────────
        if (sub === 'skip') {
            const skipped = queue.songs[0]?.name || 'ไม่ทราบชื่อเพลง';
            try {
                await queue.skip();
                return interaction.reply(`⏭️ ข้ามเพลง **${trunc(skipped, 50)}** ไปให้แล้วนะเมี๊ยว!`);
            } catch {
                await queue.stop();
                return interaction.reply('🏁 จบคิวเพลงแล้วเมี๊ยว — ข้ามเพลงสุดท้ายไปให้เรียบร้อย!🐾');
            }
        }

        // ────────────────────────────────
        // ⏮️ PREVIOUS
        // ────────────────────────────────
        if (sub === 'previous') {
            try {
                await queue.previous();
                return interaction.reply('⏮️ กำลังย้อนกลับไปเพลงก่อนหน้าเมี๊ยว!🐾');
            } catch {
                return interaction.reply({ content: '❌ ไม่มีเพลงก่อนหน้าให้ย้อนแล้วนะเมี๊ยว!', flags: 64 });
            }
        }

        // ────────────────────────────────
        // ⏸️ PAUSE
        // ────────────────────────────────
        if (sub === 'pause') {
            if (queue.paused) return interaction.reply({ content: '⏸️ เพลงหยุดอยู่แล้วนะเมี๊ยว!', flags: 64 });
            queue.pause();
            return interaction.reply('⏸️ หยุดพักเพลงชั่วคราวเมี๊ยวว!🐾');
        }

        // ────────────────────────────────
        // ▶️ RESUME
        // ────────────────────────────────
        if (sub === 'resume') {
            if (!queue.paused) return interaction.reply({ content: '▶️ เพลงกำลังเล่นอยู่แล้วนะเมี๊ยว!', flags: 64 });
            queue.resume();
            return interaction.reply('▶️ บรรเลงเพลงต่อเลยเมี๊ยวว!🐾');
        }

        // ────────────────────────────────
        // 🔊 VOLUME
        // ────────────────────────────────
        if (sub === 'volume') {
            const vol = interaction.options.getInteger('percent');
            queue.setVolume(vol);
            const bar = '█'.repeat(Math.round(vol / 10)) + '░'.repeat(10 - Math.round(vol / 10));
            return interaction.reply(`🔊 ปรับระดับเสียงเป็น **${vol}%** แล้วนะเมี๊ยวว!\n\`${bar}\``);
        }

        // ────────────────────────────────
        // 🔁 LOOP
        // ────────────────────────────────
        if (sub === 'loop') {
            const mode = parseInt(interaction.options.getString('mode'));
            const modeNames = ['❌ ปิด', '🔂 วนซ้ำเพลงเดิม', '🔁 วนซ้ำทั้งคิว'];
            queue.setRepeatMode(mode);
            return interaction.reply(`ตั้งค่าการวนซ้ำ: **${modeNames[mode]}** เรียบร้อยเมี๊ยว!🐾`);
        }

        // ────────────────────────────────
        // 🔀 SHUFFLE
        // ────────────────────────────────
        if (sub === 'shuffle') {
            if (queue.songs.length <= 2) return interaction.reply({ content: '❌ ต้องมีอย่างน้อย 2 เพลงในคิวถึงจะสลับลำดับได้นะเมี๊ยว!', flags: 64 });
            await queue.shuffle();
            return interaction.reply('🔀 สลับลำดับคิวเพลงแบบสุ่มให้แล้วนะเมี๊ยวว!🐾');
        }

        // ────────────────────────────────
        // ⏩ SEEK
        // ────────────────────────────────
        if (sub === 'seek') {
            const seconds = interaction.options.getInteger('seconds');
            const song = queue.songs[0];
            if (song.duration && seconds > song.duration) {
                return interaction.reply({ content: `❌ เพลงนี้ยาวแค่ \`${fmt(song.duration)}\` เองนะเมี๊ยว!`, flags: 64 });
            }
            await queue.seek(seconds);
            return interaction.reply(`⏩ ข้ามไปที่วินาทีที่ \`${fmt(seconds)}\` ให้แล้วนะเมี๊ยวว!🐾`);
        }

        // ────────────────────────────────
        // 🧹 CLEAR
        // ────────────────────────────────
        if (sub === 'clear') {
            if (queue.songs.length <= 1) return interaction.reply({ content: '📭 คิวเพลงว่างเปล่าอยู่แล้วนะเมี๊ยว!', flags: 64 });
            const count = queue.songs.length - 1;
            queue.songs.splice(1);
            return interaction.reply(`🧹 ล้างคิวเพลงจำนวน **${count}** เพลงออกให้เรียบร้อยแล้วเมี๊ยวว!🐾`);
        }

        // ────────────────────────────────
        // 📻 AUTOPLAY
        // ────────────────────────────────
        if (sub === 'autoplay') {
            const mode = queue.toggleAutoplay();
            return interaction.reply(`📻 ระบบเล่นเพลงต่อเนื่อง (Auto-Play): **${mode ? 'เปิด (ON)' : 'ปิด (OFF)'}** แล้วนะเมี๊ยวว!🐾`);
        }
    },
};

// ═══════════════════════════════════
// Utility Functions
// ═══════════════════════════════════
function fmt(sec) {
    if (!sec || sec === 0) return 'LIVE';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function trunc(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function makeProgressBar(current, total, size = 20) {
    const percent = Math.min(current / total, 1);
    const filled = Math.round(size * percent);
    const bar = '▓'.repeat(filled) + '░'.repeat(size - filled);
    return `\`${fmt(current)}\` ${bar} \`${fmt(total)}\``;
}

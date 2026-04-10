const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.guild) return;

        // --- 1. ดึงข้อมูลฟีเจอร์และเซ็ตติ้ง ---
        let features = {};
        let settings = {};
        try {
            const { data: guildData } = await supabase
                .from('guilds')
                .select('features, settings')
                .eq('id', interaction.guild.id)
                .single();
            features = guildData?.features || {};
            settings = guildData?.settings || {};
        } catch (e) {
            console.error('Supabase fetch error:', e.message);
        }

        // 🔍 0. จัดการกรณีเป็น Autocomplete
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error('Autocomplete Error:', error);
            }
        }

        // 💾 1. จัดการกรณีเป็น Slash Command
        else if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            // ตรวจสอบการเปิดใช้งานฟีเจอร์
            if (interaction.commandName === 'music' && features.music === false) return interaction.reply({ content: '❌ ฟีเจอร์เพลงถูกปิดการใช้งานอยู่เมี๊ยว!', ephemeral: true });
            if (interaction.commandName === 'autoroles' && features.auto_role === false) return interaction.reply({ content: '❌ ระบบแจกยศอัตโนมัติถูกปิดอยู่เมี๊ยว!', ephemeral: true });
            if (interaction.commandName === 'rolebuttons' && features.role_button === false) return interaction.reply({ content: '❌ ระบบปุ่มรับยศถูกปิดอยู่เมี๊ยว!', ephemeral: true });
            if (interaction.commandName === 'fortune' && features.fortune === false && interaction.options.getSubcommand() === 'draw') return interaction.reply({ content: '❌ ระบบดูดวงถูกปิดอยู่เมี๊ยว!', ephemeral: true });

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                const errorMsg = 'งื้อออ เกิดข้อผิดพลาดในการรันคำสั่งเมี๊ยว!';
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMsg, flags: 64 }).catch(() => {});
                } else {
                    await interaction.reply({ content: errorMsg, flags: 64 }).catch(() => {});
                }
            }
        }
        
        // 🎵 2b. จัดการ Select Menu (เลือกเพลงขึ้นคิวแรก)
        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'music_queue_select') {
                const queue = interaction.client.distube.getQueue(interaction.guildId);
                if (!queue || queue.songs.length <= 1) {
                    return interaction.update({ content: '❌ คิวเพลงหมดแล้วเมี๊ยว!', embeds: [], components: [] });
                }

                const selectedIdx = parseInt(interaction.values[0]); // 1-based index ใน queue.songs
                if (isNaN(selectedIdx) || selectedIdx < 1 || selectedIdx >= queue.songs.length) {
                    return interaction.update({ content: '❌ ไม่พบเพลงที่เลือกในคิวเมี๊ยว!', embeds: [], components: [] });
                }

                // ดึงเพลงออกมาแล้วเสียบต่อจากเพลงปัจจุบัน (index 1)
                const [pickedSong] = queue.songs.splice(selectedIdx, 1);
                queue.songs.splice(1, 0, pickedSong);

                await interaction.update({
                    content: `✅ ย้าย **${pickedSong.name}** มาเป็นคิวถัดไปแล้วเมี๊ยวว!🐾🌸`,
                    embeds: [],
                    components: []
                });
            }
        }

        // 🔘 2. จัดการกรณีเป็น Button (ยุบรวมทุกปุ่มไว้ที่นี่)
        else if (interaction.isButton()) {
            const { customId, guild, member, user } = interaction;

            // --- ปุ่มรับยศปกติ (Toggle) ---
            if (customId.startsWith('assign_role:')) {
                if (features.role_button === false) return interaction.reply({ content: '❌ ระบบปิดใช้งานอยู่เมี๊ยว', ephemeral: true });
                const roleId = customId.split(':')[1];
                const role = guild.roles.cache.get(roleId);
                if (!role) return interaction.reply({ content: 'หา Role ไม่เจอเมี๊ยว!', ephemeral: true });
                try {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                        return interaction.reply({ content: `ดึงยศ **${role.name}** ออกให้แล้วนะเมี๊ยว🐾`, ephemeral: true });
                    } else {
                        await member.roles.add(role);
                        return interaction.reply({ content: `เพิ่มยศ **${role.name}** ให้แล้วนะเมี๊ยวว!🐾`, ephemeral: true });
                    }
                } catch (e) { return interaction.reply({ content: 'บอทไม่มีสิทธิ์จัดการยศนี้เมี๊ยว (ยศอาจจะสูงกว่าบอทนะ🐾)', ephemeral: true }); }
            } 

            // --- ปุ่มยืนยันตัวตน (Swap Roles) ---
            else if (customId.startsWith('verify_member:')) {
                const [_, addRoleId, removeRoleId] = customId.split(':');
                const addRole = guild.roles.cache.get(addRoleId);
                const removeRole = removeRoleId ? guild.roles.cache.get(removeRoleId) : null;

                try {
                    if (addRole) await member.roles.add(addRole);
                    if (removeRole && member.roles.cache.has(removeRole.id)) {
                        await member.roles.remove(removeRole);
                    }
                    return interaction.reply({ content: `✨ **ยืนยันตัวตนสำเร็จ!** ยินดีต้อนรับเข้าบ้านอย่างเป็นทางการนะเมี๊ยววว! 🐾`, ephemeral: true });
                } catch (e) {
                    console.error('Verify button error:', e);
                    return interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการจัดการยศเมี๊ยว (บอทอาจมียศต่ำกว่ายศนั้น)', ephemeral: true });
                }
            }
            
            // --- ปุ่มดูดวง ---
            else if (customId === 'fortune_draw') {
                if (features.fortune === false) return interaction.reply({ content: '❌ ระบบปิดใช้งานอยู่เมี๊ยว', ephemeral: true });
                const { drawCard } = require('../../commands/utility/fortune');
                await drawCard(interaction);
            }

            // --- ปุ่มเปิดฟอร์ม ---
            else if (customId.startsWith('form_open:')) {
                try {
                    const formId = customId.split(':')[1];
                    const { data: form } = await supabase.from('forms').select('*').eq('id', formId).single();
                    if (!form) return interaction.reply({ content: '❌ ไม่พบข้อมูลฟอร์มเมี๊ยว', ephemeral: true });

                    const modal = new ModalBuilder().setCustomId(`form_submit:${formId}`).setTitle(form.modal_title || 'แบบฟอร์มเมี๊ยว');
                    const questions = form.modal_questions || [];
                    const rows = questions.map((q, i) => new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId(`form_answer_${i}`).setLabel(q.length > 45 ? q.substring(0, 42) + '...' : q).setStyle(TextInputStyle.Paragraph).setRequired(true)
                    ));
                    modal.addComponents(rows);
                    await interaction.showModal(modal);
                } catch (e) { console.error(e); }
            }

            // --- ปุ่มอนุมัติฟอร์ม (แอดมิน) ---
            else if (customId.startsWith('form_approve:')) {
                const [_, formId, targetUserId] = customId.split(':');
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ใช้งานได้นะเมี๊ยว!🐾', ephemeral: true });
                const { data: form } = await supabase.from('forms').select('*').eq('id', formId).single();
                const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
                if (targetMember) {
                    if (form.role_id) await targetMember.roles.add(form.role_id).catch(() => {});
                    if (form.remove_role_id) await targetMember.roles.remove(form.remove_role_id).catch(() => {});
                }
                
                const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x22C55E).addFields({ name: 'สถานะ', value: `✅ อนุมัติโดย ${user.tag}` });
                await interaction.update({ embeds: [newEmbed], components: [] });
            }

            // --- ปุ่มปฏิเสธฟอร์ม (แอดมิน) ---
            else if (customId.startsWith('form_reject:')) {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ใช้งานได้นะเมี๊ยว!🐾', ephemeral: true });
                const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xEF4444).addFields({ name: 'สถานะ', value: `❌ ปฏิเสธโดย ${user.tag}` });
                await interaction.update({ embeds: [newEmbed], components: [] });
            }

            // --- ปุ่มดูคิวเพลง + ขึ้นมาคิวแรก ---
            else if (customId === 'music_queue_btn') {
                const queue = interaction.client.distube.getQueue(interaction.guildId);
                if (!queue || queue.songs.length <= 1) {
                    return interaction.reply({ content: '📭 ไม่มีเพลงต่อแถวอยู่ในคิวเลยเมี๊ยว!', ephemeral: true });
                }

                const upcoming = queue.songs.slice(1, 6);
                const queueList = upcoming.map((s, i) => `${i + 1}. ${s.name}`).join('\n');

                // ⭐ บันทึก Snapshot เพื่อป้องกัน Race Condition เมี๊ยว🐾
                if (!interaction.client._queueSnapshots) interaction.client._queueSnapshots = new Map();
                const snapshotKey = `${interaction.guildId}-${user.id}`;
                interaction.client._queueSnapshots.set(snapshotKey, {
                    songs: upcoming.map(s => ({ name: s.name, url: s.url })),
                    timestamp: Date.now(),
                });

                const modal = new ModalBuilder()
                    .setCustomId('music_queue_jump')
                    .setTitle('📋 คิวเพลงถัดไปเมี๊ยว🐾');

                const listInput = new TextInputBuilder()
                    .setCustomId('music_queue_list')
                    .setLabel('เพลงที่รออยู่ในคิว')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(queueList)
                    .setRequired(false);

                const pickInput = new TextInputBuilder()
                    .setCustomId('music_queue_pick')
                    .setLabel('พิมพ์หมายเลขเพลงที่ต้องการขึ้นมาก่อน (1-5)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('เช่น: 2')
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(listInput),
                    new ActionRowBuilder().addComponents(pickInput),
                );
                await interaction.showModal(modal);
            }

            // --- ปุ่มเพิ่มเพลงผ่าน Popup ---
            else if (customId === 'music_add_modal') {
                const modal = new ModalBuilder()
                    .setCustomId('music_add_submit')
                    .setTitle('➕ เพิ่มเพลงเข้าคิวเมี๊ยว🐾');
                const input = new TextInputBuilder()
                    .setCustomId('music_query_input')
                    .setLabel('ชื่อเพลงหรือลิงก์ YouTube เมี๊ยว')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('เช่น: Dandelions - Ruth B หรือ https://youtube.com/...')
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
            }

            // --- ปุ่มควบคุมเพลง ---
            else if (customId.startsWith('music_')) {
                const queue = interaction.client.distube.getQueue(interaction.guildId);
                const action = customId.replace('music_', '');
                
                try {
                    // --- กรณีพิเศษ: สั่งให้ออกห้องเมี๊ยว (ไม่ต้องมีคิวก็ได้) ---
                    if (action === 'leave') {
                        const voice = interaction.client.distube.voices.get(interaction.guildId);
                        if (voice) {
                            await voice.leave();
                            return await interaction.reply({ content: '⏹️ แยกย้ายกันกลับบ้านนะเมี๊ยวว!🐾🌸', ephemeral: true });
                        } else {
                            return await interaction.reply({ content: '❌ บอทไม่ได้อยู่ในห้องพูดคุยตอนนี้นะเมี๊ยว!', ephemeral: true });
                        }
                    }

                    // --- คำสั่งอื่นๆ: ต้องมีคิวเพลงเมี๊ยว ---
                    if (!queue) return interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่นอยู่เมี๊ยว!', ephemeral: true });

                    switch (action) {
                        case 'pause':
                            if (queue.paused) {
                                queue.resume();
                                // เปลี่ยนปุ่มเป็นรูป Pause (⏸️) คืน
                                const rows = interaction.message.components.map(row => {
                                    const newRow = ActionRowBuilder.from(row);
                                    newRow.components.forEach(btn => {
                                        if (btn.data.custom_id === 'music_pause') btn.setEmoji('⏸️').setStyle(ButtonStyle.Secondary);
                                    });
                                    return newRow;
                                });
                                await interaction.update({ components: rows });
                            } else {
                                queue.pause();
                                // เปลี่ยนปุ่มเป็นรูป Play (▶️)
                                const rows = interaction.message.components.map(row => {
                                    const newRow = ActionRowBuilder.from(row);
                                    newRow.components.forEach(btn => {
                                        if (btn.data.custom_id === 'music_pause') btn.setEmoji('▶️').setStyle(ButtonStyle.Success);
                                    });
                                    return newRow;
                                });
                                await interaction.update({ components: rows });
                            }
                            break;
                        case 'autoplay':
                            const autoMode = queue.toggleAutoplay();
                            const autoRows = interaction.message.components.map(row => {
                                const newRow = ActionRowBuilder.from(row);
                                newRow.components.forEach(btn => {
                                    if (btn.data.custom_id === 'music_autoplay') {
                                        btn.setStyle(autoMode ? ButtonStyle.Primary : ButtonStyle.Secondary);
                                    }
                                });
                                return newRow;
                            });
                            await interaction.update({ components: autoRows });
                            break;
                        case 'skip':
                            try {
                                await queue.skip();
                                await interaction.reply({ content: '⏭️ ข้ามเพลงให้แล้วเมี๊ยว!', ephemeral: true });
                            } catch {
                                await interaction.reply({ content: '❌ ไม่มีเพลงถัดไปในคิวเมี๊ยว!', ephemeral: true });
                            }
                            break;
                        case 'loop':
                            const mode = queue.repeatMode === 1 ? 0 : 1;
                            queue.setRepeatMode(mode);
                            await interaction.reply({ content: `🔁 วนซ้ำเพลงนี้: **${mode === 1 ? 'เปิด' : 'ปิด'}** ให้แล้วนะเมี๊ยว!`, ephemeral: true });
                            break;
                        case 'mute':
                            const muteVol = queue.volume === 0 ? 50 : 0;
                            queue.setVolume(muteVol);
                            
                            // อัปเดตปุ่มและ Embed ทันทีเมี๊ยว🐾
                            const muteRows = interaction.message.components.map(row => {
                                const newRow = ActionRowBuilder.from(row);
                                newRow.components.forEach(btn => {
                                    if (btn.data.custom_id === 'music_mute') {
                                        btn.setEmoji(muteVol === 0 ? '🔇' : '🔊').setStyle(ButtonStyle.Secondary);
                                    }
                                });
                                return newRow;
                            });

                            const muteEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
                            const fieldIdx = muteEmbed.data.fields.findIndex(f => f.name.includes('ระดับเสียง'));
                            if (fieldIdx !== -1) muteEmbed.data.fields[fieldIdx].value = `${muteVol}%`;

                            await interaction.update({ embeds: [muteEmbed], components: muteRows });
                            break;
                    }
                } catch (e) {
                    console.error('Music Button Error:', e);
                    if (!interaction.replied) await interaction.reply({ content: 'เกิดข้อผิดพลาดในการควบคุมเพลงเมี๊ยว...', ephemeral: true });
                }
            }
        }

        // 📝 3. จัดการกรณีเป็น Modal Submit
        else if (interaction.isModalSubmit()) {
            const { customId, guild, user, fields } = interaction;

            // --- ขึ้นเพลงมาคิวแรกผ่าน Queue Modal ---
            if (customId === 'music_queue_jump') {
                const pickStr = fields.getTextInputValue('music_queue_pick').trim();
                if (!pickStr) return interaction.deferUpdate().catch(() => {});

                const pickNum = parseInt(pickStr);
                const queue = interaction.client.distube.getQueue(guild.id);
                if (!queue || queue.songs.length <= 1) {
                    return interaction.reply({ content: '❌ คิวเพลงหมดแล้วเมี๊ยว! ไม่มีเพลงให้ย้ายเป็นคิวแรกเรยเมี๊ยว', ephemeral: true });
                }

                if (isNaN(pickNum) || pickNum < 1 || pickNum > 5) {
                    return interaction.reply({ content: `❌ ใส่ตัวเลข 1-5 เท่านั้นนะเมี๊ยว🐾`, ephemeral: true });
                }

                // ⭐ ใช้ Snapshot ค้นหาเพลงที่ถูกต้องในคิวปัจจุบันเมี๊ยว🐾
                const snapshotKey = `${guild.id}-${user.id}`;
                const snapshot = interaction.client._queueSnapshots?.get(snapshotKey);

                // ถ้า Snapshot เก่นกว่า 30 วินาที ให้เตือนเมี๊ยว🐾
                if (!snapshot || Date.now() - snapshot.timestamp > 30000) {
                    return interaction.reply({ content: '❌ คิวอาจเปลี่ยนไปแล้วเมี๊ยว! กรุณาเปิดคิวใหม่อีกครั้งนะ🐾', ephemeral: true });
                }

                const targetSong = snapshot.songs[pickNum - 1];
                if (!targetSong) {
                    return interaction.reply({ content: `❌ ไม่พบเพลงอันดับ ${pickNum} ในคิวเมี๊ยว!`, ephemeral: true });
                }

                // ค้นหาเพลงจากชื่อจริงในคิวปัจจุบัน (ไม่เชื่อตัวเลขตาบอด)
                const realIdx = queue.songs.findIndex((s, i) => i > 0 && s.url === targetSong.url);
                if (realIdx === -1) {
                    return interaction.reply({ content: '❌ เพลงนี้หลุดออกจากคิวไปแล้วเมี๊ยว (เพลงอาจถูกข้ามหรือเปลี่ยนไประหว่างรอ)🐾', ephemeral: true });
                }

                const [picked] = queue.songs.splice(realIdx, 1);
                queue.songs.splice(1, 0, picked);

                // ลบ Snapshot หลังใช้งานเมี๊ยว🐾
                interaction.client._queueSnapshots.delete(snapshotKey);

                return interaction.reply({ content: `✅ ย้าย **${picked.name}** มาเป็นคิวถัดไปแล้วเมี๊ยวว!🐾🌸`, ephemeral: true });
            }

            // --- เพิ่มเพลงผ่าน Popup ---
            if (customId === 'music_add_submit') {
                const query = fields.getTextInputValue('music_query_input');
                const memberVoice = guild.members.cache.get(user.id)?.voice?.channel;
                if (!memberVoice) return interaction.reply({ content: '❌ คุณต้องเข้าห้องพูดคุย (Voice) ก่อนนะเมี๊ยว!', ephemeral: true });

                await interaction.deferUpdate().catch(() => interaction.deferReply({ ephemeral: true }).catch(() => {}));
                try {
                    await interaction.client.distube.play(memberVoice, query, {
                        textChannel: interaction.channel,
                        member: guild.members.cache.get(user.id),
                    });
                } catch (err) {
                    await interaction.followUp({ content: `❌ เพิ่มเพลงไม่ได้เมี๊ยว: \`${err.message}\``, ephemeral: true });
                }
                return;
            }

            // --- ตั้งค่า Welcome ---
            if (customId === 'welcome_settings_modal') {
                const msg = fields.getTextInputValue('welcome_message_input');
                settings.welcome = { ...settings.welcome, message: msg };
                await supabase.from('guilds').update({ settings }).eq('id', guild.id);
                return interaction.reply({ content: '✅ อัปเดตข้อความต้อนรับเรียบร้อยเมี๊ยว!', ephemeral: true });
            }

            // --- ตั้งค่า Goodbye ---
            else if (customId === 'goodbye_settings_modal') {
                const msg = fields.getTextInputValue('goodbye_message_input');
                settings.goodbye = { ...settings.goodbye, message: msg };
                await supabase.from('guilds').update({ settings }).eq('id', guild.id);
                return interaction.reply({ content: '✅ อัปเดตข้อความบอกลาเรียบร้อยเมี๊ยว!', ephemeral: true });
            }

            // --- ส่งฟอร์มสมัคร ---
            else if (customId.startsWith('form_submit:')) {
                const formId = customId.split(':')[1];
                const { data: form } = await supabase.from('forms').select('*').eq('id', formId).single();
                const questions = form.modal_questions || [];
                const QnA = questions.map((q, i) => `**Q: ${q}**\n${fields.getTextInputValue(`form_answer_${i}`)}`).join('\n\n');

                if (form.mode === 'auto') {
                    const member = await guild.members.fetch(user.id);
                    if (form.role_id) await member.roles.add(form.role_id).catch(() => {});
                    if (form.remove_role_id) await member.roles.remove(form.remove_role_id).catch(() => {});
                    return interaction.reply({ content: '✅ อนุมัติและแจกยศให้เรียบร้อยแล้วเมี๊ยวว! (ระบบอัตโนมัติ🐾)', ephemeral: true });
                } else {
                    const approveChId = settings?.form?.approve_channel_id;
                    const channel = guild.channels.cache.get(approveChId);
                    if (!channel) return interaction.reply({ content: '❌ ยังไม่ได้ตั้งค่าห้องอนุมัติสำหรับแอดมินเมี๊ยว!', ephemeral: true });

                    const embed = new EmbedBuilder().setTitle('📝 คำขอรับบทบาทใหม่เมี๊ยว').setColor(0xFAB005).setThumbnail(user.displayAvatarURL())
                        .addFields({ name: 'ผู้ใช้งาน', value: `<@${user.id}>`, inline: true }, { name: 'ID', value: user.id, inline: true })
                        .setDescription(QnA).setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`form_approve:${formId}:${user.id}`).setLabel('อนุมัติเมี๊ยว').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`form_reject:${formId}:${user.id}`).setLabel('ปฏิเสธเมี๊ยว').setStyle(ButtonStyle.Danger)
                    );
                    await channel.send({ embeds: [embed], components: [row] });
                    return interaction.reply({ content: '✅ ส่งคำขอให้แอดมินตรวจสอบแล้วนะเมี๊ยว รอแป๊บน้าา🐾', ephemeral: true });
                }
            }
        }
    },
};

const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getGuildData } = require('../../utils/guildCache');
const supabase = require('../../supabaseClient');
const { handleRPGAction } = require('../../utils/rpgManager');
const { generateRPGImage } = require('../../utils/rpgImage');
const { checkPermission } = require('../../utils/permissionManager');


module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.guild) return;

        // 🔍 0. จัดการกรณีเป็น Autocomplete (แยกออกมาไว้บนสุดเพื่อความเร็วและเลี่ยง cooldown เมี๊ยว🐾)
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                return await command.autocomplete(interaction);
            } catch (error) {
                if (error.code === 10062) return; // Silent on Unknown Interaction (3s timeout)
                return console.error('Autocomplete Error:', error);
            }
        }

        // 🛡️ ระบบ Anti-Spam เบื้องต้น (ป้องกันคนกดปุ่มรัวๆ เมี๊ยว🐾)
        if (!interaction.client.interactionCooldowns) interaction.client.interactionCooldowns = new Map();
        const cooldownKey = `${interaction.user.id}-${interaction.customId || interaction.commandName}`;
        const lastUsed = interaction.client.interactionCooldowns.get(cooldownKey) || 0;
        const now = Date.now();
        if (now - lastUsed < 800) { // 0.8 วินาทีเมี๊ยว🐾
            return interaction.reply({ content: '🐾 ใจเย็นๆ นะเมี๊ยววว อย่ารัวปุ่มสิ!', flags: [MessageFlags.Ephemeral] }).catch(() => { });
        }
        interaction.client.interactionCooldowns.set(cooldownKey, now);

        try {
            // --- 1. ดึงข้อมูลฟีเจอร์และเซ็ตติ้งจาก Cache ---
            // ⭐ สำหรับคำสั่ง aichat ให้ Defer ไว้ก่อนทันทีเพื่อเลี่ยง Timeout 3s เมี๊ยว🐾
            if (interaction.isChatInputCommand() && ['aichat', 'botqueue', 'translate', 'summary'].includes(interaction.commandName)) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => { });
            }

            // ⭐ สำหรับแบบฟอร์ม ให้ Defer ไว้ก่อนทันทีเพื่อเลี่ยง Timeout 3s เมี๊ยว🐾
            if (interaction.isModalSubmit() && interaction.customId.startsWith('form_submit:')) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => { });
            }

            const { features, settings } = await getGuildData(interaction.guild.id);

            // 🚫 1.5 ตรวจสอบสถานะการถูกแบน (ป้องกันคนโดนแบนกดรับยศเพื่อข้ามกฎเมี๊ยว🐾)
            if (settings.ban_role_id && interaction.member.roles.cache.has(settings.ban_role_id)) {
                const blockedIds = ['assign_role:', 'verify_member:', 'form_submit:'];
                const isBlockedButtonOrModal = (interaction.isButton() || interaction.isModalSubmit()) && blockedIds.some(id => interaction.customId.startsWith(id));
                const isBlockedCommand = interaction.isChatInputCommand() && ['giverole', 'autoroles', 'rolebuttons'].includes(interaction.commandName);

                if (isBlockedButtonOrModal || isBlockedCommand) {
                    return interaction.reply({
                        content: '❌ **คุณถูกระงับการใช้งานชั่วคราวเมี๊ยว!** ไม่สามารถรับยศหรือทำรายการนี้ได้จนกว่าจะพ้นโทษนะเมี๊ยวว🐾',
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => { });
                }
            }

            // 💾 1. จัดการกรณีเป็น Slash Command
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) return;

                // 🛡️ เช็คสิทธิ์การใช้งานคำสั่ง (ย้ายไปให้ Discord จัดการผ่านเมนู Integrations แล้วเมี๊ยว🐾)
                /*
                if (!(await checkPermission(interaction, interaction.commandName))) {
                    return interaction.reply({
                        content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้เมี๊ยว! (เฉพาะผู้ดูแลระบบหรือผู้ที่มีสิทธิ์เท่านั้น🐾)',
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => { });
                }
                */

                // ตรวจสอบการเปิดใช้งานฟีเจอร์ (ยกเว้นคำสั่งที่ใช้สำหรับเปิด/ปิดระบบเอง)
                const subcommand = interaction.options.getSubcommand(false);
                const isEnableDisable = subcommand === 'enable' || subcommand === 'disable';

                // 🛡️ บังคับให้เฉพาะ Owner เท่านั้นที่เปิด/ปิดระบบได้ (ตามคำขอเมี๊ยว🐾)
                if (isEnableDisable && interaction.user.id !== interaction.guild.ownerId) {
                    return interaction.reply({
                        content: '❌ เฉพาะเจ้าของเซิร์ฟเวอร์ (Server Owner) เท่านั้นที่สามารถเปิดหรือปิดการใช้งานระบบได้นะเมี๊ยว🐾',
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => { });
                }

                if (!isEnableDisable) {
                    if (interaction.commandName === 'music' && features.music === false) {
                        return interaction.reply({ content: '❌ ฟีเจอร์เพลงถูกปิดการใช้งานอยู่เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }
                    if (interaction.commandName === 'autoroles' && features.auto_role === false) {
                        return interaction.reply({ content: '❌ ระบบแจกยศอัตโนมัติถูกปิดอยู่เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }
                    if (interaction.commandName === 'rolebuttons' && features.role_button === false) {
                        return interaction.reply({ content: '❌ ระบบปุ่มรับยศถูกปิดอยู่เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }
                    if (interaction.commandName === 'fortune' && features.fortune === false && subcommand === 'draw') {
                        return interaction.reply({ content: '❌ ระบบดูดวงถูกปิดอยู่เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }
                }

                await command.execute(interaction);
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
                // --- จัดการ Select Menu ของห้องเสียง ---
                else if (interaction.customId === 'voice_room_invite_select' || interaction.customId === 'voice_room_kick_select') {
                    const isInvite = interaction.customId === 'voice_room_invite_select';
                    const selectedUsers = interaction.values;

                    if (!interaction.client.voiceRoomConfirm) interaction.client.voiceRoomConfirm = new Map();
                    interaction.client.voiceRoomConfirm.set(interaction.message.id, selectedUsers);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`voice_room_confirm:${isInvite ? 'invite' : 'kick'}`)
                            .setLabel(`ยืนยัน${isInvite ? 'ชวนเพื่อน' : 'เตะเพื่อน'}`)
                            .setStyle(isInvite ? ButtonStyle.Success : ButtonStyle.Danger)
                    );

                    await interaction.update({
                        content: `💡 คุณเลือกเพื่อน ${selectedUsers.length} คน: ${selectedUsers.map(id => `<@${id}>`).join(', ')}\n**กดปุ่มเพื่อยืนยันเมี๊ยว!🐾**`,
                        components: [row]
                    });
                }
            }

            // 🔘 2. จัดการกรณีเป็น Button (ยุบรวมทุกปุ่มไว้ที่นี่)
            else if (interaction.isButton()) {
                const { customId, guild, member, user } = interaction;

                // --- ระบบ RPG Join ---
                if (customId.startsWith('rpg_join:')) {
                    const sessionId = customId.split(':')[1];
                    const { data: session } = await supabase.from('rpg_sessions').select('*').eq('id', sessionId).single();

                    if (!session || session.status !== 'lobby') {
                        return interaction.reply({ content: '❌ ห้องนี้เริ่มไปแล้วหรือปิดรับสมัครแล้วนะเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    const players = session.players || [];
                    if (players.length >= 8) {
                        return interaction.reply({ content: '❌ ปาร์ตี้นี้เต็มแล้วนะเมี๊ยว! (รับได้สูงสุด 8 ท่าน)', flags: [MessageFlags.Ephemeral] });
                    }
                    if (players.find(p => p.id === user.id)) {
                        return interaction.reply({ content: '❌ คุณอยู่ในปาร์ตี้อยู่แล้วนะเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    players.push({ id: user.id, name: user.displayName || user.username, class: 'Adventurer' });
                    await supabase.from('rpg_sessions').update({ players }).eq('id', sessionId);

                    // เจนรูป Lobby ใหม่เมี๊ยว🐾
                    const attachment = await generateRPGImage(players, interaction);

                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setImage('attachment://lobby.png');

                    await interaction.update({
                        embeds: [updatedEmbed],
                        files: attachment ? [attachment] : []
                    });
                    return;
                }

                // --- ระบบ RPG Action ---
                else if (customId.startsWith('rpg_action:')) {
                    const [_, choice, sessionId] = customId.split(':');
                    return await handleRPGAction(interaction, choice, sessionId);
                }

                // --- ระบบ RPG Begin (Start Game from Lobby) ---
                else if (customId.startsWith('rpg_begin:')) {
                    const sessionId = customId.split(':')[1];
                    const { startRPGGame } = require('../../utils/rpgManager');
                    // แจ้งว่ากำลังประมวลผล และลบปุ่มจาก Lobby ทันที
                    return await startRPGGame(interaction, interaction.channel.id, user.id);
                }

                // --- ปุ่มรับยศปกติ (Toggle) ---
                else if (customId.startsWith('assign_role:')) {
                    if (features.role_button === false) return interaction.reply({ content: '❌ ระบบปิดใช้งานอยู่เมี๊ยว', flags: [MessageFlags.Ephemeral] });
                    const roleId = customId.split(':')[1];
                    const role = guild.roles.cache.get(roleId);

                    if (!role) return interaction.reply({ content: 'หา Role ไม่เจอเมี๊ยว! (ยศอาจจะถูกลบไปแล้ว🐾)', flags: [MessageFlags.Ephemeral] });

                    try {
                        // เช็คสิทธิ์บอทเบื้องต้นเมี๊ยว
                        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                            return interaction.reply({ content: '❌ บอทไม่มีสิทธิ์ `Manage Roles` ในเซิร์ฟเวอร์นี้เมี๊ยว! กรุณาตรวจสอบการตั้งค่าของบอทนะ🐾', flags: [MessageFlags.Ephemeral] });
                        }

                        if (role.position >= guild.members.me.roles.highest.position) {
                            return interaction.reply({ content: `❌ ยศ **${role.name}** อยู่สูงกว่าหรือเท่ากับยศของบอทเมี๊ยว! บอทเลยจัดการไม่ได้ (ต้องย้ายยศบอทให้สูงขึ้นใน Server Settings นะ🐾)`, flags: [MessageFlags.Ephemeral] });
                        }

                        if (member.roles.cache.has(role.id)) {
                            await member.roles.remove(role);
                            return interaction.reply({ content: `ดึงยศ **${role.name}** ออกให้แล้วนะเมี๊ยว🐾`, flags: [MessageFlags.Ephemeral] });
                        } else {
                            await member.roles.add(role);
                            return interaction.reply({ content: `เพิ่มยศ **${role.name}** ให้แล้วนะเมี๊ยวว!🐾`, flags: [MessageFlags.Ephemeral] });
                        }
                    } catch (e) {
                        console.error('Role Assign Error:', e);
                        return interaction.reply({ content: `งื้อออ บอทจัดการยศไม่ได้เมี๊ยว: \`${e.message}\` 🐾`, flags: [MessageFlags.Ephemeral] });
                    }
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
                        return interaction.reply({ content: `✨ **ยืนยันตัวตนสำเร็จ!** ยินดีต้อนรับเข้าบ้านอย่างเป็นทางการนะเมี๊ยววว! 🐾`, flags: [MessageFlags.Ephemeral] });
                    } catch (e) {
                        console.error('Verify button error:', e);
                        return interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการจัดการยศเมี๊ยว (บอทอาจมียศต่ำกว่ายศนั้น)', flags: [MessageFlags.Ephemeral] });
                    }
                }

                // --- ปุ่มดูดวง ---
                else if (customId === 'fortune_draw') {
                    if (features.fortune === false) return interaction.reply({ content: '❌ ระบบปิดใช้งานอยู่เมี๊ยว', flags: [MessageFlags.Ephemeral] });
                    const { drawCard } = require('../../commands/fortune/fortune');
                    await drawCard(interaction);
                }

                // --- ปุ่ม MBTI & SBTI ---
                else if (customId === 'mbti_start' || customId === 'sbti_start') {
                    const isSBTI = customId === 'sbti_start';
                    if (isSBTI && features.sbti === false) return interaction.reply({ content: '❌ ระบบ SBTI ถูกปิดใช้งานอยู่เมี๊ยว', flags: [MessageFlags.Ephemeral] });
                    if (!isSBTI && features.mbti === false) return interaction.reply({ content: '❌ ระบบ MBTI ถูกปิดใช้งานอยู่เมี๊ยว', flags: [MessageFlags.Ephemeral] });

                    const embed = new EmbedBuilder()
                        .setTitle(`🧠 เลือกช่องทางการทำแบบทดสอบ ${isSBTI ? 'SBTI' : 'MBTI'}`)
                        .setDescription(`🐾 **เลือกได้เลยว่าอยากทำแบบไหนนะเมี๊ยว!**\n\n✨ **แบบเว็บไซต์ (แนะนำ):** กราฟิกสวยงาม ลื่นไหล และแชร์ผลลัพธ์ได้ง่ายกว่า\n💬 **แบบ Discord:** ทำผ่านปุ่มในห้องแชทนี้ได้ทันทีเลยเมี๊ยว!`)
                        .setColor(isSBTI ? 0xEC4899 : 0x3B82F6);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`${customId}_web`)
                            .setLabel('🚀 ทำบนเว็บไซต์ (แนะนำ)')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`${customId}_discord`)
                            .setLabel('💬 ทำใน Discord')
                            .setStyle(ButtonStyle.Primary)
                    );

                    return interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
                }

                // --- จัดการการเลือก Web / Discord ---
                else if (customId.endsWith('_web')) {
                    const baseId = customId.replace('_web', '');
                    const isSBTI = baseId === 'sbti_start';
                    
                    await interaction.deferUpdate();

                    try {
                        const { data: session, error } = await supabase.from('user_mbti_sessions').insert({
                            user_id: user.id,
                            guild_id: guild.id,
                            channel_id: interaction.channelId,
                            type: isSBTI ? 'sbti' : 'mbti',
                            expires_at: new Date(Date.now() + 30 * 60000).toISOString()
                        }).select().single();

                        if (error) throw error;

                        const baseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
                        const uniqueUrl = `${baseUrl}/${isSBTI ? 'sbti' : 'mbti'}?sessionId=${session.id}`;

                        const embed = new EmbedBuilder()
                            .setTitle(`🚀 ลิงก์ทำแบบทดสอบ ${isSBTI ? 'SBTI' : 'MBTI'} บนเว็บ`)
                            .setDescription(`✨ **กดลิงก์ด้านล่างเพื่อเริ่มทำได้เลยเมี๊ยว!**\n\n🔗 [กดตรงนี้เพื่อเริ่มทำแบบทดสอบ](${uniqueUrl})\n\n*หมายเหตุ: ลิงก์นี้มีอายุ 30 นาทีนะเมี๊ยว🐾*`)
                            .setColor(isSBTI ? 0xEC4899 : 0x3B82F6);

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('🚀 เริ่มทำแบบทดสอบบนเว็บ')
                                .setStyle(ButtonStyle.Link)
                                .setURL(uniqueUrl)
                        );

                        return interaction.editReply({ embeds: [embed], components: [row] });
                    } catch (err) {
                        console.error('Web Link Error:', err);
                        return interaction.editReply({ content: 'งื้อออ เกิดข้อผิดพลาดเมี๊ยว!', components: [] });
                    }
                }

                else if (customId.endsWith('_discord')) {
                    const baseId = customId.replace('_discord', '');
                    const isSBTI = baseId === 'sbti_start';
                    
                    await interaction.deferUpdate();

                    if (isSBTI) {
                        const { startTest } = require('../../commands/mbti/sbti');
                        return await startTest(interaction);
                    } else {
                        const { startTest } = require('../../commands/mbti/mbti');
                        return await startTest(interaction);
                    }
                }

                // --- ปุ่มเปิดฟอร์ม ---
                else if (customId.startsWith('form_open:')) {
                    try {
                        const formId = customId.split(':')[1];
                        const { data: form } = await supabase.from('forms').select('*').eq('id', formId).single();
                        if (!form) return interaction.reply({ content: '❌ ไม่พบข้อมูลฟอร์มเมี๊ยว', flags: [MessageFlags.Ephemeral] });

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
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ใช้งานได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    const { data: form } = await supabase.from('forms').select('*').eq('id', formId).single();
                    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
                    if (targetMember) {
                        if (form.role_id) await targetMember.roles.add(form.role_id).catch(() => { });
                        if (form.remove_role_id) await targetMember.roles.remove(form.remove_role_id).catch(() => { });
                    }

                    const oldEmbed = interaction.message.embeds[0];
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor(0x22C55E)
                        .spliceFields(-1, 1, { name: 'สถานะ', value: `✅ อนุมัติโดย ${user.tag}`, inline: true });
                    await interaction.update({ embeds: [newEmbed], components: [] });
                }

                // --- ปุ่มปฏิเสธฟอร์ม (แอดมิน) ---
                else if (customId.startsWith('form_reject:')) {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ใช้งานได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    const oldEmbed = interaction.message.embeds[0];
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor(0xEF4444)
                        .spliceFields(-1, 1, { name: 'สถานะ', value: `❌ ปฏิเสธโดย ${user.tag}`, inline: true });
                    await interaction.update({ embeds: [newEmbed], components: [] });
                }

                // --- ปุ่มเปิดห้องแชท AI ส่วนตัว ---
                else if (customId.startsWith('ai_private_chat:')) {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const formId = customId.split(':')[1];

                    try {
                        const { data: form, error } = await supabase.from('ai_chat_forms').select('*').eq('id', formId).single();
                        if (error || !form) return interaction.editReply({ content: '❌ หาข้อมูลฟอร์มไม่เจอเมี๊ยว!' });

                        // 🕒 เช็คว่าฟอร์มหมดอายุหรือยังเมี๊ยว🐾
                        if (form.expires_at && new Date(form.expires_at) < new Date()) {
                            return interaction.editReply({ content: '⏰ ฟอร์มนี้หมดเวลาใช้งานแล้วเมี๊ยว! ไม่สามารถเปิดห้องใหม่ได้แล้วครับ🐾' });
                        }

                        const { data: bot } = await supabase.from('ai_characters').select('*').eq('id', form.bot_id).single();
                        if (!bot) return interaction.editReply({ content: '❌ ตัวละคร AI นี้หายไปแล้วเมี๊ยว!' });

                        // 1. สร้างชื่อห้อง (💬-user-bot)
                        const cleanUserName = user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        const cleanBotName = bot.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        const channelName = `💬-${cleanUserName}-${cleanBotName}`;

                        // 2. สร้างแชนแนลใหม่ใน Category เดียวกัน
                        const parentId = interaction.channel.parentId;
                        const newChannel = await guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: parentId,
                            permissionOverwrites: [
                                {
                                    id: guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel], // ปิดทุกคน
                                },
                                {
                                    id: user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                                },
                                {
                                    id: guild.members.me.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages],
                                }
                            ],
                        });

                        // 3. บันทึก Session ลง Database (ซิงค์เวลาตามฟอร์มเมี๊ยว🐾)
                        let expiresAtDate = form.expires_at ? new Date(form.expires_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);

                        await supabase.from('ai_chat_sessions').insert({
                            guild_id: guild.id,
                            channel_id: newChannel.id,
                            user_id: user.id,
                            bot_id: bot.id,
                            expires_at: expiresAtDate.toISOString(),
                            warning_sent: false
                        });

                        // 4. Summon AI เข้าห้องนี้ทันที
                        await supabase.from('active_ai_chats').upsert({
                            channel_id: newChannel.id,
                            guild_id: guild.id,
                            character_id: bot.id
                        });

                        // 5. ส่งข้อความทักทาย
                        const welcomeEmbed = new EmbedBuilder()
                            .setTitle(`✨ ห้องแชทส่วนตัวกับ ${bot.name} เปิดแล้ว!`)
                            .setDescription(`สวัสดีคุณ <@${user.id}>! ห้องนี้จะคุยได้ถึงเวลา <t:${Math.floor(expiresAtDate.getTime() / 1000)}:F> นะเมี๊ยวว 🐾\n\n**เริ่มคุยกับ ${bot.name} ได้เลย!**`)
                            .setThumbnail(bot.image_url || null)
                            .setColor(0x8B5CF6);

                        await newChannel.send({ embeds: [welcomeEmbed] });

                        return interaction.editReply({ content: `✅ สร้างห้องแชทส่วนตัวให้แล้วเมี๊ยว! ไปที่นี่เลย: ${newChannel}` });

                    } catch (err) {
                        console.error('Private AI Chat error:', err);
                        return interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาดในการสร้างห้อง: \`${err.message}\`` });
                    }
                }

                // --- ปุ่มเปิดห้องส่วนตัว (Private Room) ---
                else if (customId.startsWith('private_room_open:')) {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const formId = customId.split(':')[1];

                    try {
                        const { data: form, error } = await supabase.from('private_room_forms').select('*').eq('id', formId).single();
                        if (error || !form) return interaction.editReply({ content: '❌ หาข้อมูลฟอร์มไม่เจอเมี๊ยว!' });

                        // --- ตรวจสอบ Limit ห้องในเซิร์ฟเวอร์เมี๊ยว🐾 ---
                        const { data: activeRooms } = await supabase.from('private_rooms').select('expires_at').eq('guild_id', guild.id).eq('is_deleted', false);
                        const { settings } = await getGuildData(guild.id);
                        const roomLimit = settings.private_room_limit || 20;

                        if (activeRooms && activeRooms.length >= roomLimit) {
                            // หาห้องที่ใกล้จะหมดอายุที่สุดเmiียว🐾
                            const sortedRooms = activeRooms.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
                            const soonestExpiry = new Date(sortedRooms[0].expires_at);
                            const availableTime = new Date(soonestExpiry.getTime() + 5 * 60000); // บวก 5 นาทีตามขอเมี๊ยว🐾

                            return interaction.editReply({
                                content: `❌ ขออภัยเมี๊ยวว! ตอนนี้ห้องส่วนตัวในเซิร์ฟเวอร์เต็มแล้ว (**${activeRooms.length}/${roomLimit}**)🐾\n💡 จะมีห้องว่างอีกครั้งประมาณวันที่ <t:${Math.floor(availableTime.getTime() / 1000)}:F> (<t:${Math.floor(availableTime.getTime() / 1000)}:R>) นะเมี๊ยวว!`
                            });
                        }

                        const { data: existingRoom } = await supabase.from('private_rooms').select('*').eq('owner_id', user.id).eq('is_deleted', false).single();
                        if (existingRoom) {
                            return interaction.editReply({ content: '❌ คุณมีห้องส่วนตัวที่ยังใช้งานอยู่แล้วนะเมี๊ยว! กรุณาใช้ห้องเดิมหรือรอให้หมดอายุก่อนนะ🐾' });
                        }

                        // 1. สร้างชื่อห้อง (🏠-user)
                        const cleanUserName = user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        const channelName = `🏠-${cleanUserName}`;

                        // 2. สร้างแชนแนลใหม่
                        const parentId = interaction.channel.parentId;
                        const newChannel = await guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: parentId,
                            permissionOverwrites: [
                                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                                { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] }
                            ],
                        });

                        // 3. บันทึก Session
                        const expiresAt = new Date(Date.now() + form.duration_minutes * 60000);
                        await supabase.from('private_rooms').insert({
                            guild_id: guild.id,
                            channel_id: newChannel.id,
                            owner_id: user.id,
                            expires_at: expiresAt.toISOString()
                        });

                        // 4. ส่งข้อความต้อนรับ + ปุ่มจัดการ
                        const welcomeEmbed = new EmbedBuilder()
                            .setTitle(`🏠 ยินดีต้อนรับสู่ห้องส่วนตัวของ ${user.displayName}!`)
                            .setDescription(`ห้องนี้จะถูกลบในวันที่ <t:${Math.floor(expiresAt.getTime() / 1000)}:F> นะเมี๊ยวว 🐾\n\n**เจ้าของห้องสามารถจัดการเพื่อนได้ที่นี่:**`)
                            .setColor(0x10B981)
                            .addFields(
                                { name: '👤 เจ้าของห้อง', value: `<@${user.id}>`, inline: true },
                                { name: '⏰ เวลาหมดอายุ', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true }
                            );

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('private_room_invite').setLabel('ชวนเพื่อนเข้าห้อง').setStyle(ButtonStyle.Primary).setEmoji('➕'),
                            new ButtonBuilder().setCustomId('private_room_kick').setLabel('เตะเพื่อนออก').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                            new ButtonBuilder().setCustomId('private_room_rename').setLabel('เปลี่ยนชื่อห้อง').setStyle(ButtonStyle.Success).setEmoji('📝'),
                            new ButtonBuilder().setCustomId('private_room_close').setLabel('ปิดห้องตอนนี้').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
                        );

                        await newChannel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], components: [row] });

                        // 5. อัปเดตรูปหน้าฟอร์มเมี๊ยว🐾
                        const { updatePrivateRoomForm } = require('../../utils/privateRoomImage');
                        await updatePrivateRoomForm(interaction.client, form.id);

                        return interaction.editReply({ content: `✅ สร้างห้องส่วนตัวให้แล้วเมี๊ยว! ไปที่นี่เลย: ${newChannel}` });

                    } catch (err) {
                        console.error('Private Room error:', err);
                        return interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาดในการสร้างห้อง: \`${err.message}\`` });
                    }
                }

                // --- ปุ่มเปิดห้องเสียงเฉพาะกิจ (Voice Room) ---
                else if (customId.startsWith('voice_room_open:')) {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const formId = customId.split(':')[1];

                    try {
                        const { data: form, error } = await supabase.from('voice_room_forms').select('*').eq('id', formId).single();
                        if (error || !form) return interaction.editReply({ content: '❌ หาข้อมูลฟอร์มไม่เจอเมี๊ยว!' });

                        // --- ตรวจสอบ Limit ห้องในเซิร์ฟเวอร์เมี๊ยว🐾 ---
                        const { data: activeRooms } = await supabase.from('voice_rooms').select('id').eq('guild_id', guild.id).eq('is_deleted', false);
                        const { settings } = await getGuildData(guild.id);
                        const roomLimit = settings.voice_room_limit || 20;

                        if (activeRooms && activeRooms.length >= roomLimit) {
                            return interaction.editReply({
                                content: `❌ ขออภัยเมี๊ยวว! ตอนนี้ห้องเสียงในเซิร์ฟเวอร์เต็มแล้ว (**${activeRooms.length}/${roomLimit}**)🐾\n💡 กรุณารอให้มีห้องว่างก่อนนะเมี๊ยวว!`
                            });
                        }

                        const { data: existingRoom } = await supabase.from('voice_rooms').select('*').eq('owner_id', user.id).eq('is_deleted', false).single();
                        if (existingRoom) {
                            return interaction.editReply({ content: '❌ คุณมีห้องเสียงที่ยังใช้งานอยู่แล้วนะเมี๊ยว! กรุณาใช้ห้องเดิมหรือรอให้ห้องถูกลบก่อนนะ🐾' });
                        }

                        // 1. สร้างชื่อห้อง (🔊-user)
                        const cleanUserName = user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        const channelName = `🔊-${cleanUserName}`;

                        // 2. สร้างแชนแนลใหม่ (แบบ Voice)
                        const parentId = interaction.channel.parentId;
                        const newChannel = await guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildVoice,
                            parent: parentId,
                            permissionOverwrites: [
                                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // บังคับให้คนทั่วไปมองไม่เห็น
                                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] },
                                { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] }
                            ],
                        });

                        // 3. บันทึก Session
                        await supabase.from('voice_rooms').insert({
                            guild_id: guild.id,
                            channel_id: newChannel.id,
                            owner_id: user.id
                        });

                        // 4. ส่งข้อความต้อนรับในแชทห้องเสียง
                        const welcomeEmbed = new EmbedBuilder()
                            .setTitle(`🔊 ยินดีต้อนรับสู่ห้องเสียงของ ${user.displayName}!`)
                            .setDescription(`ห้องนี้จะถูกลบอัตโนมัติหากไม่มีคนอยู่ติดต่อกันเกิน **30 นาที** เมี๊ยว🐾\n\n**เจ้าของห้องสามารถจัดการเพื่อนได้ที่นี่:**`)
                            .setColor(0x3B82F6)
                            .addFields(
                                { name: '👤 เจ้าของห้อง', value: `<@${user.id}>`, inline: true }
                            );

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('voice_room_invite').setLabel('ชวนเพื่อนเข้าห้อง').setStyle(ButtonStyle.Primary).setEmoji('➕'),
                            new ButtonBuilder().setCustomId('voice_room_kick').setLabel('เตะเพื่อนออก').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                            new ButtonBuilder().setCustomId('voice_room_rename').setLabel('เปลี่ยนชื่อห้อง').setStyle(ButtonStyle.Success).setEmoji('📝'),
                            new ButtonBuilder().setCustomId('voice_room_close').setLabel('ปิดห้องตอนนี้').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
                        );

                        await newChannel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], components: [row] });

                        return interaction.editReply({ content: `✅ สร้างห้องเสียงให้แล้วเมี๊ยว! ไปที่นี่เลย: ${newChannel}` });

                    } catch (err) {
                        console.error('Voice Room error:', err);
                        return interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาดในการสร้างห้องเสียง: \`${err.message}\`` });
                    }
                }

                // --- ปุ่มลบฟอร์มห้องส่วนตัว ---
                else if (customId.startsWith('private_room_form_delete:')) {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบปุ่มนี้ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }
                    const formId = customId.split(':')[1];
                    await supabase.from('private_room_forms').delete().eq('id', formId);
                    await interaction.message.delete().catch(() => { });
                    return interaction.reply({ content: '🗑️ ลบฟอร์มห้องส่วนตัวออกจากระบบเรียบร้อยแล้วเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                }

                // --- ปุ่ม Invite / Kick ในห้องส่วนตัว ---
                else if (customId === 'private_room_invite' || customId === 'private_room_kick') {
                    const { data: room } = await supabase.from('private_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
                    if (!room) return interaction.reply({ content: '❌ ไม่พบข้อมูลห้องส่วนตัวนี้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    if (room.owner_id !== user.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องเท่านั้นที่ใช้ปุ่มนี้ได้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    const isInvite = customId === 'private_room_invite';
                    const { UserSelectMenuBuilder } = require('discord.js');

                    const select = new UserSelectMenuBuilder()
                        .setCustomId(isInvite ? 'private_room_invite_select' : 'private_room_kick_select')
                        .setPlaceholder(isInvite ? 'เลือกเพื่อนที่ต้องการชวนเมี๊ยว🐾' : 'เลือกเพื่อนที่ต้องการเตะออกเมี๊ยว🐾')
                        .setMinValues(1)
                        .setMaxValues(5);

                    const selectRow = new ActionRowBuilder().addComponents(select);
                    return interaction.reply({ content: isInvite ? '➕ เลือกเพื่อนที่ต้องการเพิ่มเข้าห้องเมี๊ยว:' : '➖ เลือกเพื่อนที่ต้องการนำออกจากห้องเมี๊ยว:', components: [selectRow], flags: [MessageFlags.Ephemeral] });
                }

                // --- ปุ่มลบฟอร์ม AI ส่วนตัว (แอดมินเท่านั้น) ---
                else if (customId.startsWith('ai_private_chat_delete:')) {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบปุ่มนี้ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }
                    const formId = customId.split(':')[1];

                    // 🧹 สั่ง Close All Sessions ก่อนลบเพื่อความคลีนเมี๊ยว🐾
                    const { closeAllSessions } = require('../../utils/aiCleanup');
                    await closeAllSessions(guild);

                    await supabase.from('ai_chat_forms').delete().eq('id', formId);
                    await interaction.message.delete().catch(() => { });
                    return interaction.reply({ content: '🗑️ เคลียร์ห้องแชทและลบฟอร์มออกจากระบบเรียบร้อยแล้วเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                }

                // --- ปุ่มเปลี่ยนชื่อห้องส่วนตัว (Owner/Admin) ---
                else if (customId === 'private_room_rename') {
                    const { data: room } = await supabase.from('private_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
                    if (!room) return interaction.reply({ content: '❌ ไม่พบข้อมูลห้องนี้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    if (room.owner_id !== user.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องหรือแอดมินเท่านั้นที่เปลี่ยนชื่อห้องได้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
                    const modal = new ModalBuilder().setCustomId('private_room_rename_modal').setTitle('📝 เปลี่ยนชื่อห้องส่วนตัวเมี๊ยว🐾');
                    const nameInput = new TextInputBuilder()
                        .setCustomId('private_room_new_name')
                        .setLabel('ชื่อห้องใหม่ (ไม่ต้องใส่รูปบ้านเมี๊ยว🐾)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('เช่น ห้องของลูกแมว, รับสมัครปาร์ตี้')
                        .setRequired(true)
                        .setMaxLength(30);

                    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                    return await interaction.showModal(modal);
                }

                // --- ปุ่มปิดห้องส่วนตัวทันที (เจ้าของห้อง/Admin) ---
                else if (customId === 'private_room_close') {
                    const { data: room } = await supabase.from('private_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
                    if (!room) return interaction.reply({ content: '❌ ไม่พบข้อมูลห้องนี้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    if (room.owner_id !== user.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องหรือแอดมินเท่านั้นที่ปิดห้องได้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    await interaction.reply({ content: '🏠 กำลังปิดห้องและลบข้อมูล... ขอบคุณที่ใช้บริการนะเมี๊ยวว!🐾🌸' });

                    // สั่งลบผ่าน Utility เมี๊ยว🐾
                    const { deletePrivateRoom } = require('../../utils/privateRoomCleanup');
                    await deletePrivateRoom(interaction.client, room);

                    // อัปเดตรูปหน้าฟอร์ม (ถ้ามีฟอร์มผูกไว้)เมี๊ยว🐾
                    const { data: form } = await supabase.from('private_room_forms').select('id').eq('guild_id', guild.id).order('created_at', { ascending: false }).limit(1).single();
                    if (form) {
                        const { updatePrivateRoomForm } = require('../../utils/privateRoomImage');
                        await updatePrivateRoomForm(interaction.client, form.id);
                    }
                }

                // --- ปุ่มปิดห้องส่วนตัวทั้งหมด (Admin Only) ---
                else if (customId === 'private_room_close_all') {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่สั่งปิดห้องทั้งหมดได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }

                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const { data: rooms } = await supabase.from('private_rooms').select('*').eq('guild_id', guild.id).eq('is_deleted', false);

                    if (!rooms || rooms.length === 0) {
                        return interaction.editReply({ content: '📭 ไม่มีห้องส่วนตัวที่เปิดอยู่ตอนนี้เมี๊ยว!' });
                    }

                    const { deletePrivateRoom } = require('../../utils/privateRoomCleanup');
                    for (const room of rooms) {
                        await deletePrivateRoom(interaction.client, room);
                    }

                    return interaction.editReply({ content: `✅ ปิดห้องส่วนตัวทั้งหมด ${rooms.length} ห้องเรียบร้อยแล้วเมี๊ยวว!🐾` });
                }

                // --- ปุ่มยืนยันเชิญ/เตะ เพื่อนห้องส่วนตัว ---
                else if (customId.startsWith('private_room_confirm:')) {
                    const action = customId.split(':')[1]; // 'invite' or 'kick'
                    const isInvite = action === 'invite';

                    // ดึงข้อมูลที่เลือกไว้จาก Map (ใช้ Message ID เป็น Key เมี๊ยว🐾)
                    if (!interaction.client.privateRoomConfirm) interaction.client.privateRoomConfirm = new Map();
                    const selectedUsers = interaction.client.privateRoomConfirm.get(interaction.message.id);

                    if (!selectedUsers || selectedUsers.length === 0) {
                        return interaction.update({ content: '❌ ไม่พบข้อมูลการเลือกเพื่อนเมี๊ยว! กรุณาเลือกใหม่อีกครั้งนะ🐾', components: [] });
                    }

                    await interaction.deferUpdate();

                    for (const userId of selectedUsers) {
                        if (userId === user.id) continue;
                        try {
                            if (isInvite) {
                                await interaction.channel.permissionOverwrites.edit(userId, {
                                    ViewChannel: true,
                                    SendMessages: true,
                                    ReadMessageHistory: true
                                });
                            } else {
                                await interaction.channel.permissionOverwrites.delete(userId);
                            }
                        } catch (err) {
                            console.error('Confirm permission error:', err);
                        }
                    }

                    // ล้างข้อมูลใน Map หลังใช้งานเสร็จเมี๊ยว🐾
                    interaction.client.privateRoomConfirm.delete(interaction.message.id);

                    return interaction.editReply({
                        content: `✅ ${isInvite ? 'เพิ่ม' : 'นำ'}เพื่อน ${selectedUsers.length} คน ${isInvite ? 'เข้าสู่' : 'ออกจาก'}ห้องเรียบร้อยแล้วเมี๊ยวว!🐾🌸`,
                        components: []
                    });
                }

                // --- ปุ่มยืนยันเชิญ/เตะ เพื่อนห้องเสียง ---
                else if (customId.startsWith('voice_room_confirm:')) {
                    const action = customId.split(':')[1];
                    const isInvite = action === 'invite';

                    if (!interaction.client.voiceRoomConfirm) interaction.client.voiceRoomConfirm = new Map();
                    const selectedUsers = interaction.client.voiceRoomConfirm.get(interaction.message.id);

                    if (!selectedUsers || selectedUsers.length === 0) {
                        return interaction.update({ content: '❌ ไม่พบข้อมูลการเลือกเพื่อนเมี๊ยว!', components: [] });
                    }

                    await interaction.deferUpdate();

                    for (const userId of selectedUsers) {
                        if (userId === user.id) continue;
                        try {
                            if (isInvite) {
                                await interaction.channel.permissionOverwrites.edit(userId, {
                                    ViewChannel: true,
                                    Connect: true,
                                    Speak: true,
                                    Stream: true
                                });
                            } else {
                                await interaction.channel.permissionOverwrites.delete(userId);
                                const targetMember = await guild.members.fetch(userId).catch(() => null);
                                if (targetMember && targetMember.voice.channelId === interaction.channelId) {
                                    await targetMember.voice.disconnect();
                                }
                            }
                        } catch (err) {
                            console.error('Confirm voice permission error:', err);
                        }
                    }

                    interaction.client.voiceRoomConfirm.delete(interaction.message.id);

                    return interaction.editReply({
                        content: `✅ ${isInvite ? 'เพิ่ม' : 'นำ'}เพื่อน ${selectedUsers.length} คน ${isInvite ? 'เข้าสู่' : 'ออกจาก'}ห้องเรียบร้อยแล้วเมี๊ยวว!🐾🌸`,
                        components: []
                    });
                }

                // --- ปุ่มสั่งปิดห้อง AI ทั้งหมด (Admin Only) ---
                else if (customId === 'ai_private_chat_close_all') {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่สั่งปิดห้องทั้งหมดได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const { closeAllSessions } = require('../../utils/aiCleanup');
                    const count = await closeAllSessions(guild);
                    return interaction.editReply({ content: `⏰ หมดเวลาการใช้งาน! ปิดห้องแชทส่วนตัวทั้งหมดแล้วเมี๊ยว (ลบไป ${count} ห้อง🐾)` });
                }

                // --- ปุ่ม Invite / Kick / Rename / Close ในห้องเสียง ---
                else if (customId === 'voice_room_invite' || customId === 'voice_room_kick') {
                    const { data: room } = await supabase.from('voice_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
                    if (!room) return interaction.reply({ content: '❌ ไม่พบข้อมูลห้องเสียงนี้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    if (room.owner_id !== user.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องเท่านั้นที่ใช้ปุ่มนี้ได้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    const isInvite = customId === 'voice_room_invite';
                    const { UserSelectMenuBuilder } = require('discord.js');

                    const select = new UserSelectMenuBuilder()
                        .setCustomId(isInvite ? 'voice_room_invite_select' : 'voice_room_kick_select')
                        .setPlaceholder(isInvite ? 'เลือกเพื่อนที่ต้องการชวนเมี๊ยว🐾' : 'เลือกเพื่อนที่ต้องการเตะออกเมี๊ยว🐾')
                        .setMinValues(1)
                        .setMaxValues(5);

                    const selectRow = new ActionRowBuilder().addComponents(select);
                    return interaction.reply({ content: isInvite ? '➕ เลือกเพื่อนที่ต้องการเพิ่มเข้าห้องเมี๊ยว:' : '➖ เลือกเพื่อนที่ต้องการนำออกจากห้องเมี๊ยว:', components: [selectRow], flags: [MessageFlags.Ephemeral] });
                }

                else if (customId === 'voice_room_rename') {
                    const { data: room } = await supabase.from('voice_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
                    if (!room) return interaction.reply({ content: '❌ ไม่พบข้อมูลห้องนี้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    if (room.owner_id !== user.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องหรือแอดมินเท่านั้นที่เปลี่ยนชื่อห้องได้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    const modal = new ModalBuilder().setCustomId('voice_room_rename_modal').setTitle('📝 เปลี่ยนชื่อห้องเสียงเมี๊ยว🐾');
                    const nameInput = new TextInputBuilder()
                        .setCustomId('voice_room_new_name')
                        .setLabel('ชื่อห้องใหม่')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('เช่น ห้องนั่งเล่นแมว, มุมพักผ่อน')
                        .setRequired(true)
                        .setMaxLength(30);

                    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                    return await interaction.showModal(modal);
                }

                else if (customId === 'voice_room_close') {
                    const { data: room } = await supabase.from('voice_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
                    if (!room) return interaction.reply({ content: '❌ ไม่พบข้อมูลห้องนี้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    if (room.owner_id !== user.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องหรือแอดมินเท่านั้นที่ปิดห้องได้เมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                    }

                    await interaction.reply({ content: '🔊 กำลังปิดห้องเสียงและลบข้อมูล... ขอบคุณที่ใช้บริการนะเมี๊ยวว!🐾🌸' });
                    const { deleteVoiceRoom } = require('../../utils/voiceRoomCleanup');
                    await deleteVoiceRoom(interaction.client, room);
                }

                else if (customId === 'voice_room_close_all') {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่สั่งปิดห้องทั้งหมดได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }

                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const { data: rooms } = await supabase.from('voice_rooms').select('*').eq('guild_id', guild.id).eq('is_deleted', false);

                    if (!rooms || rooms.length === 0) {
                        return interaction.editReply({ content: '📭 ไม่มีห้องเสียงที่เปิดอยู่ตอนนี้เมี๊ยว!' });
                    }

                    const { deleteVoiceRoom } = require('../../utils/voiceRoomCleanup');
                    for (const room of rooms) {
                        await deleteVoiceRoom(interaction.client, room);
                    }

                    return interaction.editReply({ content: `✅ ปิดห้องเสียงทั้งหมด ${rooms.length} ห้องเรียบร้อยแล้วเมี๊ยวว!🐾` });
                }

                else if (customId.startsWith('voice_room_form_delete:')) {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบปุ่มนี้ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }
                    const formId = customId.split(':')[1];
                    await supabase.from('voice_room_forms').delete().eq('id', formId);
                    await interaction.message.delete().catch(() => { });
                    return interaction.reply({ content: '🗑️ ลบฟอร์มห้องเสียงออกจากระบบเรียบร้อยแล้วเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                }

                // --- AI Speak: Approve/Reject ---
                else if (customId.startsWith('ai_speak_approve:')) {
                    const originalId = customId.split(':')[1];
                    const cached = interaction.client.aiSpeakCache?.get(originalId);

                    if (!cached) return interaction.reply({ content: '❌ ข้อมูลหมดอายุหรือหาไม่เจอแล้วเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });

                    await interaction.deferUpdate();

                    // จัดการ Webhook เมี๊ยว🐾
                    if (!interaction.client.webhookCache) interaction.client.webhookCache = new Map();
                    let webhook = interaction.client.webhookCache.get(interaction.channelId);
                    if (!webhook) {
                        const webhooks = await interaction.channel.fetchWebhooks();
                        webhook = webhooks.find(wh => wh.name === 'PurrPaw-AI');
                        if (!webhook) webhook = await interaction.channel.createWebhook({ name: 'PurrPaw-AI' });
                        interaction.client.webhookCache.set(interaction.channelId, webhook);
                    }

                    await webhook.send({
                        content: cached.content,
                        username: cached.charName,
                        avatarURL: cached.charAvatar || null
                    });

                    interaction.client.aiSpeakCache.delete(originalId);
                    return interaction.editReply({ content: '✅ ส่งข้อความเรียบร้อยแล้วเมี๊ยวว!🐾', embeds: [], components: [] });
                }

                else if (customId.startsWith('ai_speak_reject:')) {
                    const originalId = customId.split(':')[1];
                    interaction.client.aiSpeakCache?.delete(originalId);
                    return interaction.update({ content: '❌ ยกเลิกการส่งข้อความแล้วเมี๊ยว!🐾', embeds: [], components: [] });
                }

                else if (customId.startsWith('ai_speak_edit:')) {
                    const originalId = customId.split(':')[1];
                    const cached = interaction.client.aiSpeakCache?.get(originalId);

                    if (!cached) return interaction.reply({ content: '❌ ข้อมูลหมดอายุหรือหาไม่เจอแล้วเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });

                    const modal = new ModalBuilder()
                        .setCustomId(`ai_speak_save:${originalId}`)
                        .setTitle('📝 แก้ไขข้อความ AI');

                    const textInput = new TextInputBuilder()
                        .setCustomId('new_content')
                        .setLabel('ข้อความที่คุณต้องการแก้ไข')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(cached.content)
                        .setRequired(true);

                    const row = new ActionRowBuilder().addComponents(textInput);
                    modal.addComponents(row);

                    return await interaction.showModal(modal);
                }

                // --- ปุ่มลบฟอร์มปกติ (แอดมินเท่านั้น) ---
                else if (customId.startsWith('form_delete:')) {
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบฟอร์มนี้ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }
                    const formId = customId.split(':')[1];
                    await supabase.from('forms').delete().eq('id', formId);
                    await interaction.message.delete().catch(() => { });
                    return interaction.reply({ content: '🗑️ ลบแบบฟอร์มออกจากระบบเรียบร้อยแล้วเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                }

                // --- [Ticket] ปุ่มเปิดหน้าต่างแจ้งเรื่อง ---
                else if (customId.startsWith('ticket_open:')) {
                    const [_, pendingId, rejectId, approveId] = customId.split(':');
                    const modal = new ModalBuilder()
                        .setCustomId(`ticket_submit:${pendingId}:${rejectId}:${approveId}`)
                        .setTitle('🎫 แจ้งเรื่อง / เปิด Ticket เมี๊ยว🐾');

                    const titleInput = new TextInputBuilder()
                        .setCustomId('ticket_title_input')
                        .setLabel('หัวข้อเรื่องที่ต้องการแจ้ง')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('เช่น: สอบถามเรื่องยศ, แจ้งพบบั๊ก...')
                        .setRequired(true);

                    const messageInput = new TextInputBuilder()
                        .setCustomId('ticket_message_input')
                        .setLabel('รายละเอียดเพิ่มเติม')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('อธิบายรายละเอียดที่ต้องการให้แอดมินทราบเมี๊ยว...')
                        .setRequired(true);

                    const imageInput = new TextInputBuilder()
                        .setCustomId('ticket_image_input')
                        .setLabel('ลิงก์รูปภาพประกอบ (ถ้ามี)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('https://... (ถ้าไม่มีให้เว้นว่างไว้นะเมี๊ยว)')
                        .setRequired(false);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(titleInput),
                        new ActionRowBuilder().addComponents(messageInput),
                        new ActionRowBuilder().addComponents(imageInput),
                    );
                    await interaction.showModal(modal);
                }

                // --- Summary: Send/Cancel ---
                else if (customId.startsWith('summary_send:')) {
                    const originalId = customId.split(':')[1];
                    const cached = interaction.client.summaryCache?.get(originalId);

                    if (!cached) return interaction.reply({ content: '❌ ข้อมูลหมดอายุหรือหาไม่เจอแล้วเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });

                    await interaction.deferUpdate(); // 🚀 รับเรื่องทันทีป้องกัน Timeout เมี๊ยว🐾

                    const embed = new EmbedBuilder()
                        .setTitle('📋 สรุปความเคลื่อนไหวในห้องนี้เมี๊ยวว! 🐾')
                        .setDescription(cached.content)
                        .setColor('#FFB6C1')
                        .setThumbnail(interaction.client.user.displayAvatarURL())
                        .setFooter({ text: `สรุปโดย PurrPaw AI (ย้อนหลัง ${cached.limit} ข้อความ) 🐈✨` })
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [embed] });

                    interaction.client.summaryCache.delete(originalId);
                    return interaction.editReply({ content: '✅ ส่งสรุปเข้าห้องเรียบร้อยแล้วเมี๊ยวว!🐾', embeds: [], components: [] });
                }

                else if (customId.startsWith('summary_cancel:')) {
                    const originalId = customId.split(':')[1];
                    interaction.client.summaryCache?.delete(originalId);
                    return interaction.update({ content: '❌ ยกเลิกการส่งสรุปแล้วเมี๊ยว!🐾', embeds: [], components: [] });
                }

                // --- Translate: Send/Cancel ---
                else if (customId.startsWith('translate_send:')) {
                    const originalId = customId.split(':')[1];
                    const cached = interaction.client.translateCache?.get(originalId);

                    if (!cached) return interaction.reply({ content: '❌ ข้อมูลหมดอายุหรือหาไม่เจอแล้วเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });

                    await interaction.deferUpdate();

                    const embed = new EmbedBuilder()
                        .setTitle('🌐 แปลบทสนทนาในห้องนี้เมี๊ยวว! 🐾')
                        .setDescription(cached.content)
                        .setColor('#00AAFF')
                        .setThumbnail(interaction.client.user.displayAvatarURL())
                        .setFooter({ text: `แปลโดย PurrPaw AI (ย้อนหลัง ${cached.limit} ข้อความ) 🐈✨` })
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [embed] });

                    interaction.client.translateCache.delete(originalId);
                    return interaction.editReply({ content: '✅ ส่งบทแปลเข้าห้องเรียบร้อยแล้วเมี๊ยวว!🐾', embeds: [], components: [] });
                }

                else if (customId.startsWith('translate_cancel:')) {
                    const originalId = customId.split(':')[1];
                    interaction.client.translateCache?.delete(originalId);
                    return interaction.update({ content: '❌ ยกเลิกการส่งบทแปลแล้วเมี๊ยว!🐾', embeds: [], components: [] });
                }

                // --- [Ticket] ปุ่มเปลี่ยนสถานะ (สำหรับ Admin) ---
                else if (customId.startsWith('ticket_status:')) {
                    const [_, ticketId, newStatus] = customId.split(':');
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่จัดการ Ticket ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }

                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                    const { data: ticket, error } = await supabase
                        .from('tickets')
                        .select('*')
                        .eq('id', ticketId)
                        .single();

                    if (error || !ticket) return interaction.editReply({ content: '❌ ไม่พบข้อมูล Ticket ในระบบเมี๊ยว' });

                    // ตัดสินใจว่าจะย้ายไปห้องไหน
                    let targetChannelId = ticket.pending_channel_id;
                    if (newStatus === 'Reject') targetChannelId = ticket.reject_channel_id;
                    if (newStatus === 'Acknowledge' || newStatus === 'Done') targetChannelId = ticket.approve_channel_id;

                    const targetChannel = guild.channels.cache.get(targetChannelId);
                    if (!targetChannel) return interaction.editReply({ content: '❌ ไม่พบห้องเป้าหมายในเซิร์ฟเวอร์นี้เมี๊ยว!' });

                    // อัปเดตข้อมูลใน DB ก่อน
                    await supabase
                        .from('tickets')
                        .update({
                            status: newStatus,
                            admin_channel_id: targetChannelId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', ticketId);

                    // สร้าง Embed ใหม่
                    const oldEmbed = interaction.message.embeds[0];
                    const statusEmoji = {
                        'Pending': '🟡',
                        'Acknowledge': '🔵',
                        'Reject': '🔴',
                        'Done': '🟢'
                    };

                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor(newStatus === 'Done' ? 0x22C55E : (newStatus === 'Reject' ? 0xEF4444 : (newStatus === 'Acknowledge' ? 0x3B82F6 : 0xFAB005)))
                        .spliceFields(2, 1, { name: 'สถานะ', value: `${statusEmoji[newStatus] || ''} **${newStatus}** (โดย ${user.tag})`, inline: true });

                    const row = ActionRowBuilder.from(interaction.message.components[0]);
                    // ตรวจสอบว่ามีปุ่มลบอยู่หรือยัง ถ้าไม่มีให้เพิ่มเมี๊ยว🐾
                    if (!row.components.find(c => c.data.custom_id?.startsWith('ticket_delete:'))) {
                        row.addComponents(new ButtonBuilder().setCustomId(`ticket_delete:${ticketId}`).setLabel('ลบข้อมูล').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'));
                    }

                    // ส่งเข้าห้องใหม่
                    const newMsg = await targetChannel.send({ embeds: [newEmbed], components: [row] });

                    // ลบข้อความเก่า
                    await interaction.message.delete().catch(() => { });

                    return interaction.editReply({ content: `✅ ย้าย Ticket ไปยังห้อง <#${targetChannelId}> เรียบร้อยแล้วเมี๊ยวว!🐾` });
                }

                // --- [Ticket] ปุ่มลบข้อมูล (สำหรับ Admin) ---
                else if (customId.startsWith('ticket_delete:')) {
                    const ticketId = customId.split(':')[1];
                    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบ Ticket ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                    }

                    await supabase.from('tickets').delete().eq('id', ticketId);
                    await interaction.message.delete().catch(() => { });
                    return interaction.reply({ content: '🗑️ ลบข้อมูล Ticket ออกจากระบบเรียบร้อยแล้วเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                }
            }

            // 📝 3. จัดการกรณีเป็น Modal Submit
            else if (interaction.isModalSubmit()) {
                const { customId, guild, user, fields } = interaction;

                // --- แบบฟอร์มปกติ ---
                if (customId.startsWith('form_submit:')) {
                    const formId = customId.split(':')[1];
                    const { data: form } = await supabase.from('forms').select('*').eq('id', formId).single();

                    if (!form) return interaction.editReply({ content: '❌ หาข้อมูลฟอร์มไม่เจอเมี๊ยว! (ฟอร์มอาจจะถูกลบไปแล้วหรือระบบฐานข้อมูลมีปัญหา🐾)' });

                    const answers = [];
                    for (let i = 0; i < (form.modal_questions?.length || 0); i++) {
                        answers.push({ q: form.modal_questions[i], a: fields.getTextInputValue(`form_answer_${i}`) });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('📝 คำขอรับบทบาทใหม่เมี๊ยว')
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                        .setColor(0x3B82F6)
                        .addFields(
                            ...answers.map(ans => ({ name: `Q: ${ans.q}`, value: ans.a || '-' })),
                            { name: '👤 ผู้ใช้งาน', value: `<@${user.id}>`, inline: true },
                            { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
                            { name: 'สถานะ', value: '🟡 **รอดำเนินการ**', inline: true }
                        )
                        .setFooter({ text: `แบบฟอร์ม: ${form.title}` })
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`form_approve:${formId}:${user.id}`).setLabel('อนุมัติ').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`form_reject:${formId}:${user.id}`).setLabel('ปฏิเสธ').setStyle(ButtonStyle.Danger)
                    );

                    const logChannelId = form.log_channel_id || settings.form?.approve_channel_id;
                    const logChannel = logChannelId ? (guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null)) : null;

                    if (form.mode === 'auto') {
                        const targetMember = await guild.members.fetch(user.id).catch(() => null);
                        if (targetMember) {
                            if (form.role_id) await targetMember.roles.add(form.role_id).catch(() => { });
                            if (form.remove_role_id) await targetMember.roles.remove(form.remove_role_id).catch(() => { });
                        }

                        if (logChannel) {
                            const autoEmbed = EmbedBuilder.from(embed)
                                .setColor(0x22C55E)
                                .addFields({ name: 'สถานะ', value: '✅ อนุมัติอัตโนมัติ' });
                            
                            if (logChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
                                await logChannel.send({ embeds: [autoEmbed] });
                            }
                        }
                        return interaction.editReply({ content: '✅ ส่งแบบฟอร์มและดำเนินการเรียบร้อยแล้วเมี๊ยวว!🐾' });
                    } else {
                        // Manual Mode
                        if (logChannel) {
                            if (!logChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
                                return interaction.editReply({ content: `❌ บอทไม่มีสิทธิ์ส่งข้อความในห้อง <#${logChannel.id}> เมี๊ยว! กรุณาตรวจสอบสิทธิ์บอทด้วยนะ🐾` });
                            }

                            await logChannel.send({ embeds: [embed], components: [row] });
                            return interaction.editReply({ content: `✅ ส่งแบบฟอร์มเรียบร้อยแล้วเมี๊ยวว! (ส่งไปที่ห้อง #${logChannel.name}) 🐾 กรุณารอแอดมินตรวจสอบนะเมี๊ยวว` });
                        } else {
                            console.error(`Form submission failed: No log channel found for guild ${guild.id}`);
                            return interaction.editReply({ content: '❌ งื้อออ ส่งแบบฟอร์มไม่สำเร็จเมี๊ยว! (ไม่พบห้องสำหรับส่งข้อมูลให้แอดมิน กรุณาใช้คำสั่ง `/form set` เพื่อตั้งค่าห้องก่อนนะเมี๊ยว🐾)' });
                        }
                    }
                }

                // --- เปลี่ยนชื่อห้องส่วนตัว ---
                else if (customId === 'private_room_rename_modal') {
                    const newName = fields.getTextInputValue('private_room_new_name');
                    const cleanName = newName.replace(/[^a-zA-Z0-9ก-๙\s]/g, '').trim();
                    if (!cleanName) return interaction.reply({ content: '❌ ชื่อห้องไม่ถูกต้องเมี๊ยว!', flags: [MessageFlags.Ephemeral] });

                    await interaction.channel.setName(`🏠-${cleanName}`);
                    return interaction.reply({ content: `📝 เปลี่ยนชื่อห้องเป็น **🏠-${cleanName}** เรียบร้อยแล้วเมี๊ยวว!🐾`, flags: [MessageFlags.Ephemeral] });
                }

                // --- เปลี่ยนชื่อห้องเสียงเฉพาะกิจ ---
                else if (customId === 'voice_room_rename_modal') {
                    const newName = fields.getTextInputValue('voice_room_new_name');
                    const cleanName = newName.replace(/[^a-zA-Z0-9ก-ฮอะ-์]/g, '-').toLowerCase();
                    const finalName = `🔊-${cleanName}`;

                    try {
                        await interaction.channel.setName(finalName);
                        return interaction.reply({ content: `📝 เปลี่ยนชื่อห้องเสียงเป็น **${finalName}** เรียบร้อยแล้วเมี๊ยวว!🐾`, flags: [MessageFlags.Ephemeral] });
                    } catch (err) {
                        return interaction.reply({ content: '❌ เปลี่ยนชื่อไม่สำเร็จ (อาจจะติด Cooldown ของ Discord นะเมี๊ยว🐾)', flags: [MessageFlags.Ephemeral] });
                    }
                }

                // --- AI Speak: Save Edit ---
                else if (customId.startsWith('ai_speak_save:')) {
                    const originalId = customId.split(':')[1];
                    const newContent = fields.getTextInputValue('new_content');
                    const cached = interaction.client.aiSpeakCache?.get(originalId);

                    if (!cached) return interaction.reply({ content: '❌ ข้อมูลหมดอายุหรือหาไม่เจอแล้วเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });

                    cached.content = newContent;
                    interaction.client.aiSpeakCache.set(originalId, cached);

                    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setDescription(newContent);
                    return interaction.update({ embeds: [newEmbed] });
                }

                // --- Ticket: Submit ---
                else if (customId.startsWith('ticket_submit:')) {
                    const [_, pendingId, rejectId, approveId] = customId.split(':');
                    const title = fields.getTextInputValue('ticket_title_input');
                    const message = fields.getTextInputValue('ticket_message_input');
                    const imageUrl = fields.getTextInputValue('ticket_image_input');

                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                    const { data: ticket, error } = await supabase
                        .from('tickets')
                        .insert({
                            guild_id: guild.id,
                            user_id: user.id,
                            title,
                            message,
                            image_url: imageUrl || null,
                            pending_channel_id: pendingId,
                            reject_channel_id: rejectId,
                            approve_channel_id: approveId,
                            status: 'Pending'
                        })
                        .select()
                        .single();

                    if (error) return interaction.editReply({ content: `งื้อออ บันทึกข้อมูลไม่สำเร็จเมี๊ยว: ${error.message}` });

                    // ส่งแจ้งเตือนเข้าห้อง Pending
                    const pendingChannel = guild.channels.cache.get(pendingId);
                    if (pendingChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle(`🎫 Ticket ใหม่: ${title}`)
                            .setColor(0xFAB005)
                            .setThumbnail(user.displayAvatarURL())
                            .addFields(
                                { name: '👤 ผู้แจ้ง', value: `<@${user.id}> (${user.tag})`, inline: true },
                                { name: '🆔 Ticket ID', value: `\`${ticket.id}\``, inline: true },
                                { name: 'สถานะ', value: '🟡 **Pending**', inline: true },
                                { name: '📄 รายละเอียด', value: message }
                            )
                            .setTimestamp();

                        if (imageUrl && imageUrl.startsWith('http')) embed.setImage(imageUrl);

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`ticket_status:${ticket.id}:Acknowledge`).setLabel('รับเรื่อง').setStyle(ButtonStyle.Primary).setEmoji('👀'),
                            new ButtonBuilder().setCustomId(`ticket_status:${ticket.id}:Done`).setLabel('เสร็จสิ้น').setStyle(ButtonStyle.Success).setEmoji('✅'),
                            new ButtonBuilder().setCustomId(`ticket_status:${ticket.id}:Reject`).setLabel('ปฏิเสธ').setStyle(ButtonStyle.Danger).setEmoji('❌')
                        );

                        await pendingChannel.send({ embeds: [embed], components: [row] });
                    }

                    return interaction.editReply({ content: '✅ ส่งข้อมูลแจ้งเรื่องเรียบร้อยแล้วเมี๊ยวว!🐾 ขอบคุณที่แจ้งเข้ามานะเมี๊ยวว' });
                }
            }
        } catch (error) {
            if (error.code === 10062) return; // Silent on Unknown Interaction
            console.error('Interaction Error:', error);
            const errorMsg = { content: `งื้อออ เกิดข้อผิดพลาดเมี๊ยว: \`${error.message}\``, flags: [MessageFlags.Ephemeral] };
            if (interaction.deferred || interaction.replied) await interaction.editReply(errorMsg).catch(() => { });
            else await interaction.reply(errorMsg).catch(() => { });
        }
    }
};

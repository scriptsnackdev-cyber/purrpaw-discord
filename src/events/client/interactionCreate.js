const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getGuildData } = require('../../utils/guildCache');
const supabase = require('../../supabaseClient');
const { handleRPGAction } = require('../../utils/rpgManager');
const { generateRPGImage } = require('../../utils/rpgImage');


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
            return interaction.reply({ content: '🐾 ใจเย็นๆ นะเมี๊ยววว อย่ารัวปุ่มสิ!', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }
        interaction.client.interactionCooldowns.set(cooldownKey, now);

        try {
            // --- 1. ดึงข้อมูลฟีเจอร์และเซ็ตติ้งจาก Cache (เริ่มดึงไว้ก่อนเมี๊ยว🐾) ---
            const guildDataPromise = getGuildData(interaction.guild.id);

            // 💾 1. จัดการกรณีเป็น Slash Command
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) return;

                // ⭐ สำหรับคำสั่งที่รู้ว่าต้องใช้เวลาหรือเป็น Ephemeral ให้ Defer ไว้ก่อนทันทีเพื่อเลี่ยง Timeout 3s เมี๊ยว🐾
                if (interaction.commandName === 'aichat') {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }

                // รอข้อมูล Feature/Settings
                const { features, settings } = await guildDataPromise;

                // ตรวจสอบการเปิดใช้งานฟีเจอร์ (ยกเว้นคำสั่งที่ใช้สำหรับเปิด/ปิดระบบเอง)
                const subcommand = interaction.options.getSubcommand(false);
                const isEnableDisable = subcommand === 'enable' || subcommand === 'disable';
                
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

            // --- ปุ่ม MBTI ---
            else if (customId === 'mbti_start') {
                if (features.mbti === false) return interaction.reply({ content: '❌ ระบบ MBTI ถูกปิดใช้งานอยู่เมี๊ยว', flags: [MessageFlags.Ephemeral] });
                const { startTest } = require('../../commands/mbti/mbti');
                await startTest(interaction);
            }

            // --- ปุ่ม SBTI ---
            else if (customId === 'sbti_start') {
                if (features.sbti === false) return interaction.reply({ content: '❌ ระบบ SBTI ถูกปิดใช้งานอยู่เมี๊ยว', flags: [MessageFlags.Ephemeral] });
                const { startTest } = require('../../commands/mbti/sbti');
                await startTest(interaction);
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
                    if (form.role_id) await targetMember.roles.add(form.role_id).catch(() => {});
                    if (form.remove_role_id) await targetMember.roles.remove(form.remove_role_id).catch(() => {});
                }
                
                const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x22C55E).addFields({ name: 'สถานะ', value: `✅ อนุมัติโดย ${user.tag}` });
                await interaction.update({ embeds: [newEmbed], components: [] });
            }

            // --- ปุ่มปฏิเสธฟอร์ม (แอดมิน) ---
            else if (customId.startsWith('form_reject:')) {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ใช้งานได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xEF4444).addFields({ name: 'สถานะ', value: `❌ ปฏิเสธโดย ${user.tag}` });
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

            // --- ปุ่มลบฟอร์มห้องส่วนตัว ---
            else if (customId.startsWith('private_room_form_delete:')) {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบปุ่มนี้ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                }
                const formId = customId.split(':')[1];
                await supabase.from('private_room_forms').delete().eq('id', formId);
                await interaction.message.delete().catch(() => {});
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
                await interaction.message.delete().catch(() => {});
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

            // --- ปุ่มลบฟอร์มปกติ (แอดมินเท่านั้น) ---
            else if (customId.startsWith('form_delete:')) {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบฟอร์มนี้ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                }
                const formId = customId.split(':')[1];
                await supabase.from('forms').delete().eq('id', formId);
                await interaction.message.delete().catch(() => {});
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
                    row.addComponents(
                        new ButtonBuilder().setCustomId(`ticket_delete:${ticketId}`).setLabel('ลบ').setStyle(ButtonStyle.Secondary).setEmoji('🗑️')
                    );
                }

                // ส่งเข้าห้องใหม่
                const newMsg = await targetChannel.send({ embeds: [newEmbed], components: [row] });
                
                // อัปเดต Message ID
                await supabase.from('tickets').update({ admin_message_id: newMsg.id }).eq('id', ticketId);

                // ลบข้อความเก่า
                await interaction.message.delete().catch(() => {});

                await interaction.editReply({ content: `✅ ย้าย Ticket ไปที่ห้อง <#${targetChannelId}> เรียบร้อยแล้วเมี๊ยวว!🐾` });
            }

            // --- [Ticket] ปุ่มลบ Ticket รายอัน ---
            else if (customId.startsWith('ticket_delete:')) {
                const ticketId = customId.split(':')[1];
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่ลบ Ticket ได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                }

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                await supabase.from('tickets').delete().eq('id', ticketId);
                await interaction.message.delete().catch(() => {});
                return interaction.editReply({ content: '🗑️ ลบ Ticket ออกจากระบบเรียบร้อยแล้วเมี๊ยว!' });
            }

            // --- [Ticket] ปุ่มยืนยันล้างทั้งหมด ---
            else if (customId === 'ticket_clean_confirm') {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'เฉพาะแอดมินเท่านั้นที่สั่งล้างข้อมูลได้นะเมี๊ยว!🐾', flags: [MessageFlags.Ephemeral] });
                }

                await interaction.deferUpdate();
                await interaction.editReply({ content: '⏳ กำลังล้างข้อมูล Ticket ทั้งหมด... อาจใช้เวลาสักครู่นะเมี๊ยว🐾', components: [] });

                try {
                    const { data: tickets } = await supabase.from('tickets').select('*').eq('guild_id', guild.id);
                    
                    if (tickets && tickets.length > 0) {
                        for (const t of tickets) {
                            // พยายามลบข้อความใน Discord
                            try {
                                const ch = guild.channels.cache.get(t.admin_channel_id);
                                if (ch) {
                                    const msg = await ch.messages.fetch(t.admin_message_id).catch(() => null);
                                    if (msg) await msg.delete().catch(() => {});
                                }
                            } catch (e) {}
                        }
                        // ลบจาก Database
                        await supabase.from('tickets').delete().eq('guild_id', guild.id);
                    }

                    return interaction.editReply({ content: '✅ ล้างข้อมูล Ticket และข้อความทั้งหมดในเซิร์ฟเวอร์เรียบร้อยแล้วเมี๊ยวว!🐾', embeds: [] });
                } catch (err) {
                    console.error('All-Clean Error:', err);
                    return interaction.editReply({ content: `❌ เกิดข้อผิดพลาดในการล้างข้อมูล: ${err.message}`, embeds: [] });
                }
            }

            // --- [Ticket] ปุ่มยกเลิกการล้าง ---
            else if (customId === 'ticket_clean_cancel') {
                return await interaction.update({ content: '❌ ยกเลิกการล้างข้อมูลแล้วเมี๊ยว!', embeds: [], components: [] });
            }

            // --- ปุ่มดูคิวเพลง + ขึ้นมาคิวแรก ---
            else if (customId === 'music_queue_btn') {
                const queue = interaction.client.distube.getQueue(interaction.guildId);
                if (!queue || queue.songs.length <= 1) {
                    return interaction.reply({ content: '📭 ไม่มีเพลงต่อแถวอยู่ในคิวเลยเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
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
                            return await interaction.reply({ content: '⏹️ แยกย้ายกันกลับบ้านนะเมี๊ยวว!🐾🌸', flags: [MessageFlags.Ephemeral] });
                        } else {
                            return await interaction.reply({ content: '❌ บอทไม่ได้อยู่ในห้องพูดคุยตอนนี้นะเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                        }
                    }

                    // --- คำสั่งอื่นๆ: ต้องมีคิวเพลงเมี๊ยว ---
                    if (!queue) return interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่นอยู่เมี๊ยว!', flags: [MessageFlags.Ephemeral] });

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
                                await interaction.reply({ content: '⏭️ ข้ามเพลงให้แล้วเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                            } catch {
                                await interaction.reply({ content: '❌ ไม่มีเพลงถัดไปในคิวเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
                            }
                            break;
                        case 'loop':
                            const mode = queue.repeatMode === 1 ? 0 : 1;
                            queue.setRepeatMode(mode);
                            await interaction.reply({ content: `🔁 วนซ้ำเพลงนี้: **${mode === 1 ? 'เปิด' : 'ปิด'}** ให้แล้วนะเมี๊ยว!`, flags: [MessageFlags.Ephemeral] });
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
                    if (!interaction.replied) await interaction.reply({ content: 'เกิดข้อผิดพลาดในการควบคุมเพลงเมี๊ยว...', flags: [MessageFlags.Ephemeral] });
                }
            }
        }

        // --- จัดการ User Select Menu สำหรับห้องส่วนตัว ---
        else if (interaction.isUserSelectMenu()) {
            const { customId, values, user } = interaction;
            if (customId === 'private_room_invite_select' || customId === 'private_room_kick_select') {
                const isInvite = customId === 'private_room_invite_select';
                
                // บันทึกข้อมูลการเลือกลง Map เมี๊ยว🐾
                if (!interaction.client.privateRoomConfirm) interaction.client.privateRoomConfirm = new Map();
                interaction.client.privateRoomConfirm.set(interaction.message.id, values);

                const { UserSelectMenuBuilder } = require('discord.js');
                const select = new UserSelectMenuBuilder()
                    .setCustomId(isInvite ? 'private_room_invite_select' : 'private_room_kick_select')
                    .setPlaceholder(isInvite ? 'เลือกเพื่อนที่ต้องการชวนเมี๊ยว🐾' : 'เลือกเพื่อนที่ต้องการเตะออกเมี๊ยว🐾')
                    .setMinValues(1)
                    .setMaxValues(5)
                    .setDefaultUsers(values);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`private_room_confirm:${isInvite ? 'invite' : 'kick'}`)
                        .setLabel(isInvite ? 'ยืนยันการเชิญเมี๊ยว🐾' : 'ยืนยันการเตะเมี๊ยว🐾')
                        .setStyle(isInvite ? ButtonStyle.Success : ButtonStyle.Danger)
                );

                const selectRow = new ActionRowBuilder().addComponents(select);
                const userList = values.map(id => `<@${id}>`).join(', ');

                return interaction.update({ 
                    content: `💡 คุณเลือกเพื่อน ${values.length} คน:\n${userList}\n\n**กดปุ่มด้านล่างเพื่อยืนยัน หรือเลือกใหม่ได้เลยนะเมี๊ยว!**`, 
                    components: [selectRow, row] 
                });
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
                    return interaction.reply({ content: '❌ คิวเพลงหมดแล้วเมี๊ยว! ไม่มีเพลงให้ย้ายเป็นคิวแรกเรยเมี๊ยว', flags: [MessageFlags.Ephemeral] });
                }

                if (isNaN(pickNum) || pickNum < 1 || pickNum > 5) {
                    return interaction.reply({ content: `❌ ใส่ตัวเลข 1-5 เท่านั้นนะเมี๊ยว🐾`, flags: [MessageFlags.Ephemeral] });
                }

                // ⭐ ใช้ Snapshot ค้นหาเพลงที่ถูกต้องในคิวปัจจุบันเมี๊ยว🐾
                const snapshotKey = `${guild.id}-${user.id}`;
                const snapshot = interaction.client._queueSnapshots?.get(snapshotKey);

                // ถ้า Snapshot เก่นกว่า 30 วินาที ให้เตือนเมี๊ยว🐾
                if (!snapshot || Date.now() - snapshot.timestamp > 30000) {
                    return interaction.reply({ content: '❌ คิวอาจเปลี่ยนไปแล้วเมี๊ยว! กรุณาเปิดคิวใหม่อีกครั้งนะ🐾', flags: [MessageFlags.Ephemeral] });
                }

                const targetSong = snapshot.songs[pickNum - 1];
                if (!targetSong) {
                    return interaction.reply({ content: `❌ ไม่พบเพลงอันดับ ${pickNum} ในคิวเมี๊ยว!`, flags: [MessageFlags.Ephemeral] });
                }

                // ค้นหาเพลงจากชื่อจริงในคิวปัจจุบัน (ไม่เชื่อตัวเลขตาบอด)
                const realIdx = queue.songs.findIndex((s, i) => i > 0 && s.url === targetSong.url);
                if (realIdx === -1) {
                    return interaction.reply({ content: '❌ เพลงนี้หลุดออกจากคิวไปแล้วเมี๊ยว (เพลงอาจถูกข้ามหรือเปลี่ยนไประหว่างรอ)🐾', flags: [MessageFlags.Ephemeral] });
                }

                const [picked] = queue.songs.splice(realIdx, 1);
                queue.songs.splice(1, 0, picked);

                // ลบ Snapshot หลังใช้งานเมี๊ยว🐾
                interaction.client._queueSnapshots.delete(snapshotKey);

                return interaction.reply({ content: `✅ ย้าย **${picked.name}** มาเป็นคิวถัดไปแล้วเมี๊ยวว!🐾🌸`, flags: [MessageFlags.Ephemeral] });
            }

            // --- เพิ่มเพลงผ่าน Popup ---
            if (customId === 'music_add_submit') {
                const query = fields.getTextInputValue('music_query_input');
                const memberVoice = guild.members.cache.get(user.id)?.voice?.channel;
                if (!memberVoice) return interaction.reply({ content: '❌ คุณต้องเข้าห้องพูดคุย (Voice) ก่อนนะเมี๊ยว!', flags: [MessageFlags.Ephemeral] });

                await interaction.deferUpdate().catch(() => interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {}));
                try {
                    await interaction.client.distube.play(memberVoice, query, {
                        textChannel: interaction.channel,
                        member: guild.members.cache.get(user.id),
                    });
                } catch (err) {
                    await interaction.followUp({ content: `❌ เพิ่มเพลงไม่ได้เมี๊ยว: \`${err.message}\``, flags: [MessageFlags.Ephemeral] });
                }
                return;
            }

            // --- ตั้งค่า Welcome ---
            if (customId === 'welcome_settings_modal') {
                const msg = fields.getTextInputValue('welcome_message_input');
                settings.welcome = { ...settings.welcome, message: msg };
                await supabase.from('guilds').update({ settings }).eq('id', guild.id);
                return interaction.reply({ content: '✅ อัปเดตข้อความต้อนรับเรียบร้อยเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
            }

            // --- ตั้งค่า Goodbye ---
            else if (customId === 'goodbye_settings_modal') {
                const msg = fields.getTextInputValue('goodbye_message_input');
                settings.goodbye = { ...settings.goodbye, message: msg };
                await supabase.from('guilds').update({ settings }).eq('id', guild.id);
                return interaction.reply({ content: '✅ อัปเดตข้อความบอกลาเรียบร้อยเมี๊ยว!', flags: [MessageFlags.Ephemeral] });
            }

            // --- ส่งฟอร์มสมัคร ---
            else if (customId.startsWith('form_submit:')) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const formId = customId.split(':')[1];
                
                try {
                    const { data: form, error: fetchError } = await supabase.from('forms').select('*').eq('id', formId).single();
                    if (fetchError || !form) return interaction.editReply({ content: '❌ ไม่พบข้อมูลฟอร์มเมี๊ยว (อาจถูกลบไปแล้ว)' });

                    const questions = form.modal_questions || [];
                    const QnA = questions.map((q, i) => `**Q: ${q}**\n${fields.getTextInputValue(`form_answer_${i}`)}`).join('\n\n');

                    if (form.mode === 'auto') {
                        const member = await guild.members.fetch(user.id);
                        if (form.role_id) await member.roles.add(form.role_id).catch(() => {});
                        if (form.remove_role_id) await member.roles.remove(form.remove_role_id).catch(() => {});
                        return interaction.editReply({ content: '✅ อนุมัติและแจกยศให้เรียบร้อยแล้วเมี๊ยวว! (ระบบอัตโนมัติ🐾)' });
                    } else {
                        const approveChId = settings?.form?.approve_channel_id;
                        const channel = guild.channels.cache.get(approveChId);
                        if (!channel) return interaction.editReply({ content: '❌ ยังไม่ได้ตั้งค่าห้องอนุมัติสำหรับแอดมินเมี๊ยว! (โปรดแจ้งแอดมินให้รัน `/form set` นะเมี๊ยว🐾)' });

                        const embed = new EmbedBuilder()
                            .setTitle('📝 คำขอรับบทบาทใหม่เมี๊ยว')
                            .setColor(0xFAB005)
                            .setThumbnail(user.displayAvatarURL())
                            .addFields(
                                { name: 'ผู้ใช้งาน', value: `<@${user.id}>`, inline: true },
                                { name: 'ID', value: user.id, inline: true }
                            )
                            .setDescription(QnA)
                            .setTimestamp();

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`form_approve:${formId}:${user.id}`).setLabel('อนุมัติเมี๊ยว').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`form_reject:${formId}:${user.id}`).setLabel('ปฏิเสธเมี๊ยว').setStyle(ButtonStyle.Danger)
                        );
                        await channel.send({ embeds: [embed], components: [row] });
                        return interaction.editReply({ content: '✅ ส่งคำขอให้แอดมินตรวจสอบแล้วนะเมี๊ยว รอแป๊บน้าา🐾' });
                    }
                } catch (err) {
                    console.error('Modal submit error:', err);
                    return interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาด: \`${err.message}\` 🐾` });
                }
            }

            // --- [Ticket] ส่งข้อมูล Ticket ---
            else if (customId.startsWith('ticket_submit:')) {
                const [_, pendingId, rejectId, approveId] = customId.split(':');
                const ticketTitle = fields.getTextInputValue('ticket_title_input');
                const ticketMessage = fields.getTextInputValue('ticket_message_input');
                const ticketImage = fields.getTextInputValue('ticket_image_input');

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                try {
                    // 1. บันทึกลง Database
                    const { data: ticket, error } = await supabase.from('tickets').insert({
                        guild_id: guild.id,
                        user_id: user.id,
                        user_tag: user.tag,
                        title: ticketTitle,
                        message: ticketMessage,
                        image_url: ticketImage || null,
                        admin_channel_id: pendingId, // เริ่มต้นที่ห้อง Pending
                        pending_channel_id: pendingId,
                        reject_channel_id: rejectId,
                        approve_channel_id: approveId,
                        status: 'Pending'
                    }).select().single();

                    if (error) throw error;

                    // 2. ส่งให้ห้อง Pending
                    const adminChannel = guild.channels.cache.get(pendingId);
                    if (!adminChannel) return interaction.editReply({ content: '❌ ไม่พบห้องสำหรับแอดมินเมี๊ยว! กรุณาแจ้งแอดมินนะ🐾' });

                    const embed = new EmbedBuilder()
                        .setTitle(`🎫 Ticket ใหม่: ${ticketTitle}`)
                        .setColor(0xFAB005)
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: 'ผู้ส่ง', value: `<@${user.id}> (${user.tag})`, inline: true },
                            { name: 'ID ผู้ใช้', value: user.id, inline: true },
                            { name: 'สถานะ', value: '🟡 **Pending**', inline: true },
                            { name: 'รายละเอียด', value: ticketMessage }
                        )
                        .setTimestamp();

                    if (ticketImage && ticketImage.startsWith('http')) {
                        embed.setImage(ticketImage);
                    }

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`ticket_status:${ticket.id}:Acknowledge`).setLabel('รับทราบ (Ack)').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`ticket_status:${ticket.id}:Reject`).setLabel('ปฏิเสธ (Reject)').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`ticket_status:${ticket.id}:Done`).setLabel('เสร็จสิ้น (Done)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`ticket_delete:${ticket.id}`).setLabel('ลบ').setStyle(ButtonStyle.Secondary).setEmoji('🗑️')
                    );

                    const adminMsg = await adminChannel.send({ embeds: [embed], components: [row] });

                    // 3. อัปเดต Message ID กลับลง DB
                    await supabase.from('tickets').update({ admin_message_id: adminMsg.id }).eq('id', ticket.id);

                    return interaction.editReply({ content: '✅ ส่ง Ticket ให้แอดมินเรียบร้อยแล้วเมี๊ยวว! รอการตอบกลับนะ🐾' });

                } catch (err) {
                    console.error('Ticket Submit Error:', err);
                    return interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาดในการส่ง Ticket: \`${err.message}\` 🐾` });
                }
            }

            // --- [Private Room] เปลี่ยนชื่อห้อง ---
            else if (customId === 'private_room_rename_modal') {
                const newName = fields.getTextInputValue('private_room_new_name');
                const cleanName = newName.replace(/[^a-zA-Z0-9ก-ฮอะ-์]/g, '-').toLowerCase();
                const finalName = `🏠-${cleanName}`;

                try {
                    await interaction.channel.setName(finalName);
                    return interaction.reply({ content: `✅ เปลี่ยนชื่อห้องเป็น **${finalName}** เรียบร้อยแล้วเมี๊ยวว!🐾🌸`, flags: [MessageFlags.Ephemeral] });
                } catch (err) {
                    console.error('Error renaming channel via modal:', err);
                    return interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อห้องเมี๊ยว! (อาจจะติด Cooldown ของ Discord นะ🐾)', flags: [MessageFlags.Ephemeral] });
                }
            }
        }
    } catch (error) {
            console.error('Global Interaction Error:', error);
            const errorMessage = '❌ เกิดข้อผิดพลาดบางอย่างภายในระบบเมี๊ยว... ลองใหม่อีกครั้งนะเมี๊ยว!';
            
            try {
                if (interaction.isAutocomplete()) return;
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
                } else {
                    await interaction.followUp({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
                }
            } catch (e) {
                // ถ้าส่งข้อความไม่ได้เลย ก็ปล่อยไปเมี๊ยว🐾
            }
        }
    },
};


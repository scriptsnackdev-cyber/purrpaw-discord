const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getInitialAI } = require('../../utils/openRouter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('initial')
        .setDescription('🏗️ ออกแบบและสร้างเซิฟเวอร์อัตโนมัติด้วย AI')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('prompt').setDescription('แนวเซิฟเวอร์ที่คุณต้องการ (เช่น "เซิฟเวอร์เกมเมอร์", "ชุมชนคนรักแมว")').setRequired(true)),

    async execute(interaction) {
        // ต้องเป็น Admin เท่านั้น
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้เมี๊ยว!', ephemeral: true });
        }

        await interaction.deferReply();
        const prompt = interaction.options.getString('prompt');

        try {
            // 1. เรียก AI เพื่อขอโครงสร้าง (ส่งชื่อ Guild ไปด้วย)
            const rawResponse = await getInitialAI(prompt, interaction.guild.name);
            
            // ล้าง Markdown Block (ถ้ามี)
            const cleanedResponse = rawResponse.replace(/```json|```/g, '').trim();
            let config;
            try {
                config = JSON.parse(cleanedResponse);
            } catch (e) {
                console.error("JSON Parse Error. Raw AI Response:", rawResponse);
                return interaction.editReply({ content: '❌ AI ออกแบบโครงสร้างผิดพลาด (Invalid JSON) ลองใหม่อีกครั้งนะเมี๊ยว' });
            }

            const embed = new EmbedBuilder()
                .setTitle('🏗️ กำลังเนรมิตเซิฟเวอร์ให้ตามคำขอเมี๊ยว!')
                .setDescription(`**ธีม:** ${prompt}\n\n**แผนผังที่ AI ออกแบบ:**\n- ยศ (Roles): ${config.roles?.length || 0} รายการ\n- หมวดหมู่ (Categories): ${config.categories?.length || 0} รายการ\n\n*ระบบกำลังค่อยๆ สร้างเพื่อป้องกันการโดน Discord บล็อกเมี๊ยว...*`)
                .setColor(0x3B82F6)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/9431/9431101.png')
                .setFooter({ text: 'PurrPaw Architect Mode' });

            await interaction.editReply({ embeds: [embed] });

            const guild = interaction.guild;

            const roleMap = new Map();
            let memberRoleId = null;
            let unverifiedRoleId = null;
            let welcomeChannelId = null;
            let goodbyeChannelId = null;
            let subroleChannelId = null;

            // 2. สร้าง Roles
            if (config.roles && Array.isArray(config.roles)) {
                for (const roleData of config.roles) {
                    let mappedPerms = 0n;
                    if (roleData.permissions && Array.isArray(roleData.permissions)) {
                        for (const p of roleData.permissions) {
                            if (PermissionFlagsBits[p]) {
                                mappedPerms |= PermissionFlagsBits[p];
                            }
                        }
                    }

                    const role = await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color || '#FFFFFF',
                        permissions: mappedPerms,
                        reason: 'PurrPaw AI Initializer'
                    }).catch(err => console.error(`Failed to create role ${roleData.name}:`, err));
                    
                    if (role) {
                        roleMap.set(roleData.name, role);
                        if (roleData.is_member_role) memberRoleId = role.id;
                        if (roleData.is_unverified_role) unverifiedRoleId = role.id;
                    }
                    
                    await new Promise(r => setTimeout(r, 1200));
                }
            }

            // ตั้งค่า Auto-Role (ถ้ามียศเริ่มต้น)
            if (unverifiedRoleId) {
                const supabase = require('../../supabaseClient');
                await supabase.from('auto_roles').upsert({ guild_id: guild.id, role_id: unverifiedRoleId }, { onConflict: 'guild_id' });
                console.log(`[Initial] Auto-role set to ${unverifiedRoleId}`);
            }

            // 3. สร้าง Categories และ Channels
            if (config.categories && Array.isArray(config.categories)) {
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                for (const catData of config.categories) {
                    // 🎨 ล้างชื่อหมวดหมู่ (Clean Name) ป้องกัน AI ใส่ของตกแต่งมาซ้ำ
                    const cleanCategoryName = (catData.name || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').replace(/[-─꒰꒱εз⚓]/g, '').trim();
                    const categoryEmoji = catData.emoji || '📁';
                    const formattedCategoryName = `─── ꒰ ${categoryEmoji} ꒱ ${cleanCategoryName} ───`;

                    const categoryOverwrites = [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        }
                    ];
                    
                    if (memberRoleId) {
                        categoryOverwrites.push({
                            id: memberRoleId,
                            allow: [PermissionFlagsBits.ViewChannel],
                        });
                    }

                    // ถ้ามียศ Unverified ให้บังคับซ่อนหมวดหมู่ด้วยยศนั้นด้วย (Double Check)
                    if (unverifiedRoleId) {
                        categoryOverwrites.push({
                            id: unverifiedRoleId,
                            deny: [PermissionFlagsBits.ViewChannel],
                        });
                    }

                    const category = await guild.channels.create({
                        name: formattedCategoryName,
                        type: ChannelType.GuildCategory,
                        permissionOverwrites: categoryOverwrites,
                        reason: 'PurrPaw AI Initializer'
                    }).catch(err => console.error(`Failed to create category ${catData.name}:`, err));

                    await new Promise(r => setTimeout(r, 1500)); 

                    if (category && catData.channels && Array.isArray(catData.channels)) {
                        for (const chanData of catData.channels) {
                            // 🎨 ล้างชื่อห้อง (Clean Name)
                            const cleanChannelName = (chanData.name || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').replace(/[-─꒰꒱εз⚓]/g, '').trim();
                            const channelEmoji = chanData.emoji || (chanData.type === 'GUILD_VOICE' ? '🔊' : '💬');
                            const formattedChannelName = `[ ${channelEmoji} ] ${cleanChannelName}`;

                            const channelOptions = {
                                name: formattedChannelName,
                                type: chanData.type === 'GUILD_VOICE' ? ChannelType.GuildVoice : ChannelType.GuildText,
                                parent: category.id,
                                reason: 'PurrPaw AI Initializer'
                            };

                            if (chanData.is_verify_channel) {
                                channelOptions.permissionOverwrites = [
                                    {
                                        id: guild.roles.everyone.id,
                                        allow: [PermissionFlagsBits.ViewChannel],
                                    }
                                ];
                                if (unverifiedRoleId) {
                                    channelOptions.permissionOverwrites.push({
                                        id: unverifiedRoleId,
                                        allow: [PermissionFlagsBits.ViewChannel],
                                    });
                                }
                            }

                            const newChannel = await guild.channels.create(channelOptions).catch(err => console.error(`Failed to create channel ${chanData.name}:`, err));
                            
                            if (newChannel) {
                                if (chanData.is_welcome_channel) welcomeChannelId = newChannel.id;
                                if (chanData.is_goodbye_channel) goodbyeChannelId = newChannel.id;
                                if (chanData.is_subrole_channel) subroleChannelId = newChannel.id;
                            }
                            
                            if (newChannel && newChannel.isTextBased() && chanData.first_message) {
                                const messagePayload = { content: chanData.first_message };

                                if (chanData.is_verify_channel && memberRoleId) {
                                    // ใช้ปุ่มพิเศษ verify_member ที่จะลบยศ Unverified ออกไปด้วย
                                    const buttonCustomId = unverifiedRoleId 
                                        ? `verify_member:${memberRoleId}:${unverifiedRoleId}`
                                        : `assign_role:${memberRoleId}`;

                                    const row = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(buttonCustomId)
                                            .setLabel('ยืนยันตัวตน (Verify) 🐾')
                                            .setStyle(ButtonStyle.Success)
                                    );
                                    messagePayload.components = [row];
                                }

                                // 🔮 หากเป็นห้อง Fortune ให้ส่งปุ่มดูดวงด้วย
                                if (chanData.is_fortune_channel) {
                                    const fortuneRow = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('fortune_draw')
                                            .setLabel('เสี่ยงทายโชคชะตา (Draw Fortune) 🐾🔮')
                                            .setStyle(ButtonStyle.Primary)
                                    );
                                    
                                    if (messagePayload.components) {
                                        messagePayload.components.push(fortuneRow);
                                    } else {
                                        messagePayload.components = [fortuneRow];
                                    }
                                }

                                await newChannel.send(messagePayload).catch(err => console.error(`Failed to send message in ${chanData.name}:`, err));
                            }
                            
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }
                }
            }

            // ── อัปเดตการตั้งค่า Welcome/Goodbye ลงฐานข้อมูล ──
            if (welcomeChannelId || goodbyeChannelId) {
                const supabase = require('../../supabaseClient');
                const { data: currentGuild } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
                const updatedSettings = currentGuild?.settings || {};

                if (welcomeChannelId) {
                    updatedSettings.welcome = {
                        enabled: true,
                        channel_id: welcomeChannelId,
                        message: config.welcome_message || 'ยินดีต้อนรับคุณ ${User} เมี๊ยวว! 🐾'
                    };
                }

                if (goodbyeChannelId) {
                    updatedSettings.goodbye = {
                        enabled: true,
                        channel_id: goodbyeChannelId,
                        message: config.goodbye_message || 'ลาก่อนนะคุณ ${User} แล้วพบกันใหม่เมี๊ยว... 😢'
                    };
                }

                await supabase.from('guilds').update({ settings: updatedSettings }).eq('id', guild.id);
                console.log('[Initial] Welcome/Goodbye features enabled and configured.');
            }

            // ── จัดการสร้างหน้ารับยศย่อย (Sub-Role Sections) ──
            if (subroleChannelId && config.sub_role_sections && Array.isArray(config.sub_role_sections)) {
                const subroleChannel = guild.channels.cache.get(subroleChannelId);
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

                for (const section of config.sub_role_sections) {
                    const embed = new EmbedBuilder()
                        .setTitle(`ʚ♡ɞ ${section.title} ₊˚`)
                        .setDescription(section.description || 'เลือกยศที่คุณต้องการเมี๊ยวว! 🐾')
                        .setColor(0xFAB005);

                    const rows = [];
                    let currentRow = new ActionRowBuilder();

                    for (const roleData of section.roles) {
                        const newSubRole = await guild.roles.create({
                            name: roleData.name,
                            color: roleData.color || '#FFFFFF',
                            reason: 'PurrPaw Sub-Role Initializer'
                        }).catch(() => null);

                        if (newSubRole) {
                            if (currentRow.components.length >= 5) {
                                rows.push(currentRow);
                                currentRow = new ActionRowBuilder();
                            }

                            currentRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`assign_role:${newSubRole.id}`)
                                    .setLabel(`${roleData.emoji || '🐾'} ${roleData.name}`)
                                    .setStyle(ButtonStyle.Secondary)
                            );
                        }
                        
                        await new Promise(r => setTimeout(r, 1000));
                    }

                    if (currentRow.components.length > 0) rows.push(currentRow);

                    await subroleChannel.send({ embeds: [embed], components: rows }).catch(err => console.error('Failed to send sub-role section:', err));
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ เนรมิตเซิฟเวอร์สำเร็จแล้วเมี๊ยว!')
                .setDescription(`เซิฟเวอร์แนว **"${prompt}"** ถูกสร้างเรียบร้อยแล้ว!\nสนุกกับการพูดคุยนะเมี๊ยวว 🐾`)
                .setColor(0x22C55E)
                .setTimestamp();

            return interaction.followUp({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Initial Command Error:', error);
            return interaction.editReply({ content: `❌ เกิดข้อผิดพลาดระดับระบบ: ${error.message}` });
        }
    }
};

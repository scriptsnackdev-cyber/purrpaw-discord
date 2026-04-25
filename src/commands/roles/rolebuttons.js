const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolebuttons')
        .setDescription('🔘 จัดการปุ่มกดรับบทบาท (Role)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('enable').setDescription('🐾 เปิดการใช้งานระบบปุ่มกดรับ Role'))
        .addSubcommand(subcommand => subcommand.setName('disable').setDescription('🚫 ปิดการใช้งานระบบปุ่มกดรับ Role เมี๊ยว'))
        .addSubcommand(subcommand => 
            subcommand.setName('create')
                .setDescription('✨ สร้างข้อความปุ่มกดรับ Role (1 ปุ่ม) ใหม่เมี๊ยว')
                .addStringOption(option => option.setName('role').setDescription('Role หรือชื่อยศที่ต้องการ (ถ้าไม่มีจะสร้างให้เมี๊ยว)').setRequired(true).setAutocomplete(true))
                .addStringOption(option => option.setName('message').setDescription('เนื้อหาของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(option => option.setName('title').setDescription('หัวข้อของ Embed เมี๊ยว').setRequired(false))
                .addStringOption(option => option.setName('button_label').setDescription('ข้อความบนปุ่มเมี๊ยว').setRequired(false))
                .addChannelOption(option => option.setName('channel').setDescription('ห้องที่ต้องการส่งข้อความเมี๊ยว').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('menu')
                .setDescription('🎀 สร้างเมนูเลือกรับได้หลายบทบาทในข้อความเดียวเมี๊ยว')
                .addStringOption(option => option.setName('title').setDescription('หัวข้อของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(option => option.setName('description').setDescription('รายละเอียดของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(option => option.setName('role1').setDescription('Role หรือชื่อยศที่ 1').setRequired(true).setAutocomplete(true))
                .addStringOption(option => option.setName('label1').setDescription('ปุ่มที่ 1 (ใส่ Emoji ได้นะเมี๊ยว)').setRequired(true))
                .addStringOption(option => option.setName('role2').setDescription('Role หรือชื่อยศที่ 2').setAutocomplete(true))
                .addStringOption(option => option.setName('label2').setDescription('ปุ่มที่ 2'))
                .addStringOption(option => option.setName('role3').setDescription('Role หรือชื่อยศที่ 3').setAutocomplete(true))
                .addStringOption(option => option.setName('label3').setDescription('ปุ่มที่ 3'))
                .addStringOption(option => option.setName('role4').setDescription('Role หรือชื่อยศที่ 4').setAutocomplete(true))
                .addStringOption(option => option.setName('label4').setDescription('ปุ่มที่ 4'))
                .addStringOption(option => option.setName('role5').setDescription('Role หรือชื่อยศที่ 5').setAutocomplete(true))
                .addStringOption(option => option.setName('label5').setDescription('ปุ่มที่ 5'))
                .addChannelOption(option => option.setName('channel').setDescription('ห้องที่ต้องการส่งข้อความเมี๊ยว')))
        .addSubcommand(subcommand => 
            subcommand.setName('add')
                .setDescription('✨ เพิ่มยศกลุ่มใหม่ด้วย AI (เช่น พิมพ์ "อายุ" หรือ "เพศ")')
                .addStringOption(option => option.setName('prompt').setDescription('หัวข้อยศที่ต้องการให้ AI ออกแบบเมี๊ยว').setRequired(true))
                .addChannelOption(option => option.setName('channel').setDescription('ห้องที่ต้องการส่งข้อความเมี๊ยว'))),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const roles = interaction.guild.roles.cache
            .filter(role => role.name !== '@everyone' && !role.managed)
            .filter(role => role.name.toLowerCase().includes(focusedValue.toLowerCase()))
            .first(25);

        await interaction.respond(
            roles.map(role => ({ name: role.name, value: role.id }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // ดึงข้อมูลฟีเจอร์เมี๊ยว
        let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
        const features = guildData?.features || { role_button: true, auto_role: false };

        if (subcommand === 'enable' || subcommand === 'disable') {
            const enabled = (subcommand === 'enable');
            features.role_button = enabled;
            
            await supabase.from('guilds').upsert({
                id: guildId, 
                name: interaction.guild.name, 
                owner_id: interaction.guild.ownerId, 
                features: features
            });

            return interaction.reply({ content: `ระบบปุ่มกดรับ Role ถูก **${enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}** แล้วนะเมี๊ยวว!🐾`, ephemeral: true });
        }

        if (subcommand === 'create' || subcommand === 'menu' || subcommand === 'add') {
            await interaction.deferReply({ ephemeral: true });
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const pinkColor = '#FFB6C1'; 

            const getOrCreateRole = async (roleInput) => {
                if (!roleInput) return null;
                // 1. ลองหาจาก ID (ถ้าเลือกจาก autocomplete)
                let role = interaction.guild.roles.cache.get(roleInput);
                // 2. ถ้าไม่เจอ (พิมพ์มาเอง) ลองหาจากชื่อ
                if (!role) {
                    role = interaction.guild.roles.cache.find(r => r.name === roleInput);
                }
                // 3. ถ้ายังไม่เจอ สร้างใหม่ (No Permissions)
                if (!role) {
                    try {
                        role = await interaction.guild.roles.create({
                            name: roleInput,
                            permissions: [],
                            reason: 'PurrPaw Self-Role Auto Create'
                        });
                    } catch (e) {
                        console.error('Role creation error:', e);
                        return null;
                    }
                }
                return role;
            };

            if (subcommand === 'create') {
                const roleInput = interaction.options.getString('role');
                const message = interaction.options.getString('message');
                const title = interaction.options.getString('title') || '🎀 รับบทบาท (Role) ที่นี่เมี๊ยว';
                const buttonLabel = interaction.options.getString('button_label') || 'กดเพื่อรับบทบาท';

                const role = await getOrCreateRole(roleInput);
                if (!role) return interaction.editReply({ content: 'เกิดข้อผิดพลาดในการหาหรือสร้าง Role เมี๊ยว!' });

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.editReply({ content: 'งื้อออ บอทไม่มีอำนาจแจก Role นี้เมี๊ยว (ยศนี้อยู่สูงกว่ายศบอทนะ🐾)!' });
                }

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(message)
                    .setColor(pinkColor);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`assign_role:${role.id}`).setLabel(buttonLabel).setStyle(ButtonStyle.Secondary).setEmoji('🐾')
                );

                const sentMessage = await channel.send({ embeds: [embed], components: [row] });

                await supabase.from('role_buttons').insert({
                    guild_id: guildId,
                    channel_id: channel.id,
                    message_id: sentMessage.id,
                    role_id: role.id,
                    title: title,
                    description: message,
                    button_label: buttonLabel,
                });

                return interaction.editReply({ content: `สร้างปุ่มกดรับ Role **${role.name}** ในห้อง ${channel} เรียบร้อยแล้วเมี๊ยวว! 🐾` });
            }

            if (subcommand === 'menu') {
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                
                const rolesData = [];
                for (let i = 1; i <= 5; i++) {
                    const rInput = interaction.options.getString(`role${i}`);
                    const l = interaction.options.getString(`label${i}`);
                    if (rInput && l) {
                        const r = await getOrCreateRole(rInput);
                        if (r) {
                            if (r.position >= interaction.guild.members.me.roles.highest.position) {
                                return interaction.editReply({ content: `งื้อออ บอทแจก Role **${r.name}** ไม่ได้เมี๊ยว (ยศนี้สูงกว่าบอทนะ🐾)!` });
                            }
                            rolesData.push({ role: r, label: l });
                        }
                    }
                }

                if (rolesData.length === 0) {
                    return interaction.editReply({ content: 'ต้องระบุอย่างน้อย 1 Role และ 1 ชื่อปุ่มนะเมี๊ยว!' });
                }

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(pinkColor);

                const row = new ActionRowBuilder();
                rolesData.forEach(item => {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`assign_role:${item.role.id}`)
                            .setLabel(item.label)
                            .setStyle(ButtonStyle.Secondary)
                    );
                });

                const sentMessage = await channel.send({ embeds: [embed], components: [row] });

                await supabase.from('role_buttons').insert({
                    guild_id: guildId,
                    channel_id: channel.id,
                    message_id: sentMessage.id,
                    role_id: rolesData[0].role.id,
                    title: title,
                    description: description,
                    button_label: rolesData.map(r => r.label).join(', '),
                });

                return interaction.editReply({ content: `สร้างเมนูปุ่มกดรับ Role (**${rolesData.length} ปุ่ม**) ในห้อง ${channel} เรียบร้อยเมี๊ยว! 🎀🐾` });
            }

            if (subcommand === 'add') {
                const prompt = interaction.options.getString('prompt');
                const { getRoleButtonAI } = require('../../utils/openRouter');

                try {
                    const aiResponse = await getRoleButtonAI(prompt);
                    const cleanedResponse = aiResponse.replace(/```json|```/g, '').trim();
                    const config = JSON.parse(cleanedResponse);

                    if (!config.roles || !Array.isArray(config.roles)) {
                        throw new Error("AI ออกแบบรูปแบบผิดพลาดเมี๊ยว");
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`ʚ♡ɞ ${config.title} ₊˚`)
                        .setDescription(config.description || 'เลือกยศที่ต้องการเมี๊ยว! 🐾')
                        .setColor('#FFB6C1');

                    const row = new ActionRowBuilder();
                    
                    for (const rData of config.roles) {
                        let role = interaction.guild.roles.cache.find(r => r.name === rData.name);
                        if (!role) {
                            role = await interaction.guild.roles.create({
                                name: rData.name,
                                color: rData.color || '#FFFFFF',
                                reason: 'PurrPaw AI Role Create'
                            }).catch(() => null);
                        }

                        if (role && row.components.length < 5) {
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`assign_role:${role.id}`)
                                    .setLabel(`${rData.emoji || '🐾'} ${rData.name}`)
                                    .setStyle(ButtonStyle.Secondary)
                            );
                        }
                    }

                    if (row.components.length === 0) throw new Error("ไม่สามารถสร้างยศได้เมี๊ยว");

                    await channel.send({ embeds: [embed], components: [row] });
                    return interaction.editReply({ content: `✅ เนรมิตกลุ่มคัดเลือกยศ **${config.title}** ลงในห้อง ${channel} เรียบร้อยแล้วเมี๊ยวว! 🐾` });

                } catch (err) {
                    console.error(err);
                    return interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาด: ${err.message}` });
                }
            }
        }
    },
};

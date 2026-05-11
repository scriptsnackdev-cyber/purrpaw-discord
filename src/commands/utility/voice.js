const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('จัดการห้องเสียงเฉพาะกิจเมี๊ยว🐾')
        .addSubcommand(sub =>
            sub.setName('create-form')
                .setDescription('สร้างปุ่มเปิดห้องเสียงเฉพาะกิจ (Admin Only)เมี๊ยว')
                .addStringOption(opt => opt.setName('title').setDescription('หัวข้อใน Embed').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('ข้อความใน Embed').setRequired(true))
                .addStringOption(opt => opt.setName('button').setDescription('ชื่อบนปุ่มกด').setRequired(true))
                .addStringOption(opt => opt.setName('image_url').setDescription('ลิงก์รูปภาพประกอบ (ถ้ามี)'))
        )
        .addSubcommand(sub =>
            sub.setName('invite')
                .setDescription('ชวนเพื่อนเข้าห้องเสียง (ใช้ได้เฉพาะในห้องเสียง)เมี๊ยว')
                .addUserOption(opt => opt.setName('user').setDescription('เพื่อนที่ต้องการชวน').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('เตะคนออกจากห้องเสียง (ใช้ได้เฉพาะในห้องเสียง)เมี๊ยว')
                .addUserOption(opt => opt.setName('user').setDescription('คนที่ต้องการเตะออก').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('changename')
                .setDescription('เปลี่ยนชื่อห้องเสียง (เจ้าของห้อง/Admin เท่านั้น)เมี๊ยว🐾')
                .addStringOption(opt => opt.setName('name').setDescription('ชื่อใหม่ที่ต้องการ').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('setlimit')
                .setDescription('ตั้งค่าจำนวนห้องเสียงสูงสุดในเซิร์ฟเวอร์ (Admin Only)เมี๊ยว🐾')
                .addIntegerOption(opt => opt.setName('limit').setDescription('จำนวนห้องสูงสุด').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // --- ระบบ Permission ---
        const { checkPermission } = require('../../utils/permissionManager');
        if (!(await checkPermission(interaction, 'voice'))) {
            return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้เมี๊ยว!', ephemeral: true });
        }

        if (sub === 'create-form') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }

            await interaction.deferReply();

            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const buttonLabel = interaction.options.getString('button');
            const imageUrl = interaction.options.getString('image_url');

            // บันทึกลงฐานข้อมูลเมี๊ยว🐾
            const { data: formData, error } = await supabase.from('voice_room_forms').insert({
                guild_id: guildId,
                title,
                description: message,
                button_label: buttonLabel,
                image_url: imageUrl
            }).select().single();

            if (error) {
                console.error('Error creating voice room form:', error);
                return interaction.editReply({ content: `❌ สร้างฟอร์มไม่สำเร็จเมี๊ยว: \`${error.message}\`` });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🔊 ${title}`)
                .setDescription(message.replace(/\\n/g, '\n'))
                .setImage(imageUrl || null)
                .setColor(0x3B82F6) // Blue color for Voice
                .setFooter({ text: `กดปุ่มด้านล่างเพื่อเปิดห้องเสียงส่วนตัวของคุณ (จะถูกลบหากไม่มีคนอยู่เกิน 30 นาที) เมี๊ยว🐾` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`voice_room_open:${formData.id}`)
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎧'),
                new ButtonBuilder()
                    .setCustomId(`voice_room_close_all`)
                    .setLabel('ปิดห้องเสียงทั้งหมด')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🧹'),
                new ButtonBuilder()
                    .setCustomId(`voice_room_form_delete:${formData.id}`)
                    .setLabel('ลบปุ่มนี้')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🗑️')
            );

            await interaction.editReply({ content: '✅ สร้างปุ่มเปิดห้องเสียงเฉพาะกิจเรียบร้อยแล้วเมี๊ยวว!' });
            const formMsg = await interaction.channel.send({ embeds: [embed], components: [row] });

            // อัปเดต Message ID กลับลง DB เมี๊ยว🐾
            await supabase.from('voice_room_forms').update({
                form_message_id: formMsg.id,
                form_channel_id: interaction.channelId
            }).eq('id', formData.id);
        }

        else if (sub === 'invite' || sub === 'kick') {
            const { data: room } = await supabase.from('voice_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();

            if (!room) {
                return interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะในห้องเสียงส่วนตัวเท่านั้นนะเมี๊ยว!', ephemeral: true });
            }

            if (room.owner_id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องหรือแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ content: '❌ คุณจะจัดการตัวเองทำไมเมี๊ยวว!🐾', ephemeral: true });
            }

            if (sub === 'invite') {
                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: true,
                    Connect: true,
                    Speak: true
                });
                return interaction.reply({ content: `✅ ชวนคุณ <@${targetUser.id}> เข้าห้องเรียบร้อยแล้วเมี๊ยวว! 🎉` });
            } else {
                await interaction.channel.permissionOverwrites.delete(targetUser.id);
                // เตะออกจากห้องเสียงถ้าอยู่ในนั้น
                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (targetMember && targetMember.voice.channelId === interaction.channelId) {
                    await targetMember.voice.disconnect();
                }
                return interaction.reply({ content: `✅ เตะคุณ <@${targetUser.id}> ออกจากห้องเรียบร้อยแล้วเมี๊ยวว! 💨` });
            }
        }

        else if (sub === 'changename') {
            const { data: room } = await supabase.from('voice_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();

            if (!room) {
                return interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะในห้องเสียงส่วนตัวเท่านั้นนะเมี๊ยว!', ephemeral: true });
            }

            if (room.owner_id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องหรือแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }

            const newName = interaction.options.getString('name');
            const cleanName = newName.replace(/[^a-zA-Z0-9ก-ฮอะ-์]/g, '-').toLowerCase();
            const finalName = `🔊-${cleanName}`;

            try {
                await interaction.channel.setName(finalName);
                return interaction.reply({ content: `✅ เปลี่ยนชื่อห้องเป็น **${finalName}** เรียบร้อยแล้วเมี๊ยวว!🐾🌸` });
            } catch (err) {
                console.error('Error renaming voice channel:', err);
                return interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อห้องเมี๊ยว! (อาจจะติด Cooldown ของ Discord นะ🐾)', ephemeral: true });
            }
        }

        else if (sub === 'setlimit') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }

            const limit = interaction.options.getInteger('limit');
            const { getGuildData } = require('../../utils/guildCache');
            const { settings } = await getGuildData(guildId);

            const newSettings = { ...settings, voice_room_limit: limit };
            await supabase.from('guilds').upsert({ id: guildId, settings: newSettings });

            return interaction.reply({ content: `✅ ตั้งค่าจำนวนห้องเสียงสูงสุดเป็น **${limit}** ห้องเรียบร้อยแล้วเมี๊ยวว!🐾🌸` });
        }
    }
};

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('private')
        .setDescription('จัดการห้องส่วนตัวเมี๊ยว🐾')
        .addSubcommand(sub =>
            sub.setName('create-form')
                .setDescription('สร้างปุ่มเปิดห้องส่วนตัว (Admin Only)เมี๊ยว')
                .addStringOption(opt => opt.setName('title').setDescription('หัวข้อใน Embed').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('ข้อความใน Embed').setRequired(true))
                .addStringOption(opt => opt.setName('button').setDescription('ชื่อบนปุ่มกด').setRequired(true))
                .addIntegerOption(opt => opt.setName('duration').setDescription('ระยะเวลาห้อง (นาที)').setRequired(true))
                .addStringOption(opt => opt.setName('image_url').setDescription('ลิงก์รูปภาพประกอบ (ถ้ามี)'))
        )
        .addSubcommand(sub =>
            sub.setName('invite')
                .setDescription('ชวนเพื่อนเข้าห้องส่วนตัว (ใช้ได้เฉพาะในห้องส่วนตัว)เมี๊ยว')
                .addUserOption(opt => opt.setName('user').setDescription('เพื่อนที่ต้องการชวน').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('เตะคนออกจากห้องส่วนตัว (ใช้ได้เฉพาะในห้องส่วนตัว)เมี๊ยว')
                .addUserOption(opt => opt.setName('user').setDescription('คนที่ต้องการเตะออก').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('changename')
                .setDescription('เปลี่ยนชื่อห้องส่วนตัว (เจ้าของห้อง/Admin เท่านั้น)เมี๊ยว🐾')
                .addStringOption(opt => opt.setName('name').setDescription('ชื่อใหม่ที่ต้องการ (ไม่ต้องใส่รูปบ้านเมี๊ยว)').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('setlimit')
                .setDescription('ตั้งค่าจำนวนห้องส่วนตัวสูงสุดในเซิร์ฟเวอร์ (Admin Only)เมี๊ยว🐾')
                .addIntegerOption(opt => opt.setName('limit').setDescription('จำนวนห้องสูงสุด').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'create-form') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }

            await interaction.deferReply();

            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const buttonLabel = interaction.options.getString('button');
            const duration = interaction.options.getInteger('duration');
            const imageUrl = interaction.options.getString('image_url');

            // บันทึกลงฐานข้อมูลเมี๊ยว🐾
            const { data: formData, error } = await supabase.from('private_room_forms').insert({
                guild_id: guildId,
                title,
                description: message,
                button_label: buttonLabel,
                duration_minutes: duration,
                image_url: imageUrl
            }).select().single();

            if (error) {
                console.error('Error creating private room form:', error);
                return interaction.editReply({ content: `❌ สร้างฟอร์มไม่สำเร็จเมี๊ยว: \`${error.message}\`` });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏠 ${title}`)
                .setDescription(message.replace(/\\n/g, '\n'))
                .setImage(imageUrl || null)
                .setColor(0x10B981)
                .setFooter({ text: `กดปุ่มด้านล่างเพื่อเปิดห้องส่วนตัวของคุณ (อยู่ได้นาน ${duration} นาที) เมี๊ยว🐾` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`private_room_open:${formData.id}`)
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔑'),
                new ButtonBuilder()
                    .setCustomId(`private_room_close_all`)
                    .setLabel('ปิดห้องทั้งหมด')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🧹'),
                new ButtonBuilder()
                    .setCustomId(`private_room_form_delete:${formData.id}`)
                    .setLabel('ลบปุ่มนี้')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🗑️')
            );

            await interaction.editReply({ content: '✅ สร้างปุ่มเปิดห้องส่วนตัวเรียบร้อยแล้วเมี๊ยวว!' });
            const formMsg = await interaction.channel.send({ embeds: [embed], components: [row] });

            // อัปเดต Message ID กลับลง DB เมี๊ยว🐾
            await supabase.from('private_room_forms').update({ 
                form_message_id: formMsg.id, 
                form_channel_id: interaction.channelId 
            }).eq('id', formData.id);

            // เรียกใช้ฟังก์ชันอัปเดตรูปภาพการใช้งาน (ถ้ามี Canvas)
            const { updatePrivateRoomForm } = require('../../utils/privateRoomImage');
            await updatePrivateRoomForm(interaction.client, formData.id);
        }

        else if (sub === 'invite' || sub === 'kick') {
            // เช็คว่าเป็นห้องส่วนตัวไหมเมี๊ยว🐾
            const { data: room } = await supabase.from('private_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
            
            if (!room) {
                return interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะในห้องส่วนตัวที่ยังไม่หมดอายุเท่านั้นนะเมี๊ยว!', ephemeral: true });
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
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                return interaction.reply({ content: `✅ ชวนคุณ <@${targetUser.id}> เข้าห้องเรียบร้อยแล้วเมี๊ยวว! 🎉` });
            } else {
                await interaction.channel.permissionOverwrites.delete(targetUser.id);
                return interaction.reply({ content: `✅ เตะคุณ <@${targetUser.id}> ออกจากห้องเรียบร้อยแล้วเมี๊ยวว! 💨` });
            }
        }

        else if (sub === 'changename') {
            const { data: room } = await supabase.from('private_rooms').select('*').eq('channel_id', interaction.channelId).eq('is_deleted', false).single();
            
            if (!room) {
                return interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะในห้องส่วนตัวที่ยังไม่หมดอายุเท่านั้นนะเมี๊ยว!', ephemeral: true });
            }

            if (room.owner_id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะเจ้าของห้องหรือแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }

            const newName = interaction.options.getString('name');
            const cleanName = newName.replace(/[^a-zA-Z0-9ก-ฮอะ-์]/g, '-').toLowerCase();
            const finalName = `🏠-${cleanName}`;

            try {
                await interaction.channel.setName(finalName);
                return interaction.reply({ content: `✅ เปลี่ยนชื่อห้องเป็น **${finalName}** เรียบร้อยแล้วเมี๊ยวว!🐾🌸` });
            } catch (err) {
                console.error('Error renaming channel:', err);
                return interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อห้องเมี๊ยว! (อาจจะติด Cooldown ของ Discord นะ🐾)', ephemeral: true });
            }
        }

        else if (sub === 'setlimit') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }

            const limit = interaction.options.getInteger('limit');
            if (limit > 100) {
                return interaction.reply({ content: '❌ ตั้งค่าได้สูงสุดไม่เกิน **100** ห้องนะเมี๊ยว! (เพื่อความเสถียรของเซิร์ฟเวอร์🐾)', ephemeral: true });
            }

            const { getGuildData } = require('../../utils/guildCache');
            const { settings } = await getGuildData(guildId);
            
            const newSettings = { ...settings, private_room_limit: limit };
            await supabase.from('guilds').upsert({ id: guildId, settings: newSettings });

            return interaction.reply({ content: `✅ ตั้งค่าจำนวนห้องส่วนตัวสูงสุดเป็น **${limit}** ห้องเรียบร้อยแล้วเมี๊ยวว!🐾🌸` });
        }
    }
};

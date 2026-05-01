const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('speak')
        .setDescription('🎭 ส่งข้อความในนามของ AI Character (หรือระบุชื่อเอง)')
        .addStringOption(option => 
            option.setName('character')
                .setDescription('เลือก AI Character ที่สร้างไว้ หรือพิมพ์ชื่อตัวละครใหม่เมี๊ยว')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('ข้อความที่ต้องการให้พูดเมี๊ยว')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('avatar')
                .setDescription('URL รูปโปรไฟล์ (ถ้าเลือก AI Character ระบบจะใช้รูปของ AI ตัวนั้นเมี๊ยว)'))
        .addAttachmentOption(option => 
            option.setName('image')
                .setDescription('รูปภาพที่ต้องการส่งเมี๊ยว (เลือกจากในเครื่องได้เลยเมี๊ยว)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const guildId = interaction.guild.id;

        const { data: chars } = await supabase
            .from('ai_characters')
            .select('id, name')
            .eq('guild_id', guildId)
            .ilike('name', `%${focusedValue}%`)
            .limit(25);

        if (!chars) return interaction.respond([]);

        await interaction.respond(
            chars.map(c => ({ name: `🤖 ${c.name}`, value: c.id }))
        );
    },

    async execute(interaction) {
        const charInput = interaction.options.getString('character');
        const message = interaction.options.getString('message');
        const manualAvatar = interaction.options.getString('avatar');
        const attachment = interaction.options.getAttachment('image');
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            let finalName = charInput;
            let finalAvatar = manualAvatar;

            // 1. ตรวจสอบว่า character ที่เลือกเป็น ID ของ AI ใน Database หรือไม่
            const { data: charData } = await supabase
                .from('ai_characters')
                .select('name, image_url')
                .eq('id', charInput)
                .eq('guild_id', guildId)
                .single();

            if (charData) {
                finalName = charData.name;
                finalAvatar = charData.image_url || manualAvatar;
            }

            // 2. ตรวจสอบว่ามี Webhook ในห้องนี้หรือยัง
            const webhooks = await interaction.channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.name === 'PurrPaw Speak');

            if (!webhook) {
                webhook = await interaction.channel.createWebhook({
                    name: 'PurrPaw Speak',
                    avatar: interaction.client.user.displayAvatarURL(),
                    reason: 'PurrPaw Character Proxy'
                });
            }

            // 3. ส่งข้อความผ่าน Webhook
            await webhook.send({
                content: message,
                username: finalName,
                avatarURL: finalAvatar || null,
                files: attachment ? [attachment] : []
            });

            await interaction.editReply({ content: `✅ ส่งข้อความในนาม **${finalName}** เรียบร้อยแล้วเมี๊ยววว! 🎭✨` });

        } catch (error) {
            console.error('Speak command error:', error);
            await interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาด: ${error.message}` });
        }
    },
};

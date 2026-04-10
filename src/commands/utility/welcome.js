const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('👋 ตั้งค่าระบบต้อนรับทาสแมวหน้าใหม่เมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('enable')
                .setDescription('🐾 เปิดการใช้งานระบบต้อนรับในห้องนี้เมี๊ยว!'))
        .addSubcommand(sub => 
            sub.setName('disable')
                .setDescription('🚫 ปิดการใช้งานระบบต้อนรับเซิร์ฟเวอร์นี้เมี๊ยว...'))
        .addSubcommand(sub => 
            sub.setName('settings')
                .setDescription('⚙️ ตั้งค่ารายละเอียดของระบบต้อนรับเมี๊ยว')
                .addStringOption(opt => 
                    opt.setName('type')
                        .setDescription('เลือกสิ่งที่ต้องการตั้งค่าเมี๊ยว')
                        .setRequired(true)
                        .addChoices({ name: '📝 เนื้อหาข้อความต้อนรับ', value: 'message' }))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'enable') {
            const channelId = interaction.channel.id;
            
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            settings.welcome = {
                ...(settings.welcome || {}),
                enabled: true,
                channel_id: channelId
            };

            await supabase.from('guilds').update({ settings }).eq('id', guildId);

            return interaction.reply({ content: `✅ เปิดการใช้งานระบบต้อนรับในห้อง ${interaction.channel} เรียบร้อยแล้วเมี๊ยวว! 🐾`, ephemeral: true });
        }

        if (sub === 'disable') {
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (settings.welcome) settings.welcome.enabled = false;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);

            return interaction.reply({ content: '❌ ปิดการใช้งานระบบต้อนรับแล้วเมี๊ยว... ไว้เจอกันใหม่นะ!', ephemeral: true });
        }

        if (sub === 'settings') {
            const type = interaction.options.getString('type');

            if (type === 'message') {
                let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
                const currentMsg = guildData?.settings?.welcome?.message || 'สวัสดีค่าา ยินดีต้อนรับเข้าสู่บ้านของเราคุณ ${User} เมี๊ยวว! 🐾';

                const modal = new ModalBuilder()
                    .setCustomId('welcome_settings_modal')
                    .setTitle('📝 ตั้งค่าข้อความต้อนรับเมี๊ยว');

                const messageInput = new TextInputBuilder()
                    .setCustomId('welcome_message_input')
                    .setLabel('ข้อความ (ใช้ ${User} เพื่อแท็กหาเพื่อนใหม่!)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(currentMsg)
                    .setPlaceholder('สวัสดีคุณ ${User} ยินดีต้อนรับนะเมี๊ยวว...')
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
        }
    }
};

const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goodbye')
        .setDescription('👋 ตั้งค่าระบบบอกลาเพื่อนๆ ที่จากไปเมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('enable')
                .setDescription('🐾 เปิดการใช้งานระบบบอกลาในห้องนี้เมี๊ยว!'))
        .addSubcommand(sub => 
            sub.setName('disable')
                .setDescription('🚫 ปิดการใช้งานระบบบอกลาเซิร์ฟเวอร์นี้เมี๊ยว...'))
        .addSubcommand(sub => 
            sub.setName('settings')
                .setDescription('⚙️ ตั้งค่ารายละเอียดของระบบบอกลาเมี๊ยว')
                .addStringOption(opt => 
                    opt.setName('type')
                        .setDescription('เลือกสิ่งที่ต้องการตั้งค่าเมี๊ยว')
                        .setRequired(true)
                        .addChoices({ name: '📝 เนื้อหาข้อความบอกลา', value: 'message' }))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'enable') {
            const channelId = interaction.channel.id;
            
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            settings.goodbye = {
                ...(settings.goodbye || {}),
                enabled: true,
                channel_id: channelId
            };

            await supabase.from('guilds').update({ settings }).eq('id', guildId);

            return interaction.reply({ content: `✅ เปิดการใช้งานระบบบอกลาในห้อง ${interaction.channel} เรียบร้อยแล้วเมี๊ยวว! 🐾`, ephemeral: true });
        }

        if (sub === 'disable') {
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (settings.goodbye) settings.goodbye.enabled = false;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);

            return interaction.reply({ content: '❌ ปิดการใช้งานระบบบอกลาแล้วเมี๊ยว... ไว้มาใหม่นะ!', ephemeral: true });
        }

        if (sub === 'settings') {
            const type = interaction.options.getString('type');

            if (type === 'message') {
                let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
                const currentMsg = guildData?.settings?.goodbye?.message || 'ลาก่อนนะคุณ ${User} หวังว่าเราจะได้พบกันใหม่เมี๊ยวว! 🐾';

                const modal = new ModalBuilder()
                    .setCustomId('goodbye_settings_modal')
                    .setTitle('📝 ตั้งค่าข้อความบอกลาเมี๊ยว');

                const messageInput = new TextInputBuilder()
                    .setCustomId('goodbye_message_input')
                    .setLabel('ข้อความ (ใช้ ${User} สำหรับชื่อเพื่อน)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(currentMsg)
                    .setPlaceholder('ลาก่อนนะคุณ ${User}...')
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
        }
    }
};

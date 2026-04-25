const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');
const { invalidateCache } = require('../../utils/guildCache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setbg')
        .setDescription('🖼️ ตั้งค่ารูปพื้นหลังสำหรับการ์ดเลเวลและโปรไฟล์เมี๊ยว🐾')
        .addStringOption(option => 
            option.setName('url')
                .setDescription('ลิงก์รูปภาพที่ต้องการใช้ (หรือพิมพ์ "default" เพื่อกลับไปใช้รูปเดิม)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply();
        const url = interaction.options.getString('url');
        const guildId = interaction.guild.id;

        try {
            // ดึงข้อมูล settings เดิมก่อนเมี๊ยว🐾
            const { data: guildData, error: fetchError } = await supabase
                .from('guilds')
                .select('settings')
                .eq('id', guildId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            let settings = guildData?.settings || {};

            if (url.toLowerCase() === 'default') {
                // ลบค่า background ออก
                delete settings.rank_background_url;
                
                await supabase
                    .from('guilds')
                    .update({ settings })
                    .eq('id', guildId);
                
                invalidateCache(guildId);

                return interaction.editReply({ content: '✅ รีเซ็ตพื้นหลังกลับเป็นค่าเริ่มต้นเรียบร้อยแล้วเมี๊ยว🐾🌸' });
            }

            // ตรวจสอบว่าเป็น URL หรือไม่ (แบบง่ายๆ)
            if (!url.startsWith('http')) {
                return interaction.editReply({ content: '❌ กรุณาใส่ลิงก์รูปภาพ (URL) ที่ถูกต้องนะเมี๊ยว🐾 (เช่น https://...)' });
            }

            // อัปเดต settings
            settings.rank_background_url = url;

            await supabase
                .from('guilds')
                .update({ settings })
                .eq('id', guildId);

            invalidateCache(guildId);

            return interaction.editReply({ 
                content: `✅ ตั้งค่ารูปพื้นหลังใหม่เรียบร้อยแล้วเมี๊ยว🐾\n🖼️ **URL:** ${url}\n(รูปจะถูกครอบและขยายให้พอดีโดยอัตโนมัติเมื่อใช้งานเมี๊ยว🐾🌸)` 
            });

        } catch (error) {
            console.error('SetBG Error:', error);
            return interaction.editReply({ content: 'งื้อออ เกิดข้อผิดพลาดในการตั้งค่าพื้นหลังเมี๊ยว🐾' });
        }
    }
};

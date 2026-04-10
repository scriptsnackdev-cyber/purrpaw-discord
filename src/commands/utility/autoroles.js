const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoroles')
        .setDescription('🎭 ตั้งค่าระบบแจกบทบาท(Role) อัตโนมัติเมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('enable').setDescription('🐾 เปิดใช้งานการแจก Role อัตโนมัติเมื่อเพื่อนใหม่เข้าบ้าน'))
        .addSubcommand(subcommand => subcommand.setName('disable').setDescription('🚫 ปิดใช้งานการแจก Role อัตโนมัติเมี๊ยว'))
        .addSubcommand(subcommand => 
            subcommand.setName('set-role')
                .setDescription('📍 เลือก Role ที่จะแจกให้เพื่อนใหม่เมี๊ยว')
                .addRoleOption(option => 
                    option.setName('role')
                        .setDescription('เลือก Role ที่ต้องการเมี๊ยว')
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName('setting')
                .setDescription('🐈 ตั้งค่าตัวตนของบอทสำหรับเซิร์ฟเวอร์นี้เมี๊ยว')
                .addStringOption(option => option.setName('name').setDescription('ชื่อที่อยากให้บอทใช้เมี๊ยว').setRequired(true))
                .addStringOption(option => option.setName('image').setDescription('ลิงก์รูปโปรไฟล์ของบอทเมี๊ยว').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
        const features = guildData?.features || { role_button: true, auto_role: false };

        if (subcommand === 'enable' || subcommand === 'disable') {
            const enabled = (subcommand === 'enable');
            features.auto_role = enabled;
            
            await supabase.from('guilds').upsert({
                id: guildId, 
                name: interaction.guild.name, 
                owner_id: interaction.guild.ownerId, 
                features: features
            });

            return interaction.reply({ content: `ระบบแจก Role อัตโนมัติถูก **${enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}** แล้วนะเมี๊ยวว!`, ephemeral: true });
        }

        if (subcommand === 'set-role') {
            const role = interaction.options.getRole('role');
            
            await supabase.from('auto_roles').upsert({ 
                guild_id: guildId, 
                role_id: role.id 
            }, { onConflict: 'guild_id' });

            return interaction.reply({ content: `ตั้งค่า Role อัตโนมัติเป็น **${role.name}** เรียบร้อยแล้วเมี๊ยว! 🐾`, ephemeral: true });
        }

        if (subcommand === 'setting') {
            const name = interaction.options.getString('name');
            const image = interaction.options.getString('image');

            let { data: currentData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = currentData?.settings || {};
            settings.bot_name = name;
            settings.bot_avatar = image;

            await supabase.from('guilds').update({ settings: settings }).eq('id', guildId);

            try {
                await interaction.guild.members.me.setNickname(name);
            } catch (e) {
                console.log('Permission denied: Cannot change nickname.');
            }

            return interaction.reply({ content: `✅ อัปเดตตัวตนของบอทเป็น: **${name}** เรียบร้อยแล้วเมี๊ยวว! (บันทึกข้อมูลลง Dashboard แล้วนะ🐾)`, ephemeral: true });
        }
    },
};

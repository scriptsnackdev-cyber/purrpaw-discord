const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { generateRoleCard } = require('../../utils/roleCard');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('🎁 มอบยศให้สมาชิก (ถ้าไม่มีจะสร้างให้ใหม่) พร้อมประกาศสุดพิเศษเมี๊ยว! 🐾')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('สมาชิกที่ต้องการมอบยศให้')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('role')
                .setDescription('ชื่อยศหรือ ID ยศ (ถ้าไม่มีจะสร้างให้ใหม่เมี๊ยว🐾)')
                .setAutocomplete(true)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser('user');
        const roleInput = interaction.options.getString('role');
        const guildId = interaction.guild.id;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        // ดึง Settings เพื่อเช็คพื้นหลังเมี๊ยว🐾
        const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
        const customBgURL = guildData?.settings?.rank_background_url || null;

        if (!member) {
            return interaction.editReply({ content: '❌ ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์เมี๊ยว!' });
        }

        // 1. ค้นหายศเมี๊ยว🐾
        let role = interaction.guild.roles.cache.get(roleInput);
        if (!role) role = interaction.guild.roles.cache.find(r => r.name === roleInput);

        // 2. ถ้าไม่เจอ ให้สร้างใหม่เมี๊ยว🐾
        if (!role) {
            try {
                role = await interaction.guild.roles.create({
                    name: roleInput,
                    reason: `Created via /giverole by ${interaction.user.tag}`,
                    permissions: [] // ยศเริ่มต้นไม่มีสิทธิ์พิเศษเมี๊ยว🐾
                });
            } catch (e) {
                return interaction.editReply({ content: `❌ บอทสร้างยศใหม่ไม่สำเร็จเมี๊ยว: \`${e.message}\`` });
            }
        }

        // ตรวจสอบสิทธิ์ของบอท
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply({ content: '❌ ยศนี้อยู่สูงกว่าหรือเท่ากับยศของบอท บอทจัดการไม่ได้นะเมี๊ยว!' });
        }

        try {
            // มอบยศ
            await member.roles.add(role);

            // เตรียมข้อมูลสำหรับวาดรูปเมี๊ยว🐾
            const displayName = member.displayName;
            const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256 });
            
            // สร้างรูปประกาศ
            const imageBuffer = await generateRoleCard(targetUser, role.name, displayName, avatarURL, customBgURL);
            const attachment = new AttachmentBuilder(imageBuffer, { name: `role-grant-${targetUser.id}.png` });

            // ส่งประกาศ (ไม่ใช้ Ephemeral เพื่อให้ทุกคนเห็นความสำเร็จเมี๊ยว🐾)
            return interaction.editReply({
                content: `✨ **ประกาศความสำเร็จ!** <@${targetUser.id}> ได้รับยศใหม่แล้วนะเมี๊ยววว! 🐾🎊`,
                files: [attachment]
            });

        } catch (error) {
            console.error('GiveRole Error:', error);
            return interaction.editReply({ content: `งื้อออ เกิดข้อผิดพลาดในการมอบยศ: \`${error.message}\`` });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const roles = interaction.guild.roles.cache
            .filter(role => role.name !== '@everyone' && !role.managed)
            .filter(role => role.name.toLowerCase().includes(focusedValue.toLowerCase()))
            .first(25);

        await interaction.respond(
            roles.map(role => ({ name: role.name, value: role.id }))
        );
    }
};

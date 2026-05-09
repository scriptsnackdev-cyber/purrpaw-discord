const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { banUser, toggleBanSystem } = require('../../utils/banManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('🐱 ระบบจัดการการแบนเมี๊ยว🐾')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcommand: แบนสมาชิก
        .addSubcommand(sub => 
            sub.setName('member')
                .setDescription('🚫 แบนสมาชิกชั่วคราวเมี๊ยว🐾')
                .addUserOption(opt => opt.setName('user').setDescription('เลือกคนที่ต้องการแบน').setRequired(true))
                .addIntegerOption(opt => opt.setName('time').setDescription('ระยะเวลาที่แบน (นาที)').setRequired(true).setMinValue(1))
                .addStringOption(opt => opt.setName('remark').setDescription('เหตุผลในการแบนเมี๊ยว🐾').setRequired(true))
        )
        
        // Subcommand: เปิดระบบ
        .addSubcommand(sub => 
            sub.setName('enable')
                .setDescription('✅ เปิดใช้งานระบบแบนในเซิร์ฟเวอร์นี้เมี๊ยว🐾')
        )
        
        // Subcommand: ปิดระบบ
        .addSubcommand(sub => 
            sub.setName('disable')
                .setDescription('❌ ปิดใช้งานระบบแบนเมี๊ยว🐾')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'enable') {
            return await toggleBanSystem(interaction, true);
        }

        if (subcommand === 'disable') {
            return await toggleBanSystem(interaction, false);
        }

        if (subcommand === 'member') {
            const targetUser = interaction.options.getMember('user');
            const time = interaction.options.getInteger('time');
            const remark = interaction.options.getString('remark');

            if (!targetUser) {
                return interaction.reply({ content: '❌ ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์เมี๊ยว🐾', ephemeral: true });
            }

            // เช็คว่าแบนตัวเองไม่ได้เมี๊ยว🐾
            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ content: '❌ จะแบนตัวเองทำไมเมี๊ยวว! ไม่ดื้อนะ🐾', ephemeral: true });
            }

            // เช็คว่าแบนคนที่มีลำดับยศสูงกว่าไม่ได้
            if (!targetUser.manageable) {
                return interaction.reply({ content: '❌ บอทไม่มีสิทธิ์จัดการสมาชิกคนนี้เมี๊ยว🐾 (เขายศสูงกว่าบอทนะ!)', flags: [MessageFlags.Ephemeral] });
            }

            return await banUser(interaction, targetUser, time, remark);
        }
    }
};




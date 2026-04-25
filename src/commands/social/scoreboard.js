const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');
const { RankCardBuilder, Font } = require('canvacord');
const path = require('path');
const fs = require('fs');

// โหลดฟอนต์เตรียมไว้เมี๊ยว🐾🌸
Font.loadDefault();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scoreboard')
        .setDescription('📊 ดูการ์ดสะสมคะแนนเลเวลและอันดับการแชทเมี๊ยว🐾')
        .addUserOption(option => option.setName('user').setDescription('เลือกคนที่ต้องการดูคะแนน')),

    async execute(interaction) {
        await interaction.deferReply(); 
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // ดึงข้อมูลคะแนนเมี๊ยว🐾
        const [{ data: memberData }, { data: guildData }] = await Promise.all([
            supabase.from('member_levels').select('*').eq('guild_id', guildId).eq('user_id', targetUser.id).single(),
            supabase.from('guilds').select('settings').eq('id', guildId).single()
        ]);

        const customBgURL = guildData?.settings?.rank_background_url || null;

        if (!memberData) {
            return interaction.editReply({ content: targetUser.id === interaction.user.id ? 'ยังไม่มีคะแนนเลยเมี๊ยว พิมพ์คุยกันก่อนน้าา🐾' : `${targetUser.username} ยังไม่มีคะแนนเลยเมี๊ยว🐾` });
        }

        const xpMultiplier = 100;
        const totalChars = memberData.total_chars;
        const currentLevel = Math.floor(Math.sqrt(totalChars / xpMultiplier));
        const xpForCurrentLevel = xpMultiplier * (currentLevel ** 2);
        const xpForNextLevel = xpMultiplier * ((currentLevel + 1) ** 2);
        
        const currentXP = totalChars - xpForCurrentLevel;
        const requiredXP = xpForNextLevel - xpForCurrentLevel;

        try {
            // --- สร้าง Rank Card ด้วย v6 API เมี๊ยว🐾 ---
            const rank = new RankCardBuilder()
                .setAvatar(targetUser.displayAvatarURL({ forceStatic: true, extension: 'png' }))
                .setCurrentXP(currentXP)
                .setRequiredXP(requiredXP)
                .setLevel(currentLevel)
                .setUsername(targetUser.username)
                .setDisplayName(targetUser.displayName)
                .setStyles({
                    progressbar: {
                        thumb: {
                            style: {
                                backgroundColor: "#FFB6C1"
                            }
                        }
                    }
                });

            // ใส่พื้นหลังเมี๊ยว🐾 (Custom หรือ Default)
            if (customBgURL) {
                rank.setBackground(customBgURL);
            } else {
                const bgPath = path.join(__dirname, '../../assets/rank_bg.png');
                if (fs.existsSync(bgPath)) {
                    rank.setBackground(bgPath);
                }
            }

            const cardBuffer = await rank.build();
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'rank.png' });

            return interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('Render Rank Card Error:', error);
            return interaction.editReply({ content: 'งื้อออ เกิดข้อผิดพลาดในการทำรูปการ์ด (v6 Error) เมี๊ยว🐾🌸' });
        }
    }
};

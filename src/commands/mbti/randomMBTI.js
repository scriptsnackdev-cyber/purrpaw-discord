const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createMbtiWheelCard, WHEEL_ITEMS } = require('../../utils/mbtiWheelCard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('randommbti')
        .setDescription('🎡 สุ่มดวง MBTI ของคุณด้วยกงล้อวิเศษเมี๊ยว!')
        .addStringOption(option =>
            option.setName('gender')
                .setDescription('เลือกเพศที่ต้องการสุ่มเมี๊ยว🐾')
                .addChoices(
                    { name: 'ชาย ♂️', value: 'ชาย' },
                    { name: 'หญิง ♀️', value: 'หญิง' }
                )),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const gender = interaction.options.getString('gender');
            
            let itemsToSpin = WHEEL_ITEMS;
            let filteredIndex = -1;
            
            if (gender) {
                // กรองเอาเฉพาะเพศที่เลือก
                itemsToSpin = WHEEL_ITEMS.filter(item => item.includes(`(${gender})`));
                const randomIndex = Math.floor(Math.random() * itemsToSpin.length);
                filteredIndex = randomIndex;
            } else {
                filteredIndex = Math.floor(Math.random() * WHEEL_ITEMS.length);
            }

            const winnerText = itemsToSpin[filteredIndex];
            const imageBuffer = await createMbtiWheelCard(filteredIndex, itemsToSpin);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'mbti-wheel.png' });

            const embed = new EmbedBuilder()
                .setTitle('🎡 กงล้อวิเศษทำนาย MBTI')
                .setDescription(`🐾 กงล้อหยุดหมุนแล้วเมี๊ยว!\n\n✨ คุณสุ่มได้ : **${winnerText}**`)
                .setColor(0xFFADAD)
                .setImage('attachment://mbti-wheel.png')
                .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
                .setFooter({ text: 'ดวงวันนี้อาจจะไม่เหมือนวันหน้า มาหมุนใหม่ได้เสมอเมี๊ยว! 🐾' });

            return await interaction.editReply({ embeds: [embed], files: [attachment] });
        } catch (error) {
            console.error('Error generating MBTI wheel:', error);
            return await interaction.editReply({ content: '❌ ขออภัยเมี๊ยว... เกิดข้อผิดพลาดในการสร้างกงล้อ ลองใหม่อีกครั้งนะ🐾' });
        }
    }
};

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MBTI_DATA = require('../commands/mbti/MBTI.json');
const MBTI_IMAGES = require('../commands/mbti/MBTI_IMAGES.json');
const SBTI_DATA = require('../commands/mbti/SBTI.json');
const SBTI_IMAGES = require('../commands/mbti/SBTI_IMAGES.json');

/**
 * ส่งผลลัพธ์ MBTI/SBTI ไปยัง Discord Channel เมี๊ยว🐾
 */
async function sendTestResult(client, { userId, guildId, channelId, type, result }) {
    try {
        const guild = client.guilds.cache.get(guildId);
        const channel = guild?.channels.cache.get(channelId);
        if (!channel) return console.error('Channel not found for test result');

        const user = await client.users.fetch(userId);
        const isSBTI = type === 'sbti';

        const data = isSBTI ? SBTI_DATA[result] : MBTI_DATA[result];
        const images = isSBTI ? SBTI_IMAGES[result] : MBTI_IMAGES[result];
        const randomImage = images[Math.floor(Math.random() * images.length)] || "https://s.showimg.link/XMJwqN8ofy.webp";

        const embed = new EmbedBuilder()
            .setTitle(`${data.emoji} ผลทดสอบ ${type.toUpperCase()}: ${data.title}${!isSBTI ? ` (${result})` : ''}`)
            .setDescription(`🐱 **คุณคือ: ${data.cat_type}**\n\n${data.description}\n\n🌟 **จุดเด่นของคุณ:**\n- ${data.strengths.join('\n- ')}\n\n🐾 **คำแนะนำสไตล์แมว:**\n- ${data.advice}`)
            .setImage(randomImage)
            .setColor(isSBTI ? 0xF472B6 : 0x3B82F6)
            .setAuthor({ name: user.displayName || user.username, iconURL: user.displayAvatarURL() })
            .setFooter({ text: `อยากรู้ว่าตัวเองเป็นแมวพันธุ์ไหน? กดปุ่มด้านล่างได้เลยเมี๊ยว! ✨` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${type}_start`)
                .setLabel(`🧠 เริ่มทำแบบทดสอบบ้าง (12 ข้อ)`)
                .setStyle(isSBTI ? ButtonStyle.Success : ButtonStyle.Primary)
        );

        await channel.send({
            content: `✨ **ประกาศผล ${type.toUpperCase()} ของ <@${userId}> เมี๊ยวว!**`,
            embeds: [embed],
            components: [row]
        });

        return true;
    } catch (err) {
        console.error('Error sending test result:', err);
        return false;
    }
}

module.exports = { 
    sendTestResult, 
    MBTI_DATA, 
    MBTI_IMAGES, 
    SBTI_DATA, 
    SBTI_IMAGES 
};

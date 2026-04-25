const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const { drawBackground } = require('../../utils/canvasHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('🐱 ดูบัตรประจำตัวแมวของคุณ (รวมข้อมูลทุกอย่างในภาพเดียว) 🐾')
        .addUserOption(option => option.setName('user').setDescription('เลือกคนที่ต้องการดูโปรไฟล์')),

    async execute(interaction) {
        await interaction.deferReply(); 
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // --- 1. ดึงข้อมูลจาก Database ---
        const [{ data: memberData }, { data: voiceData }, { data: profileData }, { data: guildData }] = await Promise.all([
            supabase.from('member_levels').select('*').eq('guild_id', guildId).eq('user_id', targetUser.id).single(),
            supabase.from('member_voice_levels').select('*').eq('guild_id', guildId).eq('user_id', targetUser.id).single(),
            supabase.from('user_profiles').select('*').eq('user_id', targetUser.id).single(),
            supabase.from('guilds').select('settings').eq('id', guildId).single()
        ]);

        const customBgURL = guildData?.settings?.rank_background_url || null;

        if (!memberData && !profileData && !voiceData) {
            return interaction.editReply({ content: 'งื้อออ ยังไม่มีข้อมูลโปรไฟล์เลยเมี๊ยว🐾 ลองพิมพ์คุยกันก่อนน้าา!' });
        }

        // --- 2. คำนวณค่าต่างๆ ---
        const xpMultiplier = 100;
        
        // Chat
        const chatTotalChars = memberData?.total_chars || 0;
        const chatLevel = Math.floor(Math.sqrt(chatTotalChars / xpMultiplier));
        const chatCurrentXP = chatTotalChars - (xpMultiplier * (chatLevel ** 2));
        const chatRequiredXP = (xpMultiplier * ((chatLevel + 1) ** 2)) - (xpMultiplier * (chatLevel ** 2));
        
        // Voice
        const voiceTotalSeconds = voiceData?.total_seconds || 0;
        const voiceLevel = Math.floor(Math.sqrt(voiceTotalSeconds / 300));
        const voiceHours = (voiceTotalSeconds / 3600).toFixed(1);
        const voiceCurrentXP = voiceTotalSeconds - (300 * (voiceLevel ** 2));
        const voiceRequiredXP = (300 * ((voiceLevel + 1) ** 2)) - (300 * (voiceLevel ** 2));

        const mbtiText = profileData?.mbti || 'Unknown';
        const purrPoints = profileData?.purr_points || 0;

        // --- 3. เริ่มวาดรูป (Canvas) ---
        const canvas = createCanvas(984, 282);
        const ctx = canvas.getContext('2d');

        try {
            // โหลดพื้นหลัง (Custom หรือ Default)
            await drawBackground(ctx, canvas.width, canvas.height, customBgURL);

            // เพิ่ม Overlay มืดนิดนึงเพื่อให้ตัวหนังสือเด่น
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            drawRoundedRect(ctx, 20, 20, 944, 242, 15);

            // --- วาด Avatar ---
            const avatarSize = 180;
            const avatarX = 50;
            const avatarY = 51;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            
            const member = interaction.guild.members.cache.get(targetUser.id) || await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const avatarURL = member ? member.displayAvatarURL({ extension: 'png', size: 256 }) : targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatarImg = await loadImage(avatarURL);
            ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            // --- วาดตัวหนังสือหลัก ---
            const pinkColor = '#FFB6C1';
            ctx.fillStyle = pinkColor;
            ctx.font = 'bold 36px "Leelawadee UI", Tahoma, sans-serif';
            
            // ดึงชื่อเล่น (Nickname) ในเซิร์ฟเวอร์เมี๊ยว🐾
            const displayName = member ? member.displayName : targetUser.username;
            
            ctx.fillText(displayName, 260, 70);

            // --- วาดชื่อเซิร์ฟเวอร์ (กรองสัญลักษณ์พิเศษที่อ่านไม่ออกออกเมี๊ยว🐾) ---
            const cleanGuildName = interaction.guild.name.replace(/[^\u0020-\u007E\u0E00-\u0E7F]/g, '').trim();
            ctx.fillStyle = 'rgba(255, 182, 193, 0.7)'; // Semitransparent pink
            ctx.font = '18px "Leelawadee UI", Tahoma, sans-serif';
            ctx.fillText(`Issued by: ${cleanGuildName}`, 260, 95);

            // --- แถบพลัง Chat ---
            const barWidth = 650;
            const barX = 260;
            const chatBarY = 145;
            
            // พื้นหลังแถบ
            ctx.fillStyle = 'rgba(255, 182, 193, 0.1)';
            drawRoundedRect(ctx, barX, chatBarY, barWidth, 20, 10);
            
            // แถบจริง (สีชมพู Gradient)
            const chatProgress = Math.min(chatCurrentXP / chatRequiredXP, 1);
            if (chatProgress > 0) {
                const chatGrad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
                chatGrad.addColorStop(0, '#FFB6C1');
                chatGrad.addColorStop(1, '#FFD1DC');
                ctx.fillStyle = chatGrad;
                drawRoundedRect(ctx, barX, chatBarY, barWidth * chatProgress, 20, 10);
            }

            // ข้อความเลเวลแชท
            ctx.fillStyle = pinkColor;
            ctx.font = 'bold 18px "Leelawadee UI", Tahoma, sans-serif';
            ctx.fillText(`💬 Chat Level: ${chatLevel}`, barX, chatBarY - 10);
            ctx.textAlign = 'right';
            ctx.font = '16px "Leelawadee UI", Tahoma, sans-serif';
            ctx.fillStyle = 'rgba(255, 182, 193, 0.8)';
            ctx.fillText(`${chatCurrentXP.toLocaleString()} / ${chatRequiredXP.toLocaleString()} XP`, barX + barWidth, chatBarY - 10);
            ctx.textAlign = 'left';

            // --- แถบพลัง Voice ---
            const voiceBarY = 215;
            
            // พื้นหลังแถบ
            ctx.fillStyle = 'rgba(255, 182, 193, 0.1)';
            drawRoundedRect(ctx, barX, voiceBarY, barWidth, 20, 10);
            
            // แถบจริง (สีฟ้า Gradient)
            const voiceProgress = Math.min(voiceCurrentXP / voiceRequiredXP, 1);
            if (voiceProgress > 0) {
                const voiceGrad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
                voiceGrad.addColorStop(0, '#A0C4FF');
                voiceGrad.addColorStop(1, '#BDB2FF');
                ctx.fillStyle = voiceGrad;
                drawRoundedRect(ctx, barX, voiceBarY, barWidth * voiceProgress, 20, 10);
            }

            // ข้อความเลเวลเสียง
            ctx.fillStyle = pinkColor;
            ctx.font = 'bold 18px "Leelawadee UI", Tahoma, sans-serif';
            ctx.fillText(`🎙️ Voice Level: ${voiceLevel} (${voiceHours}h)`, barX, voiceBarY - 10);
            ctx.textAlign = 'right';
            ctx.font = '16px "Leelawadee UI", Tahoma, sans-serif';
            ctx.fillStyle = 'rgba(255, 182, 193, 0.8)';
            ctx.fillText(`Voice Points`, barX + barWidth, voiceBarY - 10);
            ctx.textAlign = 'left';

            // --- ลายน้ำ PurrPaw (มุมขวาล่าง) ---
            ctx.fillStyle = 'rgba(255, 182, 193, 0.3)';
            ctx.font = 'italic 14px "Leelawadee UI", Tahoma, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('PurrPaw - Making Every Chat Pawsome 🐾', 950, 265);
            ctx.textAlign = 'left';

            // --- ส่งรูป ---
            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
            return interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('Canvas Draw Error:', error);
            return interaction.editReply({ content: 'งื้อออ บอทวาดรูปพลาดไปนิดนึงเมี๊ยว🐾' });
        }
    }
};

// 🎨 ฟังก์ชันช่วยวาดสี่เหลี่ยมมุมมนเมี๊ยว🐾
function drawRoundedRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
}

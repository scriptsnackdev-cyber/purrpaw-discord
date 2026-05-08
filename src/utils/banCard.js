const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { drawBackground, drawImageCover } = require('./canvasHelper');
const { fontStack, fontStackBold } = require('./fontHelper');
const { AttachmentBuilder } = require('discord.js');

/**
 * 🎨 ฟังก์ชันวาดบัตรประกาศแบนเมี๊ยว🐾
 */
async function generateBanCard(targetUser, duration, reason, guild) {
    const canvas = createCanvas(984, 282);
    const ctx = canvas.getContext('2d');

    try {
        // 1. โหลดพื้นหลัง (ใช้ของกิลด์ถ้ามี)
        // ดึงข้อมูลกิลด์จาก DB (ถ้ามี)
        const supabase = require('../supabaseClient');
        const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
        const customBgURL = guildData?.settings?.rank_background_url || null;

        await drawBackground(ctx, canvas.width, canvas.height, customBgURL);

        // 2. Overlay มืดๆ แดงๆ ให้ดูขรึมเมี๊ยว🐾
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        drawRoundedRect(ctx, 20, 20, 944, 242, 15);
        
        // ขอบแดงบางๆ
        ctx.strokeStyle = 'rgba(255, 77, 77, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. วาด Avatar
        const avatarSize = 180;
        const avatarX = 50;
        const avatarY = 51;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarImg = await loadImage(avatarURL);
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // 4. ข้อความหลัก
        const redColor = '#FF4D4D';
        const whiteColor = '#FFFFFF';
        
        // ชื่อผู้โดนแบน
        ctx.fillStyle = whiteColor;
        ctx.font = `bold 36px ${fontStackBold}`;
        ctx.fillText(targetUser.displayName, 260, 75);

        // สถานะ: BANNED
        ctx.fillStyle = redColor;
        ctx.font = `bold 24px ${fontStackBold}`;
        ctx.fillText('STATUS: TEMPORARY BANNED 🐾', 260, 110);

        // 5. รายละเอียด (Reason & Duration)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `20px ${fontStack}`;
        
        // ตัดข้อความ Reason ถ้ามันยาวไปเมี๊ยว🐾
        const cleanReason = reason.length > 50 ? reason.substring(0, 47) + '...' : reason;
        ctx.fillText(`เหตุผล: ${cleanReason}`, 260, 155);
        ctx.fillText(`ระยะเวลา: ${duration} นาที`, 260, 190);
        
        // 6. ลายน้ำ PurrPaw
        ctx.fillStyle = 'rgba(255, 77, 77, 0.4)';
        ctx.font = `italic 14px ${fontStack}`;
        ctx.textAlign = 'right';
        ctx.fillText('PurrPaw Moderation System - Play Niceเมี๊ยว🐾', 950, 265);
        ctx.textAlign = 'left';

        // 7. สัญลักษณ์แบน (วงกลมขีดฆ่า) เล็กๆ ตรงมุม Avatar
        ctx.strokeStyle = redColor;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize - 20, avatarY + 20, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(avatarX + avatarSize - 20 - 15, avatarY + 20 + 15);
        ctx.lineTo(avatarX + avatarSize - 20 + 15, avatarY + 20 - 15);
        ctx.stroke();

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'ban_announcement.png' });
        return attachment;

    } catch (error) {
        console.error('[BanCard] Error:', error);
        return null;
    }
}

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

module.exports = { generateBanCard };

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const { drawBackground } = require('./canvasHelper');

/**
 * Generates a Role Announcement image card
 * @param {import('discord.js').User} user 
 * @param {string} roleName 
 * @param {string} displayName 
 * @param {string} avatarURL 
 * @param {string} [customBackgroundURL]
 * @returns {Promise<Buffer>}
 */
async function generateRoleCard(user, roleName, displayName, avatarURL, customBackgroundURL = null) {
    const canvas = createCanvas(984, 282);
    const ctx = canvas.getContext('2d');

    // 1. Load Background (Custom or Default)
    await drawBackground(ctx, canvas.width, canvas.height, customBackgroundURL);

    // 2. Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    drawRoundedRect(ctx, 20, 20, 944, 242, 20);

    // 3. Avatar
    const avatarSize = 160;
    const avatarX = 50;
    const avatarY = (canvas.height - avatarSize) / 2;
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    const avatarImg = await loadImage(avatarURL || user.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Border
    const themeColor = '#FFB6C1';
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 3, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Texts
    const textX = 240;
    const pinkColor = '#FFB6C1';
    const fontStack = '"Leelawadee UI", Tahoma, sans-serif';
    
    // User Name
    ctx.fillStyle = pinkColor;
    ctx.textAlign = 'left';
    ctx.font = `bold 38px ${fontStack}`;
    ctx.fillText(displayName || user.username, textX, 85);

    // Badge
    ctx.fillStyle = themeColor;
    drawRoundedRect(ctx, textX, 105, 250, 40, 10);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold 22px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(`NEW ROLE GRANTED!`, textX + 125, 133);

    // Role Name (Dynamic Sizing)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    
    let fontSize = 50;
    let displayRole = roleName;
    
    // คำนวณขนาดฟอนต์ตามความยาวเมี๊ยว🐾
    ctx.font = `bold ${fontSize}px ${fontStack}`;
    let textWidth = ctx.measureText(displayRole).width;
    const maxWidth = 680;

    while (textWidth > maxWidth && fontSize > 24) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px ${fontStack}`;
        textWidth = ctx.measureText(displayRole).width;
    }

    // ถ้ายังยาวเกินไปอีกค่อยตัดเมี๊ยว🐾
    if (textWidth > maxWidth) {
        while (ctx.measureText(displayRole + '...').width > maxWidth) {
            displayRole = displayRole.substring(0, displayRole.length - 1);
        }
        displayRole += '...';
    }

    ctx.fillText(displayRole, textX, 205);

    // Subtext
    ctx.fillStyle = 'rgba(255, 182, 193, 0.7)';
    ctx.font = `italic 20px ${fontStack}`;
    ctx.fillText('Congratulations on your new achievement! 🐾', textX, 245);

    return await canvas.encode('png');
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

module.exports = { generateRoleCard };

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const { drawBackground } = require('./canvasHelper');
const { fontStack, fontStackBold } = require('./fontHelper');

/**
 * Generates a Level Up image card
 * @param {import('discord.js').User} user 
 * @param {number} level 
 * @param {string} type 'Chat' or 'Voice'
 * @param {string} [roleName] 
 * @param {string} [displayName]
 * @param {string} [avatarURL]
 * @param {string} [customBackgroundURL]
 * @returns {Promise<Buffer>}
 */
async function generateLevelUpCard(user, level, type = 'Chat', roleName = null, displayName = null, avatarURL = null, customBackgroundURL = null) {
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
    
    // Avatar Shadow
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
    
    const finalAvatarURL = avatarURL || user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(finalAvatarURL);
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Avatar Border
    const themeColor = type === 'Chat' ? '#FFB6C1' : '#A0C4FF';
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 3, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Texts
    const textX = 240;
    const pinkColor = '#FFB6C1';
    
    // User Name (Nickname if provided)
    ctx.fillStyle = pinkColor;
    ctx.textAlign = 'left';
    ctx.font = `bold 42px ${fontStackBold}`;
    ctx.fillText(displayName || user.username, textX, 85);

    // LEVEL UP Text Badge
    ctx.fillStyle = themeColor;
    drawRoundedRect(ctx, textX, 105, 220, 40, 10);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold 22px ${fontStackBold}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${type.toUpperCase()} LEVEL UP!`, textX + 110, 133);

    // Level Number (Big)
    ctx.textAlign = 'right';
    ctx.fillStyle = pinkColor;
    ctx.font = `bold 100px ${fontStackBold}`;
    ctx.fillText(level, 930, 140);
    ctx.font = `bold 30px ${fontStackBold}`;
    ctx.fillText('LEVEL', 930, 55);

    // Progress Bar (Full for level up effect)
    const barWidth = 690;
    const barY = 185;
    ctx.fillStyle = 'rgba(255, 182, 193, 0.2)'; // Faint pink background
    drawRoundedRect(ctx, textX, barY, barWidth, 15, 7);
    
    const gradient = ctx.createLinearGradient(textX, 0, textX + barWidth, 0);
    gradient.addColorStop(0, themeColor);
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, textX, barY, barWidth, 15, 7);

    // Role / Subtext
    ctx.textAlign = 'left';
    ctx.fillStyle = pinkColor;
    ctx.font = `italic 22px ${fontStack}`;
    if (roleName) {
        ctx.fillText(`🎁 New Role Unlocked: ${roleName}`, textX, 240);
    } else {
        ctx.fillText('🐾 Keep active to earn more rewards!', textX, 240);
    }

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

module.exports = { generateLevelUpCard };

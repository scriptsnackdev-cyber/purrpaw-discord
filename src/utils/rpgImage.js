const { fontStack, fontStackBold } = require('./fontHelper');

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const supabase = require('../supabaseClient');
const { drawBackground } = require('./canvasHelper');

async function generateRPGImage(players, interaction, actedUserIds = []) {
    const canvas = createCanvas(984, 282);
    const ctx = canvas.getContext('2d');

    try {
        // ดึง Settings เพื่อเช็คพื้นหลังเมี๊ยว🐾
        const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', interaction.guild.id).single();
        const customBgURL = guildData?.settings?.rank_background_url || null;

        // 1. Load Background (Custom หรือ Default)
        await drawBackground(ctx, canvas.width, canvas.height, customBgURL);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        drawRoundedRect(ctx, 20, 20, 944, 242, 15);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 32px ${fontStackBold}`;
        ctx.fillText('⚔️ สถานะปาร์ตี้', 50, 65);

        const avatarSize = 100;
        const spacing = 110; // ลดระยะห่างลงเพื่อให้จุได้ 8 คน
        const startX = 60;
        const startY = 100;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const x = startX + (i * spacing);
            const y = startY;

            try {
                // พยายามดึงข้อมูล Member จากในเซิร์ฟเวอร์เมี๊ยว🐾
                let displayName = player.name;
                let avatarUrl = '';

                try {
                    const member = await interaction.guild.members.fetch(player.id);
                    displayName = member.displayName;
                    avatarUrl = member.displayAvatarURL({ extension: 'png', size: 128 });
                } catch (err) {
                    // ถ้าหาไม่เจอ (เช่น ออกจากเซิร์ฟ) ให้ดึง User ปกติแทน
                    const user = await interaction.client.users.fetch(player.id);
                    displayName = user.displayName || user.username;
                    avatarUrl = user.displayAvatarURL({ extension: 'png', size: 128 });
                }

                const avatarImg = await loadImage(avatarUrl);

                ctx.save();
                ctx.beginPath();
                ctx.arc(x + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatarImg, x, y, avatarSize, avatarSize);
                ctx.restore();

                // เครื่องหมายถูก ✅
                if (actedUserIds.includes(player.id)) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
                    ctx.beginPath();
                    ctx.arc(x + avatarSize - 20, y + avatarSize - 20, 15, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x + avatarSize - 28, y + avatarSize - 20);
                    ctx.lineTo(x + avatarSize - 22, y + avatarSize - 14);
                    ctx.lineTo(x + avatarSize - 14, y + avatarSize - 26);
                    ctx.stroke();
                }

                ctx.fillStyle = '#ffffff';
                ctx.font = `12px ${fontStack}`;
                ctx.textAlign = 'center';
                const finalName = displayName.length > 10 ? displayName.substring(0, 8) + '..' : displayName;
                ctx.fillText(finalName, x + avatarSize / 2, y + avatarSize + 20);
                ctx.textAlign = 'left';
            } catch (err) {
                console.error(`Failed to load avatar/name for ${player.id}:`, err);
            }
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = `italic 14px ${fontStack}`;
        ctx.textAlign = 'right';
        ctx.fillText('PurrPaw RPG Adventure Engine', 950, 265);

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'rpg_status.png' });
    } catch (error) {
        console.error('RPG Image Error:', error);
        return null;
    }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
}

module.exports = { generateRPGImage };

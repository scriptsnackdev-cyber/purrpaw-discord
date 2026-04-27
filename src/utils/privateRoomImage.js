const { createCanvas } = require('@napi-rs/canvas');
const { drawBackground } = require('./canvasHelper');
const supabase = require('../supabaseClient');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { getGuildData } = require('./guildCache');
const { fontStack, fontStackBold } = require('./fontHelper');

/**
 * 🖼️ ฟังก์ชันสำหรับอัปเดตหน้าตาฟอร์มให้แสดงจำนวนห้องที่ใช้งานอยู่เมี๊ยว🐾
 */
async function updatePrivateRoomForm(client, formId) {
    try {
        // 1. ดึงข้อมูลฟอร์ม
        const { data: form } = await supabase.from('private_room_forms').select('*').eq('id', formId).single();
        if (!form || !form.form_message_id || !form.form_channel_id) return;

        const guild = client.guilds.cache.get(form.guild_id);
        if (!guild) return;

        const channel = await guild.channels.fetch(form.form_channel_id).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(form.form_message_id).catch(() => null);
        if (!message) return;

        // 2. ดึงจำนวนห้องที่เปิดอยู่ และ Limit
        const { data: rooms } = await supabase.from('private_rooms').select('id').eq('guild_id', guild.id).eq('is_deleted', false);
        const currentCount = rooms ? rooms.length : 0;
        
        const { settings } = await getGuildData(guild.id);
        const limit = settings.private_room_limit || 20;

        // 3. สร้างรูปภาพ Usage ด้วย Canvas เมี๊ยว🐾
        const canvas = createCanvas(800, 300);
        const ctx = canvas.getContext('2d');
        
        // ใช้ Background ของเซิร์ฟเวอร์ (ถ้ามี)
        await drawBackground(ctx, canvas.width, canvas.height, settings.rank_background_url);

        // วาด Overlay มืดๆ เพื่อให้อ่านตัวหนังสือชัดเมี๊ยว🐾
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // วาดตัวเลข Current / Max
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = `bold 90px ${fontStackBold}`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.fillText(`${currentCount} / ${limit}`, canvas.width / 2, canvas.height / 2 + 20);
        
        ctx.font = `bold 24px ${fontStackBold}`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('ACTIVE PRIVATE ROOMS', canvas.width / 2, canvas.height / 2 + 70);

        const buffer = await canvas.encode('png');
        const attachment = new AttachmentBuilder(buffer, { name: `usage-${formId}.png` });

        // 4. อัปเดต Embed
        const oldEmbed = EmbedBuilder.from(message.embeds[0]);
        oldEmbed.setImage(`attachment://usage-${formId}.png`);

        // --- เพิ่มส่วนแจ้งเวลาว่างถัดไปกรณีห้องเต็มเมี๊ยว🐾 ---
        if (currentCount >= limit) {
            const { data: activeRooms } = await supabase.from('private_rooms').select('expires_at').eq('guild_id', guild.id).eq('is_deleted', false);
            if (activeRooms && activeRooms.length > 0) {
                const sortedRooms = activeRooms.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
                const soonestExpiry = new Date(sortedRooms[0].expires_at);
                const availableTime = new Date(soonestExpiry.getTime() + 5 * 60000);
                
                oldEmbed.setFields([{ 
                    name: '⏳ ห้องถัดไปจะว่างตอน:', 
                    value: `<t:${Math.floor(availableTime.getTime() / 1000)}:F> (<t:${Math.floor(availableTime.getTime() / 1000)}:R>)` 
                }]);
            }
        } else {
            oldEmbed.setFields([]); // ล้างฟิลด์ออกถ้าห้องยังว่างเมี๊ยว🐾
        }

        await message.edit({ embeds: [oldEmbed], files: [attachment] });

    } catch (err) {
        console.error('[updatePrivateRoomForm] Error:', err);
    }
}

module.exports = { updatePrivateRoomForm };

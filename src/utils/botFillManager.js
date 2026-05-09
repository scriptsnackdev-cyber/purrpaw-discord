const { PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const supabase = require('../supabaseClient');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { drawBackground } = require('./canvasHelper');
const { fontStack, fontStackBold } = require('./fontHelper');
const { AttachmentBuilder } = require('discord.js');
const path = require('path');

/**
 * 🐾 ตัวจัดการระบบเติมบอทอัตโนมัติ (PurrPaw Auto-Bot Station)
 */

async function getFillSettings(guildId) {
    const { data } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
    return data?.settings?.bot_fill || {};
}

async function getNextQueueItems(guildId) {
    const { data: room1 } = await supabase
        .from('bot_fill_queue')
        .select('*')
        .eq('guild_id', guildId)
        .eq('room_number', 1)
        .eq('is_processed', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    const { data: room2 } = await supabase
        .from('bot_fill_queue')
        .select('*')
        .eq('guild_id', guildId)
        .eq('room_number', 2)
        .eq('is_processed', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    return { room1, room2 };
}

async function createStationCard(characters) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    try {
        const bgPath = path.join(__dirname, '../assets/rank_bg.png');
        await drawBackground(ctx, canvas.width, canvas.height, bgPath);

        // Overlay สวยๆ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.roundRect(20, 20, 760, 260, 20);
        ctx.fill();

        // วาด Chatheads (Avatar วงกลม)
        const size = 120;
        const startX = (canvas.width - (characters.length * (size + 20) - 20)) / 2;
        const y = 80;

        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const x = startX + i * (size + 20);

            // วาดเงา/ขอบ
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();

            // วาดรูป
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.clip();

            if (char.image_url) {
                const img = await loadImage(char.image_url).catch(() => null);
                if (img) ctx.drawImage(img, x, y, size, size);
            }
            ctx.restore();

            // ชื่อตัวละคร
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold 20px ${fontStackBold}`;
            ctx.textAlign = 'center';
            ctx.fillText(char.name, x + size / 2, y + size + 35);
        }

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'station_card.png' });
    } catch (error) {
        console.error('[BotFillManager] Card Error:', error);
        return null;
    }
}

async function setupAndOpenRoom(guild, roomNumber, queueItem, settings, isManual = false) {
    if (!queueItem) return null;

    const charIds = queueItem.character_ids.split(',').map(id => id.trim());
    const { data: characters } = await supabase.from('ai_characters').select('*').in('id', charIds);

    if (!characters || characters.length === 0) return null;

    // 1. สร้างชื่อห้อง: ˚₊‧꒰ა🎮เติมบอท-[ชื่อบอท]...💗໒꒱‧₊˚
    const charNames = characters.map(c => c.name).join('-');
    let channelName = `˚₊‧꒰ა🎮เติมบอท-${charNames}💗໒꒱‧₊˚`;
    if (channelName.length > 100) channelName = channelName.substring(0, 97) + '...💗໒꒱‧₊˚';

    const categoryId = settings.category_id;
    
    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        }
    ];

    // 🛡️ ดึงสิทธิ์ Mod/Admin จากระบบ Permission หลักเมี๊ยว🐾
    const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
    const modRoles = guildData?.settings?.permissions?.mod_roles || [];
    
    // ให้สิทธิ์ Mod ทุกคนเข้าห้องได้ในช่วง Setup
    for (const roleRef of modRoles) {
        const role = guild.roles.cache.get(roleRef) || guild.roles.cache.find(r => r.name === roleRef);
        if (role) {
            permissionOverwrites.push({
                id: role.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            });
        }
    }

    // 3. สร้างห้อง
    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId || null,
        permissionOverwrites,
    });

    // 4. บันทึก ID ห้องลงใน Queue เมี๊ยว🐾 (เพื่อเอาไว้ตามไปลบ)
    await supabase.from('bot_fill_queue').update({ 
        active_channel_id: channel.id 
    }).eq('id', queueItem.id);

    // 5. Summon บอท
    for (const char of characters) {
        await supabase.from('active_ai_chats').upsert({
            channel_id: channel.id,
            guild_id: guild.id,
            character_id: char.id
        });
    }

    // 6. ถ้าเป็น Manual ให้เปิดสาธารณะทันทีเมี๊ยว🐾
    if (isManual) {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
            ViewChannel: true,
            SendMessages: true
        });
    } else {
        // ส่ง Station Card (เฉพาะระบบ Auto)
        const card = await createStationCard(characters);
        if (card) {
            await channel.send({ 
                content: `🚀 **กำลังเตรียมความพร้อมของสถานีเติมบอทที่ ${roomNumber}...**`,
                files: [card] 
            });
        }
    }

    return channel;
}

async function closeAndCleanup(guild, queueItem) {
    if (!queueItem || !queueItem.active_channel_id) return;

    try {
        const channel = await guild.channels.fetch(queueItem.active_channel_id).catch(() => null);
        if (channel) {
            await channel.delete('Bot Fill Session Cleanup 🐾');
        }

        // ล้าง AI Chat Cache
        await supabase.from('active_ai_chats').delete().eq('channel_id', queueItem.active_channel_id);

        // Mark คิวว่ารันเสร็จแล้ว
        await supabase.from('bot_fill_queue').update({ 
            is_processed: true 
        }).eq('id', queueItem.id);

    } catch (error) {
        console.error(`[BotFillManager] Cleanup Error for ${queueItem.id}:`, error);
    }
}

async function generateQueueBoard(sessions, room1Queue, room2Queue) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');
    const bgPath = path.join(__dirname, '../assets/rank_bg.png');

    try {
        await drawBackground(ctx, canvas.width, canvas.height, bgPath);

        // Overlay & Title
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // ปรับให้เข้มขึ้นจาก 0.7 เป็น 0.8 เมี๊ยว🐾
        ctx.roundRect(30, 30, 940, 540, 30);
        ctx.fill();

        ctx.fillStyle = '#FFB6C1';
        ctx.font = `bold 40px ${fontStackBold}`;
        ctx.textAlign = 'center';
        ctx.fillText('📋 ตารางคิวสถานีเติมบอทอัตโนมัติ', 500, 85);

        // Table Header
        const startY = 140;
        const colWidths = [250, 320, 320];
        const rowHeight = 120;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(50, startY, 900, 50);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold 24px ${fontStackBold}`;
        ctx.textAlign = 'left';
        ctx.fillText('วันที่', 80, startY + 35);
        ctx.fillText('ห้องที่ 1', 350, startY + 35);
        ctx.fillText('ห้องที่ 2', 670, startY + 35);

        // Draw Rows
        for (let i = 0; i < Math.min(sessions.length, 3); i++) { // โชว์สูงสุด 3 วัน
            const y = startY + 60 + (i * rowHeight);
            const dateStr = sessions[i];
            
            // รีเซ็ตการจัดวางข้อความให้ชิดซ้ายทุกแถวเมี๊ยว🐾
            ctx.textAlign = 'left';

            // เส้นคั่น
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.moveTo(50, y + rowHeight - 10);
            ctx.lineTo(950, y + rowHeight - 10);
            ctx.stroke();

            // วันที่
            ctx.fillStyle = '#FFB6C1';
            ctx.font = `bold 22px ${fontStackBold}`;
            ctx.fillText(dateStr, 70, y + 65);

            // วาด Chatheads สำหรับแต่ละห้อง
            const drawChatheads = async (qItem, startX) => {
                if (!qItem) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.font = `italic 20px ${fontStack}`;
                    ctx.fillText('ว่าง / ไม่มีคิว', startX, y + 65);
                    return;
                }

                const charIds = qItem.character_ids.split(',').map(id => id.trim());
                const { data: chars } = await supabase.from('ai_characters').select('name, image_url').in('id', charIds);
                
                if (chars) {
                    const size = 60;
                    for (let j = 0; j < chars.length; j++) {
                        const char = chars[j];
                        const img = await loadImage(char.image_url).catch(() => null);
                        const chatheadX = startX + (j * 75); // ขยับห่างกันนิดนึงเพื่อให้มีที่ใส่ชื่อ
                        
                        if (img) {
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(chatheadX + size/2, y + 25 + size/2, size/2, 0, Math.PI * 2);
                            ctx.clip();
                            ctx.drawImage(img, chatheadX, y + 25, size, size);
                            ctx.restore();
                        }

                        // วาดชื่อตัวละครตัวเล็กๆ ใต้รูปเมี๊ยว🐾
                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = `14px ${fontStack}`;
                        ctx.textAlign = 'center';
                        const displayName = char.name.length > 8 ? char.name.substring(0, 7) + '..' : char.name;
                        ctx.fillText(displayName, chatheadX + size/2, y + 25 + size + 15);
                    }
                }
            };

            await drawChatheads(room1Queue[i], 330);
            await drawChatheads(room2Queue[i], 650);
        }

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'queue_board.png' });
    } catch (error) {
        console.error('[BotFillManager] Board Error:', error);
        return null;
    }
}

module.exports = { 
    getFillSettings, 
    getNextQueueItems, 
    setupAndOpenRoom, 
    closeAndCleanup,
    generateQueueBoard
};

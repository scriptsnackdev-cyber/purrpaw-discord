const supabase = require('../supabaseClient');

/**
 * 🧹 ฟังก์ชันสำหรับลบห้องส่วนตัวที่หมดอายุแล้วเมี๊ยว🐾
 */
async function cleanupPrivateRooms(client) {
    try {
        const now = new Date().toISOString();
        
        // 1. ดึงห้องที่หมดอายุแล้ว
        const { data: expiredRooms, error } = await supabase
            .from('private_rooms')
            .select('*')
            .lt('expires_at', now)
            .eq('is_deleted', false);

        if (error) {
            console.error('[PrivateRoom Cleanup] DB Fetch Error:', error.message);
            return;
        }

        if (!expiredRooms || expiredRooms.length === 0) return;

        console.log(`[PrivateRoom Cleanup] Found ${expiredRooms.length} expired rooms. Processing... 🐾`);

        for (const room of expiredRooms) {
            const guild = client.guilds.cache.get(room.guild_id);
            if (!guild) continue;

            const channel = guild.channels.cache.get(room.channel_id);
            if (channel) {
                try {
                    await channel.delete('Private Room Expired 🐾');
                    console.log(`[PrivateRoom Cleanup] Deleted channel: ${room.channel_id}`);
                } catch (err) {
                    console.error(`[PrivateRoom Cleanup] Failed to delete channel ${room.channel_id}:`, err.message);
                }
            }

            await supabase
                .from('private_rooms')
                .update({ is_deleted: true })
                .eq('id', room.id);

            // 🟢 อัปเดตรูปหน้าฟอร์มเมี๊ยว🐾
            try {
                const { data: form } = await supabase.from('private_room_forms').select('id').eq('guild_id', guild.id).order('created_at', { ascending: false }).limit(1).single();
                if (form) {
                    const { updatePrivateRoomForm } = require('./privateRoomImage');
                    await updatePrivateRoomForm(client, form.id);
                }
            } catch (e) { /* เงียบไว้เมี๊ยว */ }
        }

    } catch (err) {
        console.error('[PrivateRoom Cleanup] General Error:', err);
    }
}

/**
 * 🔒 ฟังก์ชันสำหรับลบห้องรายอัน (ใช้สำหรับปุ่มปิดห้องเมี๊ยว🐾)
 */
async function deletePrivateRoom(client, room) {
    const guild = client.guilds.cache.get(room.guild_id);
    if (!guild) return;

    const channel = guild.channels.cache.get(room.channel_id);
    if (channel) {
        try {
            await channel.delete('Private Room Closed Manually 🐾');
        } catch (err) {
            console.error(`[PrivateRoom] Failed to delete channel ${room.channel_id}:`, err.message);
        }
    }

    await supabase
        .from('private_rooms')
        .update({ is_deleted: true })
        .eq('id', room.id);
}

/**
 * ⏰ ฟังก์ชันสำหรับแจ้งเตือนก่อนห้องหมดอายุเมี๊ยว🐾
 */
async function warnPrivateRooms(client) {
    try {
        const now = new Date();
        
        // ดึงห้องที่ยังไม่ลบ และยังไม่ได้เตือนบางระดับเมี๊ยว🐾
        const { data: activeRooms, error } = await supabase
            .from('private_rooms')
            .select('*')
            .eq('is_deleted', false)
            .or('warned_30m.eq.false,warned_10m.eq.false,warned_1m.eq.false');

        if (error || !activeRooms) return;

        for (const room of activeRooms) {
            const guild = client.guilds.cache.get(room.guild_id);
            if (!guild) continue;

            const channel = guild.channels.cache.get(room.channel_id);
            if (!channel) continue;

            const expiresAt = new Date(room.expires_at);
            const diffMs = expiresAt - now;
            const diffMin = diffMs / 60000;

            let warningMsg = null;
            let updateField = null;

            // 1. เตือน 1 นาทีสุดท้าย (สำคัญที่สุดเมี๊ยว🐾)
            if (diffMin <= 1 && !room.warned_1m) {
                warningMsg = '⚠️ **ประกาศเมี๊ยว!** ห้องนี้จะถูกลบในอีก **1 นาที** แล้วนะเมี๊ยวว! รีบบอกลากันเร็วว! 🐾💨';
                updateField = { warned_1m: true };
            }
            // 2. เตือน 10 นาที
            else if (diffMin <= 10 && !room.warned_10m) {
                warningMsg = '⏰ **แจ้งเตือนเมี๊ยว!** ห้องนี้เหลือเวลาอีก **10 นาที** จะถูกลบแล้วนะเมี๊ยวว 🐾';
                updateField = { warned_10m: true };
            }
            // 3. เตือน 30 นาที
            else if (diffMin <= 30 && !room.warned_30m) {
                warningMsg = '📢 **แจ้งข่าวเมี๊ยว!** ห้องนี้เหลือเวลาอีก **30 นาที** นะเมี๊ยวว ยังคุยกันได้อีกพักใหญ่เลย! 🐾✨';
                updateField = { warned_30m: true };
            }

            if (warningMsg && updateField) {
                await channel.send(warningMsg).catch(() => {});
                await supabase.from('private_rooms').update(updateField).eq('id', room.id);
            }
        }
    } catch (err) {
        console.error('[PrivateRoom Warning] Error:', err);
    }
}

module.exports = { cleanupPrivateRooms, deletePrivateRoom, warnPrivateRooms };

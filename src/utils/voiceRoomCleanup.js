const supabase = require('../supabaseClient');
const { EmbedBuilder } = require('discord.js');

/**
 * 🧹 ฟังก์ชันสำหรับตรวจสอบและลบห้องเสียงที่ไม่มีคนอยู่เมี๊ยว🐾
 */
async function cleanupVoiceRooms(client) {
    try {
        const now = new Date();

        // 1. ดึงห้องเสียงที่ยังไม่ถูกลบ
        const { data: activeRooms, error } = await supabase
            .from('voice_rooms')
            .select('*')
            .eq('is_deleted', false);

        if (error || !activeRooms) return;

        for (const room of activeRooms) {
            const guild = client.guilds.cache.get(room.guild_id);
            if (!guild) continue;

            const channel = guild.channels.cache.get(room.channel_id);
            if (!channel) {
                // ถ้าหาห้องไม่เจอใน Discord แล้ว ให้มาร์คว่าลบแล้วใน DB เลยเมี๊ยว🐾
                await supabase.from('voice_rooms').update({ is_deleted: true }).eq('id', room.id);
                continue;
            }

            // เช็คจำนวนคนในห้อง (ไม่นับบอท)
            const members = channel.members.filter(m => !m.user.bot);

            if (members.size > 0) {
                // ถ้ามีคนอยู่ ให้เคลียร์เวลาว่าง (ถ้ามี)
                if (room.empty_since) {
                    await supabase.from('voice_rooms').update({
                        empty_since: null,
                        warning_sent_10: false,
                        warning_sent_5: false,
                        warning_sent_1: false
                    }).eq('id', room.id);
                }
                continue;
            }

            // ถ้าห้องว่าง...
            if (!room.empty_since) {
                // เพิ่งว่างเมี๊ยว🐾 (ควรถอดออกไปทำใน voiceStateUpdate แต่กันเหนียวไว้ตรงนี้ด้วย)
                await supabase.from('voice_rooms').update({ empty_since: new Date().toISOString() }).eq('id', room.id);
                continue;
            }

            const emptySince = new Date(room.empty_since);
            const diffMin = (now - emptySince) / 60000;

            // --- ระบบลบห้อง (30 นาที) ---
            if (diffMin >= 30) {
                try {
                    await channel.delete('Voice Room Empty for 30m 🐾');
                    await supabase.from('voice_rooms').update({ is_deleted: true }).eq('id', room.id);
                    console.log(`[VoiceRoom Cleanup] Deleted empty room: ${room.channel_id}`);
                } catch (err) {
                    console.error(`[VoiceRoom Cleanup] Failed to delete channel ${room.channel_id}:`, err.message);
                }
                continue;
            }

            // --- ระบบแจ้งเตือน (นับถอยหลังจาก 30 นาที) ---
            let warningMsg = null;
            let updateField = null;

            const timeLeft = 30 - diffMin;

            if (timeLeft <= 1 && !room.warning_sent_1) {
                warningMsg = '⚠️ **ประกาศเมี๊ยว!** ห้องนี้ไม่มีคนอยู่เกิน 29 นาทีแล้ว และจะถูกลบในอีก **1 นาที** นะเมี๊ยวว! 🐾💨';
                updateField = { warning_sent_1: true };
            } else if (timeLeft <= 5 && !room.warning_sent_5) {
                warningMsg = '⏰ **แจ้งเตือนเมี๊ยว!** ห้องนี้ว่างมานานแล้วนะ เหลือเวลาอีก **5 นาที** จะถูกลบแล้วเมี๊ยวว 🐾';
                updateField = { warning_sent_5: true };
            } else if (timeLeft <= 10 && !room.warning_sent_10) {
                warningMsg = '📢 **แจ้งข่าวเมี๊ยว!** ห้องนี้ว่างมา 20 นาทีแล้ว เหลือเวลาอีก **10 นาที** จะถูกลบนะเมี๊ยวว 🐾✨';
                updateField = { warning_sent_10: true };
            }

            if (warningMsg && updateField) {
                await channel.send(warningMsg).catch(() => { });
                await supabase.from('voice_rooms').update(updateField).eq('id', room.id);
            }
        }
    } catch (err) {
        console.error('[VoiceRoom Cleanup] Error:', err);
    }
}

/**
 * 🔒 ลบห้องเสียงรายอัน (สำหรับปุ่มปิดห้อง)
 */
async function deleteVoiceRoom(client, room) {
    const guild = client.guilds.cache.get(room.guild_id);
    if (!guild) return;

    const channel = guild.channels.cache.get(room.channel_id);
    if (channel) {
        try {
            await channel.delete('Voice Room Closed Manually 🐾');
        } catch (err) {
            console.error(`[VoiceRoom] Failed to delete channel ${room.channel_id}:`, err.message);
        }
    }

    await supabase.from('voice_rooms').update({ is_deleted: true }).eq('id', room.id);
}

module.exports = { cleanupVoiceRooms, deleteVoiceRoom };

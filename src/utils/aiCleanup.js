const supabase = require('../supabaseClient');

/**
 * 🧹 ฟังก์ชันสำหรับลบห้องแชท AI ที่หมดอายุแล้วเมี๊ยว🐾
 * @param {import('discord.js').Client} client 
 */
async function cleanupExpiredSessions(client) {
    try {
        const now = new Date().toISOString();
        const nowObj = new Date();
        
        // 1. แจ้งเตือนห้องที่ใกล้หมดอายุ (เหลือ < 10 นาที) เมี๊ยว🐾
        const tenMinsLater = new Date(nowObj.getTime() + 10 * 60 * 1000).toISOString();
        const { data: nearExpiry } = await supabase
            .from('ai_chat_sessions')
            .select('*')
            .eq('is_deleted', false)
            .eq('warning_sent', false)
            .lt('expires_at', tenMinsLater)
            .gt('expires_at', now);

        if (nearExpiry && nearExpiry.length > 0) {
            for (const session of nearExpiry) {
                const guild = client.guilds.cache.get(session.guild_id);
                if (!guild) continue;
                const channel = guild.channels.cache.get(session.channel_id);
                if (channel) {
                    await channel.send('⚠️ **ประกาศจาก PurrPaw:** ห้องแชทส่วนตัวนี้จะถูกปิดลงในอีก **10 นาที** เนื่องจากหมดเวลาการใช้งานฟอร์มแล้วเมี๊ยว! กรุณาสรุปบทสนทนาด้วยนะเมี๊ยววว🐾').catch(() => {});
                }
                await supabase.from('ai_chat_sessions').update({ warning_sent: true }).eq('id', session.id);
            }
        }

        // 2. ดึงข้อมูลห้องที่หมดอายุแล้วจริงๆ เพื่อลบทิ้ง
        const { data: expiredSessions, error } = await supabase
            .from('ai_chat_sessions')
            .select('*')
            .lt('expires_at', now)
            .eq('is_deleted', false);

        if (error) {
            console.error('[AI Cleanup] DB Fetch Error:', error.message);
            return;
        }

        if (!expiredSessions || expiredSessions.length === 0) return;

        console.log(`[AI Cleanup] Found ${expiredSessions.length} expired sessions. Processing... 🐾`);

        for (const session of expiredSessions) {
            const guild = client.guilds.cache.get(session.guild_id);
            if (!guild) continue;

            const channel = guild.channels.cache.get(session.channel_id);
            
            // ⭐ กฎเหล็ก: ลบเฉพาะห้องที่มีอยู่ในลิส Database เท่านั้น
            if (channel) {
                try {
                    await channel.delete('AI Chat Session Expired 🐾');
                    console.log(`[AI Cleanup] Deleted channel: ${session.channel_id} (expired)`);
                } catch (err) {
                    console.error(`[AI Cleanup] Failed to delete channel ${session.channel_id}:`, err.message);
                }
            } else {
                console.log(`[AI Cleanup] Channel ${session.channel_id} already gone.`);
            }

            // อัปเดตสถานะใน DB ว่าจัดการแล้ว (ไม่ว่าห้องจะยังอยู่หรือหายไปก่อนแล้ว)
            await supabase
                .from('ai_chat_sessions')
                .update({ is_deleted: true })
                .eq('id', session.id);
        }

    } catch (err) {
        console.error('[AI Cleanup] General Error:', err);
    }
}

/**
 * 🚫 ฟังก์ชันสำหรับสั่งปิดห้อง AI ทั้งหมดในเซิร์ฟเวอร์ (Admin Only)
 * @param {import('discord.js').Guild} guild 
 */
async function closeAllSessions(guild) {
    try {
        const { data: activeSessions } = await supabase
            .from('ai_chat_sessions')
            .select('*')
            .eq('guild_id', guild.id)
            .eq('is_deleted', false);

        if (!activeSessions || activeSessions.length === 0) return 0;

        let count = 0;
        for (const session of activeSessions) {
            const channel = guild.channels.cache.get(session.channel_id);
            if (channel) {
                await channel.delete('Admin Manual Close All AI Chats 🐾').catch(() => {});
                count++;
            }
            await supabase.from('ai_chat_sessions').update({ is_deleted: true }).eq('id', session.id);
        }
        return count;
    } catch (err) {
        console.error('[AI Cleanup] Manual Close Error:', err);
        throw err;
    }
}

module.exports = { cleanupExpiredSessions, closeAllSessions };

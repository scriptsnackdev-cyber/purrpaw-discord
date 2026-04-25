const supabase = require('../supabaseClient');

/**
 * ระบบ Cache สำหรับข้อมูล Guild (Features, Settings)
 * เพื่อลดจำนวนการดึงข้อมูลจาก Supabase ในทุกๆ ข้อความ
 */
const cache = new Map();
const TTL = 5 * 60 * 1000; // เก็บไว้ 5 นาทีเมี๊ยว🐾

async function getGuildData(guildId) {
    if (!guildId) return { features: {}, settings: {}, balance_thb: 0 };

    const now = Date.now();
    const cached = cache.get(guildId);

    // ถ้ามีใน Cache และยังไม่หมดอายุ ให้ใช้ของเดิมเมี๊ยว🐾
    if (cached && (now - cached.timestamp < TTL)) {
        return cached.data;
    }

    try {
        const { data, error } = await supabase
            .from('guilds')
            .select('features, settings, balance_thb')
            .eq('id', guildId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 คือไม่พบข้อมูล (ซึ่งอาจเป็นกิลด์ใหม่)
            throw error;
        }

        const guildData = {
            features: data?.features || {},
            settings: data?.settings || {},
            balance_thb: data?.balance_thb || 0
        };

        // บันทึกลง Cache
        cache.set(guildId, {
            data: guildData,
            timestamp: now
        });

        return guildData;
    } catch (err) {
        console.error(`[GuildCache] Error fetching guild ${guildId}:`, err);
        // ถ้าดึงใหม่พลาด แต่เคยมีของเก่า ให้ใช้ของเก่าไปก่อนเมี๊ยว🐾
        return cached ? cached.data : { features: {}, settings: {}, balance_thb: 0 };
    }
}

/**
 * ล้าง Cache ของกิลด์นั้นๆ (ใช้เมื่อมีการอัปเดต Settings)
 */
function invalidateCache(guildId) {
    if (guildId) cache.delete(guildId);
}

module.exports = { getGuildData, invalidateCache };

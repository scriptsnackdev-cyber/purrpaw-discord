const supabase = require('../supabaseClient');
const { getGuildData } = require('./guildCache');

/**
 * ฟังก์ชันสำหรับ Sync ข้อมูลการแนะนำตัวและวันเกิดจากห้องต่างๆ ในกิลด์
 * @param {import('discord.js').Guild} guild 
 */
async function syncGuildProfiles(guild) {
    try {
        const { settings } = await getGuildData(guild.id);

        const introChannelId = settings.intro_channel_id || settings.ai_chat?.intro_channel_id || '1482445140810399928';
        const botIntroChannelId = settings.bot_intro_channel_id || settings.ai_chat?.bot_intro_channel_id || '1486316042824188025';
        const birthdayChannelId = settings.birthday_channel_id || settings.ai_chat?.birthday_channel_id || '1503011148545396897';

        const channels = [
            { id: introChannelId, column: 'message_introduction', name: 'Intro เซิฟ' },
            { id: botIntroChannelId, column: 'message_bot_introduction', name: 'Intro บอท' },
            { id: birthdayChannelId, column: 'message_birthday', name: 'วันเกิด', parseInfo: true }
        ];

        let totalSynced = 0;

        for (const chInfo of channels) {
            const channel = await guild.channels.fetch(chInfo.id).catch(() => null);
            if (!channel || !channel.isTextBased()) continue;

            const messages = await channel.messages.fetch({ limit: 100 }).catch(() => []);
            
            for (const msg of messages.values()) {
                if (msg.author.bot || msg.content.length < 5) continue;

                const content = msg.content;
                const updateData = {
                    guild_id: guild.id,
                    user_id: msg.author.id,
                    message: content,
                    [chInfo.column]: content
                };

                // 🔍 พยายามแกะข้อมูลเพิ่มเติมจากข้อความ (วันเกิด, ตัวละครที่ชอบ)
                const birthDateMatch = content.match(/วัน\/เดือน\/ปี\s*เกิด\s*[:：]\s*([^\n]+)/i);
                const favCharsMatch = content.match(/ตัวละครที่ชอบ\s*[:：]\s*([^\n]+)/i);

                if (birthDateMatch) {
                    let rawDate = birthDateMatch[1].trim();
                    const monthMap = {
                        'มกราคม': '01', 'ม.ค.': '01', 'january': '01', 'jan': '01',
                        'กุมภาพันธ์': '02', 'ก.พ.': '02', 'february': '02', 'feb': '02',
                        'มีนาคม': '03', 'มี.ค.': '03', 'march': '03', 'mar': '03',
                        'เมษายน': '04', 'เม.ย.': '04', 'april': '04', 'apr': '04',
                        'พฤษภาคม': '05', 'พ.ค.': '05', 'may': '05',
                        'มิถุนายน': '06', 'มิ.ย.': '06', 'june': '06', 'jun': '06',
                        'กรกฎาคม': '07', 'ก.ค.': '07', 'july': '07', 'jul': '07',
                        'สิงหาคม': '08', 'ส.ค.': '08', 'august': '08', 'aug': '08',
                        'กันยายน': '09', 'ก.ย.': '09', 'september': '09', 'sep': '09',
                        'ตุลาคม': '10', 'ต.ค.': '10', 'october': '10', 'oct': '10',
                        'พฤศจิกายน': '11', 'พ.ย.': '11', 'november': '11', 'nov': '11',
                        'ธันวาคม': '12', 'ธ.ค.': '12', 'december': '12', 'dec': '12'
                    };

                    const dateParts = rawDate.split(/[\s\/\-]+/).filter(p => p.length > 0);
                    if (dateParts.length === 3) {
                        let day = dateParts[0].padStart(2, '0');
                        let monthPart = dateParts[1].toLowerCase();
                        let month = monthMap[monthPart] || monthMap[monthPart + '.'] || (isNaN(monthPart) ? '01' : monthPart.padStart(2, '0'));
                        let year = parseInt(dateParts[2]);

                        if (!isNaN(year)) {
                            if (year > 2400) year -= 543;
                            else if (year < 100) {
                                if (year <= 26) year = 2000 + year;
                                else if (year <= 70) year = (2500 + year) - 543;
                                else year = 1900 + year;
                            }
                            updateData.birth_date = `${day}/${month}/${year}`;
                        } else {
                            updateData.birth_date = rawDate;
                        }
                    } else {
                        updateData.birth_date = rawDate;
                    }
                }
                if (favCharsMatch) updateData.favorite_characters = favCharsMatch[1].trim();

                const { error } = await supabase.from('user_introductions').upsert(updateData, { onConflict: 'guild_id, user_id' });
                if (!error) totalSynced++;
            }
        }
        console.log(`[ProfileSyncer] Synced ${totalSynced} profiles for guild ${guild.name} (${guild.id})`);
        return totalSynced;
    } catch (err) {
        console.error(`[ProfileSyncer] Error syncing guild ${guild.id}:`, err);
        return 0;
    }
}

/**
 * Sync ข้อมูลทุกกิลด์ที่บอทอยู่
 * @param {import('discord.js').Client} client 
 */
async function syncAllGuildProfiles(client) {
    console.log('[ProfileSyncer] Starting global sync for all guilds...');
    const guilds = client.guilds.cache;
    let total = 0;
    for (const guild of guilds.values()) {
        total += await syncGuildProfiles(guild);
    }
    console.log(`[ProfileSyncer] Global sync completed. Total synced: ${total}`);
}

module.exports = { syncGuildProfiles, syncAllGuildProfiles };

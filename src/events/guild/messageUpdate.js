const { Events } = require('discord.js');
const { getGuildData } = require('../../utils/guildCache');
const supabase = require('../../supabaseClient');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // 1. กรองข้อความที่ไม่ต้องการ (บอท, ไม่มีกิลด์, ข้อความไม่เปลี่ยนแปลง)
        if (newMessage.author?.bot || !newMessage.guild || oldMessage.content === newMessage.content) return;

        // 2. ดึงข้อมูล Settings จาก Cache
        const { settings } = await getGuildData(newMessage.guild.id);

        const introChannelId = settings.ai_chat?.intro_channel_id || '1482445140810399928';
        const botIntroChannelId = '1486316042824188025';
        const birthdayChannelId = settings.ai_chat?.birthday_channel_id || '1503011148545396897';

        const isIntro = newMessage.channel.id === introChannelId;
        const isBotIntro = newMessage.channel.id === botIntroChannelId;
        const isBirthday = newMessage.channel.id === birthdayChannelId;

        // 3. ถ้ามีการแก้ไขข้อความในห้องที่กำหนด ให้ทำการอัปเดตใน Supabase
        if ((isIntro || isBotIntro || isBirthday) && newMessage.content.length > 5) {
            try {
                const content = newMessage.content;
                const updateData = {
                    guild_id: newMessage.guild.id,
                    user_id: newMessage.author.id,
                    message: content // ส่งลงคอลัมน์เก่าด้วยเมี๊ยว🐾
                };

                if (isIntro) updateData.message_introduction = content;
                if (isBotIntro) updateData.message_bot_introduction = content;
                if (isBirthday) updateData.message_birthday = content;

                // ถ้าเป็นห้องวันเกิด ให้แกะข้อมูลใหม่เมี๊ยว🐾
                if (isBirthday) {
                    const birthDateMatch = content.match(/วัน\/เดือน\/ปี\s*เกิด\s*[:：]\s*([^\n]+)/i);
                    const favCharsMatch = content.match(/ตัวละครที่ชอบ\s*[:：]\s*([^\n]+)/i);
                    
                    if (birthDateMatch) {
                        let rawDate = birthDateMatch[1].trim();
                        const monthMap = {
                            'มกราคม': '01', 'ม.ค.': '01', 'january': '01', 'jan': '01',
                            'กุมภาพันธ์': '02', 'ก.พ.': '02', 'february': '02', 'feb': '02',
                            'มีนาคม': '03', 'ม.ค.': '03', 'march': '03', 'mar': '03',
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
                            let month = monthMap[monthPart] || monthMap[monthPart + '.'] || monthPart.padStart(2, '0');
                            let year = parseInt(dateParts[2]);

                            if (!isNaN(year)) {
                                if (year > 2400) {
                                    year = year - 543;
                                } else if (year < 100) {
                                    if (year <= 26) {
                                        year = 2000 + year;
                                    } else if (year <= 70) {
                                        year = (2500 + year) - 543;
                                    } else {
                                        year = 1900 + year;
                                    }
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
                }

                const { error: upsertError } = await supabase.from('user_introductions').upsert(updateData, { onConflict: 'guild_id, user_id' });
                if (upsertError) console.error('Auto Track Error (messageUpdate):', upsertError);
                
                console.log(`[Auto Track] Updated intro/birthday for ${newMessage.author.username} in ${newMessage.guild.name}`);
            } catch (err) {
                console.error('[Auto Track Error] messageUpdate:', err);
            }
        }
    }
};

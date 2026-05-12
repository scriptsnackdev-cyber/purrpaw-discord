const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-profiles')
        .setDescription('Sync profiles from intro and birthday channels (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const introChannelId = '1482445140810399928';
        const botIntroChannelId = '1486316042824188025';
        const birthdayChannelId = '1503011148545396897';

        const channels = [
            { id: introChannelId, column: 'message_introduction', name: 'Intro เซิฟ' },
            { id: botIntroChannelId, column: 'message_bot_introduction', name: 'Intro บอท' },
            { id: birthdayChannelId, column: 'message_birthday', name: 'วันเกิด', parseBirthday: true }
        ];

        let totalSynced = 0;
        let logs = "--- Sync Profile Logs ---\n";

        for (const chInfo of channels) {
            const channel = await interaction.guild.channels.fetch(chInfo.id).catch(() => null);
            if (!channel) {
                logs += `[Error] ไม่พบห้อง: ${chInfo.name} (${chInfo.id})\n`;
                continue;
            }

            logs += `[Processing] กำลังสแกนห้อง: ${chInfo.name}...\n`;
            const messages = await channel.messages.fetch({ limit: 100 }); // ดึง 100 ข้อความล่าสุด
            
            for (const msg of messages.values()) {
                if (msg.author.bot || msg.content.length < 5) continue;

                const updateData = {
                    guild_id: interaction.guild.id,
                    user_id: msg.author.id,
                    message: msg.content, // ส่งลงคอลัมน์เก่าเพื่อเลี่ยง Error Not-Null เมี๊ยว🐾
                    [chInfo.column]: msg.content
                };

                // ถ้าเป็นห้องวันเกิด ให้แกะข้อมูลเพิ่มเมี๊ยว🐾
                if (chInfo.parseBirthday) {
                    const content = msg.content;
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
                }

                const { error } = await supabase.from('user_introductions').upsert(updateData, { onConflict: 'guild_id, user_id' });
                if (!error) {
                    totalSynced++;
                } else {
                    logs += `[Error] ไม่สามารถบันทึกข้อมูลของ ${msg.author.username}: ${error.message}\n`;
                }
            }
        }

        logs += `\n--- Sync Completed! Total Synced: ${totalSynced} messages ---`;
        const attachment = new AttachmentBuilder(Buffer.from(logs), { name: 'sync_logs.txt' });
        await interaction.editReply({ content: `✅ Sync ข้อมูลเรียบร้อยแล้วเมี๊ยว! ทั้งหมด ${totalSynced} รายการ`, files: [attachment] });
    }
};

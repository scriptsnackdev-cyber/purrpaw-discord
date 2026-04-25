const cron = require('node-cron');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const supabase = require('../supabaseClient');
const { EmbedBuilder } = require('discord.js');

function initDailyScheduler(client) {
    // รันทุก 1 นาที (สำหรับทดสอบ)
    cron.schedule('* * * * *', async () => {
        try {
            // ใช้เวลาไทย (GMT+7)
            const now = dayjs().utcOffset(7);
            const currentTime = now.format('HH:mm');
            const currentDay = now.format('ddd').toUpperCase(); // MON, TUE, WED...
            const todayDate = now.format('YYYY-MM-DD');

            console.log(`[DailyScheduler] Checking at ${currentTime} (${currentDay})`);

            // 1. ดึงตารางเวลาทั้งหมดที่ตรงกับวันนี้
            // เราจะดึงมาทั้งหมดก่อนแล้วค่อยมา Filter ด้วย Code เพื่อความยืดหยุ่นของฟิลด์ 'days'
            const { data: schedules, error } = await supabase
                .from('daily_schedules')
                .select('*');

            if (error) throw error;
            if (!schedules || schedules.length === 0) return;

            for (const schedule of schedules) {
                const scheduleDays = schedule.days.split(',').map(d => d.trim().toUpperCase());
                
                // เช็คเงื่อนไข:
                // 1. วันตรง (หรือเป็น ALL)
                // 2. เวลาปัจจุบัน >= เวลาที่ตั้งไว้
                // 3. ยังไม่ได้รันวันนี้
                const isCorrectDay = scheduleDays.includes(currentDay) || scheduleDays.includes('ALL');
                const isTimeReached = currentTime >= schedule.time;
                const isNotRunToday = schedule.last_run_date !== todayDate;

                if (isCorrectDay && isTimeReached && isNotRunToday) {
                    console.log(`[DailyScheduler] Triggering schedule ID: ${schedule.id} for Set: ${schedule.set_name}`);

                    // 2. สุ่มดึงข้อความจาก Set
                    const { data: setMessages, error: setError } = await supabase
                        .from('daily_sets')
                        .select('*')
                        .eq('guild_id', schedule.guild_id)
                        .eq('set_name', schedule.set_name);

                    if (setError || !setMessages || setMessages.length === 0) {
                        console.error(`[DailyScheduler] Set ${schedule.set_name} not found or empty.`);
                        continue;
                    }

                    const randomItem = setMessages[Math.floor(Math.random() * setMessages.length)];

                    // 3. ส่งข้อความเข้า Discord
                    try {
                        const channel = await client.channels.fetch(schedule.channel_id);
                        if (channel) {
                            const embed = new EmbedBuilder()
                                .setColor('#ffb6c1') // Pink pastel
                                .setDescription(randomItem.message);
                            
                            if (randomItem.title) embed.setTitle(randomItem.title);
                            if (randomItem.image_url) embed.setImage(randomItem.image_url);

                            await channel.send({ embeds: [embed] });

                            // 4. อัปเดต last_run_date เพื่อกันส่งซ้ำ
                            await supabase
                                .from('daily_schedules')
                                .update({ last_run_date: todayDate })
                                .eq('id', schedule.id);
                            
                            console.log(`[DailyScheduler] Sent message and updated last_run_date for ID: ${schedule.id}`);
                        }
                    } catch (sendError) {
                        console.error(`[DailyScheduler] Failed to send message to channel ${schedule.channel_id}:`, sendError.message);
                    }
                }
            }
        } catch (err) {
            console.error('[DailyScheduler] Error:', err);
        }
    });

    console.log('✅ Daily Scheduler initialized (Every 5 minutes)');
}

module.exports = { initDailyScheduler };

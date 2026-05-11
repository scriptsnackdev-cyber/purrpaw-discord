const cron = require('node-cron');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const supabase = require('../supabaseClient');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getFillSettings, getNextQueueItems, setupAndOpenRoom, closeAndCleanup } = require('./botFillManager');

function initDailyScheduler(client) {
    // รันทุก 1 นาที (สำหรับทดสอบ)
    cron.schedule('* * * * *', async () => {
        try {
            // 🧹 ตรวจสอบห้องเสียงเฉพาะกิจเมี๊ยว🐾
            const { cleanupVoiceRooms } = require('./voiceRoomCleanup');
            await cleanupVoiceRooms(client);

            // 🧹 ตรวจสอบห้องส่วนตัวเมี๊ยว🐾
            const { cleanupPrivateRooms, warnPrivateRooms } = require('./privateRoomCleanup');
            await cleanupPrivateRooms(client);
            await warnPrivateRooms(client);

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

    // --- 🤖 ระบบคิวเติมบอทอัตโนมัติ (Tue, Thu, Sat) ---

    // 1. Setup Phase (17:50) - สร้างห้องและ Summon บอท
    cron.schedule('50 17 * * 2,4,6', async () => {
        const guilds = client.guilds.cache;
        for (const [id, guild] of guilds) {
            const settings = await getFillSettings(id);
            if (!settings.enabled) continue;

            const { room1, room2 } = await getNextQueueItems(id);
            if (room1) await setupAndOpenRoom(guild, 1, room1, settings);
            if (room2) await setupAndOpenRoom(guild, 2, room2, settings);
        }
    });

    // 2. Open Phase (18:00) - เปิดสิทธิ์ให้คนทั่วไป
    cron.schedule('0 18 * * 2,4,6', async () => {
        const guilds = client.guilds.cache;
        for (const [id, guild] of guilds) {
            const settings = await getFillSettings(id);
            if (!settings.enabled) continue;

            // ดึงห้องที่กำลังทำงานอยู่
            const { data: activeQueue } = await supabase
                .from('bot_fill_queue')
                .select('*')
                .eq('guild_id', id)
                .eq('is_processed', false)
                .not('active_channel_id', 'is', null);

            if (!activeQueue) continue;

            for (const q of activeQueue) {
                const channel = await guild.channels.fetch(q.active_channel_id).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        ViewChannel: true,
                        SendMessages: true
                    });
                    await channel.send('✨ **สถานีเติมบอทเปิดให้บริการแล้วเมี๊ยวว!** 🎮 พิมพ์คุยกับตัวละครได้เลย🐾');
                }
            }
        }
    });

    // 3. Warning Phase (23:50) - แจ้งเตือนปิดห้อง
    cron.schedule('50 23 * * 2,4,6', async () => {
        const guilds = client.guilds.cache;
        for (const [id, guild] of guilds) {
            const settings = await getFillSettings(id);
            if (!settings.enabled) continue;

            const { data: activeQueue } = await supabase
                .from('bot_fill_queue')
                .select('*')
                .eq('guild_id', id)
                .eq('is_processed', false)
                .not('active_channel_id', 'is', null);

            if (!activeQueue) continue;

            for (const q of activeQueue) {
                const channel = await guild.channels.fetch(q.active_channel_id).catch(() => null);
                if (channel) {
                    await channel.send('⏰ **ประกาศ:** เหลือเวลาอีก 10 นาที สถานีเติมบอทจะปิดให้บริการแล้วนะเมี๊ยว🐾');
                }
            }
        }
    });

    // 4. Soft Close (00:00) - ล็อกการพิมพ์ (ต้องรันวันถัดไปคือ Wed, Fri, Sun)
    cron.schedule('0 0 * * 3,5,0', async () => {
        const guilds = client.guilds.cache;
        for (const [id, guild] of guilds) {
            const settings = await getFillSettings(id);
            if (!settings.enabled) continue;

            const { data: activeQueue } = await supabase
                .from('bot_fill_queue')
                .select('*')
                .eq('guild_id', id)
                .eq('is_processed', false)
                .not('active_channel_id', 'is', null);

            if (!activeQueue) continue;

            for (const q of activeQueue) {
                const channel = await guild.channels.fetch(q.active_channel_id).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false
                    });
                    await channel.send('🚫 **หมดเวลาให้บริการแล้วเมี๊ยว🐾** ตอนนี้ดูข้อความได้อย่างเดียวแล้วนะ! ห้องจะถูกลบในอีก 5 นาทีครับ');
                }
            }
        }
    });

    // 5. Cleanup (00:05) - ลบห้องและเคลียร์ DB (Wed, Fri, Sun)
    cron.schedule('5 0 * * 3,5,0', async () => {
        const guilds = client.guilds.cache;
        for (const [id, guild] of guilds) {
            const settings = await getFillSettings(id);
            if (!settings.enabled) continue;

            const { data: activeQueue } = await supabase
                .from('bot_fill_queue')
                .select('*')
                .eq('guild_id', id)
                .eq('is_processed', false)
                .not('active_channel_id', 'is', null);

            if (!activeQueue) continue;

            for (const q of activeQueue) {
                await closeAndCleanup(guild, q);
            }
        }
    });

    console.log('✅ Daily Scheduler initialized (Including Bot Station Schedule)');
}

module.exports = { initDailyScheduler };

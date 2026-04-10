const { Events } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = oldState.guild || newState.guild;
        const member = oldState.member || newState.member;
        if (!member || member.user.bot) return;

        // --- ⚡ ระบบสะสมเวลาห้องเสียง (Voice Leveling) ---
        if (!guild.client.voiceSessions) guild.client.voiceSessions = new Map();
        const sessionKey = `${guild.id}-${member.id}`;

        // 1. เข้าห้องแชท (หรือย้ายห้องแต่เดิมไม่ได้นับไว้)
        if (!oldState.channelId && newState.channelId) {
            guild.client.voiceSessions.set(sessionKey, Date.now());
        }

        // 2. ออกจากห้องแชท
        else if (oldState.channelId && !newState.channelId) {
            const startTime = guild.client.voiceSessions.get(sessionKey);
            if (startTime) {
                const now = Date.now();
                const sessionSeconds = Math.floor((now - startTime) / 1000);
                guild.client.voiceSessions.delete(sessionKey);

                if (sessionSeconds >= 1) {
                    // await handleVoiceXP(guild, member, sessionSeconds); // ปิดใช้งานชั่วคราวเมี๊ยว🐾
                }
            }
        }

        // ── 🔊 ตรวจสอบบอทออกจากห้องถ้าไม่มีคนเหลืออยู่ ──
        if (oldState.channelId && !newState.channelId) {
            const channel = oldState.channel;
            if (!channel) return;
            const members = channel.members.filter(m => !m.user.bot);
            if (members.size === 0) {
                const ttsManager = guild.client.ttsManager;
                const voice = guild.client.distube.voices.get(guild.id);
                if (voice && voice.channelId === oldState.channelId) {
                    if (ttsManager) {
                        ttsManager.ttsChannels.delete(guild.id);
                        ttsManager.queues.delete(guild.id);
                        ttsManager.processing.delete(guild.id);
                    }
                    await voice.leave();
                }
            }
        }
    }
};

/**
 * 📈 จัดการ XP และ Level สำหรับห้องเสียง
 */
async function handleVoiceXP(guild, member, seconds) {
    const xpMultiplier = 20; // สูตร: Level = sqrt(Minutes / 20) เมี๊ยว🐾🐾
    const secFactor = xpMultiplier * 60; // 1,200 วินาที (~20 นาที) = 1 เลเวล (สำหรับเวล 1)

    // ดึงข้อมูลเดิม
    const { data: currentData } = await supabase
        .from('member_voice_levels')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('user_id', member.id)
        .single();

    const oldTotal = currentData?.total_seconds || 0;
    const newTotal = oldTotal + seconds;
    const oldLevel = Math.floor(Math.sqrt(oldTotal / secFactor));
    const newLevel = Math.floor(Math.sqrt(newTotal / secFactor));

    // บันทึกคะแนน
    await supabase.from('member_voice_levels').upsert({
        guild_id: guild.id,
        user_id: member.id,
        total_seconds: newTotal,
        current_level: newLevel
    });

    // ตรวจสอบเลเวลอัป
    if (newLevel > oldLevel) {
        let newRole;
        // 1. หารางวัลที่แอดมินตั้ง
        const { data: reward } = await supabase.from('voice_level_rewards').select('role_id').eq('guild_id', guild.id).eq('level', newLevel).single();
        if (reward && reward.role_id) {
            newRole = guild.roles.cache.get(reward.role_id);
        }

        // 2. ถ้าไม่มีรางวัล ให้ใช้ชื่อ Sound.LV.XX เมี๊ยว🐾
        if (!newRole) {
            const defaultName = `Sound.LV.${newLevel}`;
            newRole = guild.roles.cache.find(r => r.name === defaultName);
            if (!newRole) {
                try {
                    newRole = await guild.roles.create({
                        name: defaultName,
                        permissions: [],
                        reason: 'Voice Level Role'
                    });
                } catch (e) {}
            }
        }

        // 3. ลบยศเก่า (สไตล์เดียวกับแชท)
        try {
            const { data: allRewards } = await supabase.from('voice_level_rewards').select('role_id').eq('guild_id', guild.id);
            const rewardRoleIds = allRewards ? allRewards.map(r => r.role_id) : [];
            const toRemove = member.roles.cache.filter(role => {
                const isOldLvlString = role.name.startsWith('Sound.LV.') && role.name !== `Sound.LV.${newLevel}`;
                const isOldReward = rewardRoleIds.includes(role.id) && (newRole ? role.id !== newRole.id : true);
                return isOldLvlString || isOldReward;
            });
            if (toRemove.size > 0) await member.roles.remove(toRemove);
        } catch (e) {}

        // 4. มอบยศใหม่
        if (newRole) {
            try {
                await member.roles.add(newRole);
                const channel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.isTextBased());
                if (channel) channel.send(`🎙️ ยินดีด้วยเมี๊ยวว! <@${member.id}> เลเวลห้องเสียงอัปเป็น **${newLevel}** แล้วและได้รับยศ **${newRole.name}** เมี๊ยว🐾🌸!`);
            } catch (e) {}
        }
    }
}

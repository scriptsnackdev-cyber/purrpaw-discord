const supabase = require('../supabaseClient');
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { generateBanCard } = require('./banCard');

/**
 * 🛠️ ตัวจัดการระบบแบนเมี๊ยว🐾
 */

async function banUser(interaction, targetMember, minutes, reason) {
    await interaction.deferReply({ ephemeral: true }); // 🚀 Defer แบบเงียบเพื่อให้คนอื่นไม่เห็นว่าใครสั่งเมี๊ยว🐾

    const guild = interaction.guild;
    const guildId = guild.id;

    try {
        // 1. ตรวจสอบว่าระบบเปิดใช้งานอยู่หรือไม่
        const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
        const settings = guildData?.settings || {};

        if (!settings.ban_system_enabled || !settings.ban_role_id) {
            return interaction.editReply({ content: '❌ ระบบแบนยังไม่ได้เปิดใช้งาน หรือยังไม่ได้ตั้งค่าเมี๊ยว🐾 ใช้ `/ban enable` ก่อนนะ!' });
        }

        const banRoleId = settings.ban_role_id;
        const banRole = guild.roles.cache.get(banRoleId);

        if (!banRole) {
            return interaction.editReply({ content: '❌ ไม่พบยศแบนในเซิร์ฟเวอร์เมี๊ยว🐾 อาจจะถูกลบไปแล้ว ลองปิดแล้วเปิดระบบใหม่นะ!' });
        }

        // 🛡️ 1.5 เช็คว่าคนนี้โดนแบนอยู่แล้วไหมเมี๊ยว🐾
        const { data: existingBan } = await supabase
            .from('guild_bans')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', targetMember.id)
            .eq('is_processed', false)
            .single();

        if (existingBan) {
            return interaction.editReply({
                content: `❌ **ไม่สามารถแบนซ้ำได้:** คุณ <@${targetMember.id}> ติดโทษแบนอยู่แล้วเมี๊ยว🐾\nจะพ้นโทษเมื่อ: <t:${Math.floor(new Date(existingBan.ends_at).getTime() / 1000)}:F>\n(ถ้าต้องการเปลี่ยนเวลา ให้ใช้ /unban แล้วค่อยแบนใหม่นะเมี๊ยว!)`
            });
        }

        // 2. เก็บยศเดิมทั้งหมด (ยกเว้น @everyone)
        const originalRoles = targetMember.roles.cache
            .filter(role => role.name !== '@everyone' && !role.managed)
            .map(role => role.id);

        // 3. คำนวณเวลาสิ้นสุด
        const endsAt = new Date(Date.now() + minutes * 60000).toISOString();

        // 4. ส่ง DM บอกผู้ใช้ (ทำก่อนโดนถอดยศ/แบน เผื่อส่งไม่ได้)
        const dmEmbed = new EmbedBuilder()
            .setTitle('🚫 คุณถูกระงับการใช้งานชั่วคราวเมี๊ยว🐾')
            .setDescription(`คุณถูกแบนในเซิร์ฟเวอร์ **${guild.name}**\n\n**เหตุผล:** ${reason}\n**ระยะเวลา:** ${minutes} นาที\n**จะพ้นโทษเมื่อ:** <t:${Math.floor(new Date(endsAt).getTime() / 1000)}:F>`)
            .setColor('#FF4D4D')
            .setFooter({ text: 'โปรดปฏิบัติตามกฎของเซิร์ฟเวอร์ด้วยนะเมี๊ยว!' });

        await targetMember.send({ embeds: [dmEmbed] }).catch(() => console.log(`[Ban] Could not send DM to ${targetMember.user.tag}`));

        // 5. บันทึกลง Database
        const { error: dbError } = await supabase.from('guild_bans').insert({
            guild_id: guildId,
            user_id: targetMember.id,
            moderator_id: interaction.user.id, // 🛡️ เก็บ ID คนแบนไว้ดู Backdoor เมี๊ยว🐾
            roles: originalRoles,
            ends_at: endsAt,
            reason: reason,
            is_processed: false // 🚩 กำหนดให้ชัดเจนว่ายังไม่พ้นโทษเมี๊ยว🐾
        });

        if (dbError) throw dbError;

        // 6. ถอดยศเดิมออกให้หมด และใส่ยศแบน
        await targetMember.roles.set([banRole], `Banned for ${minutes}m: ${reason}`);

        // 7. ประกาศการลงโทษแบบนิรนาม (ส่งเข้าห้องโดยไม่ระบุชื่อคนแบน) เมี๊ยว🐾
        const banCard = await generateBanCard(targetMember.user, minutes, reason, guild);
        
        await interaction.channel.send({
            content: `📢 **ประกาศการลงโทษเมี๊ยว!**`,
            files: banCard ? [banCard] : []
        });

        // 8. ตอบกลับแอดมินคนสั่งแบนแบบส่วนตัว
        return interaction.editReply({
            content: `✅ แบนคุณ **${targetMember.user.tag}** เรียบร้อยแล้วเมี๊ยว🐾 (คนอื่นจะไม่เห็นว่าคุณเป็นคนแบนนะ!)`,
        });

    } catch (error) {
        console.error('[BanManager] Ban Error:', error);
        return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการแบนเมี๊ยว🐾' });
    }
}

async function cleanupExpiredBans(client) {
    try {
        const now = new Date().toISOString();
        
        // 1. ดึงรายการที่หมดเวลาแล้ว
        const { data: expiredBans, error } = await supabase
            .from('guild_bans')
            .select('*')
            .lt('ends_at', now)
            .eq('is_processed', false);

        if (error || !expiredBans || expiredBans.length === 0) return;

        for (const ban of expiredBans) {
            const guild = client.guilds.cache.get(ban.guild_id);
            if (!guild) continue;

            const member = await guild.members.fetch(ban.user_id).catch(() => null);
            
            // ดึงการตั้งค่าเพื่อหา Ban Role ID
            const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
            const banRoleId = guildData?.settings?.ban_role_id;

            if (member) {
                try {
                    // คืนยศเดิม และเอายศแบนออก
                    const rolesToSet = ban.roles || [];
                    await member.roles.set(rolesToSet, 'Ban expired - Restoring original roles 🐾');
                    
                    // ส่ง DM บอกว่าพ้นโทษแล้วเมี๊ยว🐾
                    const unbanEmbed = new EmbedBuilder()
                        .setTitle('✨ คุณพ้นโทษแบนแล้วเมี๊ยว🐾')
                        .setDescription(`ขณะนี้คุณพ้นโทษแบนในเซิร์ฟเวอร์ **${guild.name}** เรียบร้อยแล้วนะเมี๊ยวว! ยศเดิมของคุณได้รับการคืนให้ครบถ้วนแล้ว🐾\n\nกลับมาพูดคุยและสนุกกับเพื่อนๆ ได้เลยนะ!`)
                        .setColor('#22C55E')
                        .setFooter({ text: 'ยินดีต้อนรับกลับมานะเมี๊ยวว! 🐾🌸' });

                    await member.send({ embeds: [unbanEmbed] }).catch(() => {});
                } catch (err) {
                    console.error(`[BanManager] Failed to restore roles for ${ban.user_id}:`, err.message);
                }
            }

            // อัปเดตสถานะใน DB ว่าประมวลผลแล้ว (หรือจะลบเลยก็ได้เมี๊ยว)
            await supabase.from('guild_bans').update({ is_processed: true }).eq('id', ban.id);
        }
    } catch (err) {
        console.error('[BanManager] Cleanup Error:', err);
    }
}

async function toggleBanSystem(interaction, enable) {
    await interaction.deferReply({ ephemeral: true }); // 🚀 Defer แบบเงียบเพื่อป้องกัน Timeout เมี๊ยว🐾
    
    const guild = interaction.guild;
    const guildId = guild.id;

    if (enable) {
        try {
            // 1. ตรวจสอบ/สร้างยศแบน
            let banRole = guild.roles.cache.find(r => r.name === 'PurrBan' || r.name === 'Banned (PurrPaw)');
            
            if (!banRole) {
                banRole = await guild.roles.create({
                    name: 'Banned (PurrPaw)',
                    color: '#010101',
                    reason: 'PurrPaw Ban System Enable 🐾',
                    permissions: [] 
                });
            }

            // 2. บันทึกลง Settings ใน guilds table
            const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            settings.ban_system_enabled = true;
            settings.ban_role_id = banRole.id;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);

            return interaction.editReply({ content: `✅ **เปิดใช้งานระบบแบนเรียบร้อยแล้วเมี๊ยว!**\nยศแบนคือ: <@&${banRole.id}>\n(คุณสามารถเปลี่ยนชื่อยศหรือสีได้ตามใจชอบเลยเมี๊ยว🐾)` });
        } catch (error) {
            console.error('[BanManager] Enable Error:', error);
            return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการเปิดระบบเมี๊ยว🐾' });
        }
    } else {
        // ปิดระบบ
        try {
            const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            settings.ban_system_enabled = false;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            return interaction.editReply({ content: '✅ ปิดใช้งานระบบแบนเรียบร้อยแล้วเมี๊ยว🐾' });
        } catch (error) {
            console.error('[BanManager] Disable Error:', error);
            return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการปิดระบบเมี๊ยว🐾' });
        }
    }
}

async function unbanUser(interaction, targetMember) {
    await interaction.deferReply({ ephemeral: true }); // 🚀 Defer แบบเงียบเพื่อไม่ให้คนอื่นเห็นเมี๊ยว🐾

    const guild = interaction.guild;
    const guildId = guild.id;

    try {
        // 1. ดึงข้อมูลการแบนล่าสุดที่ยังไม่ถูกประมวลผล
        const { data: banData, error } = await supabase
            .from('guild_bans')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', targetMember.id)
            .eq('is_processed', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !banData) {
            return interaction.editReply({ content: '❌ สมาชิกคนนี้ไม่ได้ถูกแบนโดยระบบ PurrPaw หรือพ้นโทษไปแล้วนะเมี๊ยว🐾' });
        }

        // 2. คืนยศเดิม
        const rolesToSet = banData.roles || [];
        await targetMember.roles.set(rolesToSet, `Manual Unban by ${interaction.user.tag} 🐾`);

        // 3. อัปเดต DB
        await supabase.from('guild_bans').update({ is_processed: true }).eq('id', banData.id);

        // 4. ส่ง DM บอกผู้ใช้
        const unbanEmbed = new EmbedBuilder()
            .setTitle('✨ คุณพ้นโทษแบนแล้วเมี๊ยว🐾')
            .setDescription(`แอดมินได้ปลดแบนให้คุณในเซิร์ฟเวอร์ **${guild.name}** เรียบร้อยแล้วนะเมี๊ยวว! ยศเดิมของคุณได้รับการคืนให้ครบถ้วนแล้ว🐾\n\nกลับมาพูดคุยและสนุกกับเพื่อนๆ ได้เลยนะ!`)
            .setColor('#22C55E')
            .setFooter({ text: 'ยินดีต้อนรับกลับมานะเมี๊ยวว! 🐾🌸' });

        await targetMember.send({ embeds: [unbanEmbed] }).catch(() => {});

        return interaction.editReply({ content: `✅ ปลดแบนให้คุณ <@${targetMember.id}> เรียบร้อยแล้วเมี๊ยวว!🐾` });

    } catch (error) {
        console.error('[BanManager] Unban Error:', error);
        return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการปลดแบนเมี๊ยว🐾' });
    }
}

module.exports = { banUser, cleanupExpiredBans, toggleBanSystem, unbanUser };

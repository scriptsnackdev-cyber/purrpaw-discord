const supabase = require('../supabaseClient');

/**
 * ส่งข้อความผ่าน Webhook เพื่อใช้ Persona (ชื่อและรูป) จากฐานข้อมูล
 */
module.exports = async (channel, content, embeds = [], components = []) => {
    try {
        if (!channel || !channel.fetchWebhooks) return;

        // 1. ดึง Setting จาก Supabase
        const { data: guildData } = await supabase
            .from('guilds')
            .select('settings')
            .eq('id', channel.guildId)
            .single();

        const personaName = guildData?.settings?.bot_name;
        const personaAvatar = guildData?.settings?.bot_avatar;

        // --- 🛡️ FALLBACK: ถ้ายังไม่เคยตั้งค่า บอทจะส่งแบบปกติครับ ---
        if (!personaName && !personaAvatar) {
            return await channel.send({ 
                content: content || undefined, 
                embeds: embeds,
                components: components
            });
        }

        // 2. ค้นหา Webhook เดิม (ชื่อ PurrPaw-Persona) ถ้าไม่มีให้สร้างใหม่
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.name === 'PurrPaw-Persona');

        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'PurrPaw-Persona',
                reason: 'Webhook for dynamic bot personas'
            });
        }

        // 3. ส่งข้อความในนาม Persona
        return await webhook.send({
            content: content || undefined,
            embeds: embeds,
            components: components,
            username: personaName,
            avatarURL: personaAvatar
        });

    } catch (error) {
        console.error('Error sending webhook message:', error);
        // สำรอง: ถ้าส่ง Webhook ไม่ได้ ให้ส่งแบบข้อความบอทปกติ
        if (content || (embeds && embeds.length > 0)) {
            return await channel.send({ content, embeds, components }).catch(() => {});
        }
    }
};

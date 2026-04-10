const supabase = require('../supabaseClient');

/**
 * ส่งข้อความ Now Playing ผ่าน Webhook (ถ้าตั้งค่าไว้) หรือ channel.send
 * คืนค่า { msg, webhook } เพื่อให้ Timer ใช้ editMessage ได้เมี๊ยว🐾
 * 
 * @param {TextChannel} channel
 * @param {EmbedBuilder[]} embeds
 * @param {ActionRowBuilder[]} components
 * @returns {{ msg: Message, webhook: WebhookClient|null }}
 */
module.exports.sendMusicMessage = async (channel, embeds = [], components = []) => {
    try {
        if (!channel?.fetchWebhooks) {
            return { msg: null, webhook: null };
        }

        // 1. ดึงข้อมูล Persona จาก Supabase
        const { data: guildData } = await supabase
            .from('guilds')
            .select('settings')
            .eq('id', channel.guildId)
            .single();

        const personaName = guildData?.settings?.bot_name;
        const personaAvatar = guildData?.settings?.bot_avatar;

        // 2. ถ้าไม่มี Persona → ใช้ channel.send ปกติเมี๊ยว
        if (!personaName && !personaAvatar) {
            const msg = await channel.send({ embeds, components }).catch(() => null);
            return { msg, webhook: null };
        }

        // 3. หา Webhook เดิม (ชื่อ PurrPaw-Music) ถ้าไม่มีให้สร้างใหม่
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.name === 'PurrPaw-Music');

        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'PurrPaw-Music',
                reason: 'Webhook สำหรับระบบเพลงของ PurrPaw🐾',
            });
        }

        // 4. ส่งข้อความผ่าน Webhook
        const msg = await webhook.send({
            embeds,
            components,
            username: personaName,
            avatarURL: personaAvatar,
        });

        return { msg, webhook };

    } catch (error) {
        console.error('[musicWebhook] Send Error:', error.message);
        // Fallback สุดท้าย
        const msg = await channel.send({ embeds, components }).catch(() => null);
        return { msg, webhook: null };
    }
};

/**
 * แก้ไขข้อความ Now Playing (รองรับทั้ง Webhook Message และ Normal Message)
 * @param {{ msg: Message, webhook: WebhookClient|null }} handle
 * @param {EmbedBuilder[]} embeds
 */
module.exports.editMusicMessage = async ({ msg, webhook }, embeds = []) => {
    if (!msg) return;

    try {
        if (webhook) {
            // Webhook Message ต้องใช้ webhook.editMessage()เมี๊ยว🐾
            await webhook.editMessage(msg.id, { embeds });
        } else {
            // ข้อความปกติใช้ msg.edit() ได้เลยเมี๊ยว🐾
            await msg.edit({ embeds });
        }
    } catch (err) {
        // อาจจะหมดอายุหรือถูกลบ ไม่ต้อง throw เมี๊ยว
    }
};

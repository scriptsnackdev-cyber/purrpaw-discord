const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, WebhookClient, EmbedBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('termbot-clean')
        .setDescription('🧹 สั่งทำความสะอาดและลบห้องนี้ทิ้งภายใน 1 นาที (ระเบิดเวลาเมี๊ยว🐾)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { channel, guild, client } = interaction;

        // 1. Defer Reply แบบ Ephemeral
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            // 1. Pre-check: เช็คชื่อห้องก่อนเลยเมี๊ยว🐾
            if (!channel.name.includes('เติมบอท')) {
                return interaction.editReply({ content: '❌ **ยกเลิกคำสั่ง:** คำสั่งนี้ใช้ได้เฉพาะในห้องที่มีคำว่า **"เติมบอท"** ในชื่อเท่านั้นนะเมี๊ยว🐾 (เพื่อความปลอดภัย!)' });
            }

            // 2. เช็คต่อว่ามี AI ประจำการในห้องนี้ไหมเมี๊ยว🐾
            const { data: activeAI } = await supabase
                .from('active_ai_chats')
                .select('character_id')
                .eq('channel_id', channel.id)
                .limit(1);

            if (!activeAI || activeAI.length === 0) {
                return interaction.editReply({ content: '❌ **ยกเลิกคำสั่ง:** ห้องนี้ไม่มี AI ประจำการอยู่ PurrPaw จะไม่ลบห้องที่ไม่มี AI นะเมี๊ยว🐾' });
            }

            // 3. ล็อกห้อง (ห้ามทุกคนพิมพ์)
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: false
            });

            // 3. ทำความสะอาด AI ใน Database (เลียนแบบ /aichat clean)
            await supabase.from('active_ai_chats').delete().eq('channel_id', channel.id);
            if (client.activeChatCache) {
                client.activeChatCache.delete(channel.id);
            }

            // 4. ส่งข้อความผ่าน Webhook ในนาม "PurrPaw"
            // สร้าง Webhook ชั่วคราว
            const webhook = await channel.createWebhook({
                name: 'PurrPaw',
                avatar: client.user.displayAvatarURL(),
            });

            const embed = new EmbedBuilder()
                .setTitle('🧹 การทำความสะอาดเริ่มต้นขึ้นแล้วเมี๊ยว!')
                .setDescription('📍 **ห้องนี้กำลังถูกทำความสะอาดและจะถูกลบทิ้งถาวรภายใน 1 นาที**\n\n🚫 *ทุกคนถูกระงับการส่งข้อความในห้องนี้แล้วเมี๊ยว🐾*')
                .setColor(0xFF0000)
                .setFooter({ text: 'PurrPaw Cleanup System • ระบบทำลายตัวเองทำงาน! 💣' })
                .setTimestamp();

            await webhook.send({
                embeds: [embed],
                content: '⚠️ **ประกาศจากระบบ PurrPaw:** ห้องนี้จะถูกลบภายใน 1 นาทีเมี๊ยว!'
            });

            // ลบ Webhook ทิ้งทันทีหลังส่งเสร็จ
            await webhook.delete().catch(() => {});

            await interaction.editReply({ content: '✅ เริ่มกระบวนการทำความสะอาดแล้วเมี๊ยว! ห้องจะระเบิดภายใน 60 วินาที 💣' });

            // 5. นับถอยหลัง 1 นาทีแล้วลบห้อง
            setTimeout(async () => {
                try {
                    await channel.delete('PurrPaw Termbot Clean');
                } catch (err) {
                    console.error('Failed to delete channel in termbot-clean:', err);
                }
            }, 60000);

        } catch (err) {
            console.error('Error in termbot-clean:', err);
            return interaction.editReply({ content: `❌ เกิดข้อผิดพลาดเมี๊ยว: ${err.message}` });
        }
    }
};

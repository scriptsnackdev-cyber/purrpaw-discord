const { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Invite to My Room')
        .setType(ApplicationCommandType.User),

    async execute(interaction) {
        const targetUser = interaction.targetUser;
        const ownerId = interaction.user.id;

        // 🔍 หาห้องส่วนตัวของเจ้าของ (Interaction User) เมี๊ยว🐾
        const { data: room, error } = await supabase
            .from('private_rooms')
            .select('*')
            .eq('owner_id', ownerId)
            .eq('is_deleted', false)
            .single();

        if (error || !room) {
            return interaction.reply({ content: '❌ คุณยังไม่มีห้องส่วนตัวที่เปิดอยู่ตอนนี้เมี๊ยว! กรุณาเปิดห้องก่อนนะ🐾', ephemeral: true });
        }

        // ลองดึง Channel เมี๊ยว🐾
        const channel = interaction.guild.channels.cache.get(room.channel_id) || await interaction.guild.channels.fetch(room.channel_id).catch(() => null);
        
        if (!channel) {
            return interaction.reply({ content: '❌ หาห้องส่วนตัวของคุณไม่เจอเมี๊ยว! (อาจจะถูกลบไปแล้วหรือบอทหาไม่เจอ🐾)', ephemeral: true });
        }

        if (targetUser.id === ownerId) {
            return interaction.reply({ content: '❌ คุณจะชวนตัวเองทำไมเมี๊ยวว!🐾', ephemeral: true });
        }

        if (targetUser.bot) {
            return interaction.reply({ content: '❌ ชวนบอทเข้าห้องไม่ได้นะเมี๊ยวว!🐾', ephemeral: true });
        }

        try {
            await channel.permissionOverwrites.edit(targetUser.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            // ตอบกลับแบบ Ephemeral เพื่อความส่วนตัวเมี๊ยว🐾
            return interaction.reply({ 
                content: `✅ ชวนคุณ <@${targetUser.id}> เข้าห้อง <#${channel.id}> เรียบร้อยแล้วเมี๊ยวว! 🎉🐾`,
                ephemeral: true 
            });
        } catch (err) {
            console.error('Context menu invite error:', err);
            return interaction.reply({ content: 'งื้อออ เกิดข้อผิดพลาดในการชวนเพื่อนเมี๊ยว! (บอทอาจจะไม่มีสิทธิ์จัดการห้องนะ🐾)', ephemeral: true });
        }
    }
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leveling')
        .setDescription('🏆 จัดการระบบสะสมคะแนนเลเวล (แชท & เสียง)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('enable').setDescription('🐾 เปิดใช้งานระบบเลเวลเมี๊ยว'))
        .addSubcommand(subcommand => subcommand.setName('disable').setDescription('🚫 ปิดใช้งานระบบเลเวลเมี๊ยว'))
        .addSubcommand(subcommand => 
            subcommand.setName('setup')
                .setDescription('💬 ตั้งค่ารางวัลยศเลเวลแชทเมี๊ยว')
                .addIntegerOption(option => option.setName('level').setDescription('เลเวลแชทที่ต้องการกำหนดรางวัล').setRequired(true))
                .addStringOption(option => option.setName('role').setDescription('Role ID หรือชื่อยศ (ถ้าไม่มีจะสร้างให้เมี๊ยว)').setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName('setup-voice')
                .setDescription('🎙️ ตั้งค่ารางวัลยศเลเวลห้องเสียงเมี๊ยว')
                .addIntegerOption(option => option.setName('level').setDescription('เลเวลห้องเสียงที่ต้องการกำหนดรางวัล').setRequired(true))
                .addStringOption(option => option.setName('role').setDescription('Role ID หรือชื่อยศ (ถ้าไม่มีจะสร้างแบบ Sound.LV.XX ให้เมี๊ยว)').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('list').setDescription('📋 ดูตารางรางวัลทั้งหมดเมี๊ยว')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // ดึงสถานะ Feature
        let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
        const features = guildData?.features || { leveling: true };

        if (subcommand === 'enable' || subcommand === 'disable') {
            const enabled = (subcommand === 'enable');
            features.leveling = enabled;
            await supabase.from('guilds').update({ features }).eq('id', guildId);
            return interaction.reply({ content: `ระบบสะสมคะแนนเลเวลถูก **${enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}** แล้วนะเมี๊ยว! 🐾`, ephemeral: true });
        }

        if (subcommand === 'setup' || subcommand === 'setup-voice') {
            await interaction.deferReply({ ephemeral: true });
            const level = interaction.options.getInteger('level');
            const roleInput = interaction.options.getString('role');
            const isVoice = subcommand === 'setup-voice';

            // Find or Create Role Logic
            let role = interaction.guild.roles.cache.get(roleInput);
            if (!role) role = interaction.guild.roles.cache.find(r => r.name === roleInput);
            if (!role) {
                try {
                    role = await interaction.guild.roles.create({
                        name: roleInput,
                        permissions: [],
                        reason: `PurrPaw ${isVoice ? 'Voice' : 'Chat'} Level ${level} reward`
                    });
                } catch (e) {
                    return interaction.editReply({ content: 'งื้อออ บอทสร้างยศใหม่ไม่สำเร็จเมี๊ยว🐾' });
                }
            }

            // Save to DB
            const tableName = isVoice ? 'voice_level_rewards' : 'level_rewards';
            const { error } = await supabase.from(tableName).upsert({
                guild_id: guildId,
                level: level,
                role_id: role.id
            });

            if (error) return interaction.editReply({ content: 'เก็บข้อมูลลงฐานข้อมูลไม่สำเร็จเมี๊ยว🐾' });

            return interaction.editReply({ content: `✅ ตั้งค่ารางวัลเลเวล **${isVoice ? 'เสียง' : 'แชท'} ${level}** เป็นยศ **${role.name}** เรียบร้อยเมี๊ยว🐾` });
        }

        if (subcommand === 'list') {
            const [chatRewards, voiceRewards] = await Promise.all([
                supabase.from('level_rewards').select('*').eq('guild_id', guildId).order('level', { ascending: true }),
                supabase.from('voice_level_rewards').select('*').eq('guild_id', guildId).order('level', { ascending: true })
            ]);

            const embed = new EmbedBuilder().setTitle('📋 ตารางรางวัลเลเวลทั้งหมดเมี๊ยว🐾').setColor('#FFB6C1');
            
            const chatList = chatRewards.data?.map(r => `• LV. **${r.level}**: <@&${r.role_id}>`).join('\n') || 'ยังไม่มีการตั้งค่า';
            const voiceList = voiceRewards.data?.map(r => `• LV. **${r.level}**: <@&${r.role_id}>`).join('\n') || 'ยังไม่มีการตั้งค่า';

            embed.addFields(
                { name: '💬 เลเวลการแชท', value: chatList, inline: true },
                { name: '🎙️ เลเวลห้องพูดคุย', value: voiceList, inline: true }
            );

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

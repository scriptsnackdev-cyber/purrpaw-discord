const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');
const { generateRPGImage } = require('../../utils/rpgImage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rpg')
        .setDescription('⚔️ เริ่มต้นการผจญภัยสวมบทบาท (RPG) กับเพื่อนๆ เมี๊ยว🐾')
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('🎮 สร้างห้องล็อบบี้สำหรับการผจญภัยใหม่')
                .addStringOption(opt => opt.setName('theme').setDescription('ธีมของการผจญภัย (เช่น Fantasy, Sci-Fi, Horror)').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('join')
                .setDescription('🤝 เข้าร่วมการผจญภัยที่กำลังเปิดรับสมัคร'))
        .addSubcommand(sub =>
            sub.setName('begin')
                .setDescription('🚀 เริ่มต้นการเดินทาง (เฉพาะหัวหน้าปาร์ตี้)'))
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('⏹️ จบการผจญภัยในห้องนี้ (เฉพาะหัวหน้าปาร์ตี้)')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;

        await interaction.deferReply();

        if (sub === 'start') {
            const theme = interaction.options.getString('theme');

            const { data: existing } = await supabase
                .from('rpg_sessions')
                .select('id')
                .eq('channel_id', channelId)
                .neq('status', 'ended')
                .single();

            if (existing) {
                return interaction.editReply('❌ มีการผจญภัยที่กำลังดำเนินอยู่ในห้องนี้แล้วนะเมี๊ยว!');
            }

            const { data: session, error } = await supabase
                .from('rpg_sessions')
                .insert({
                    guild_id: guildId,
                    channel_id: channelId,
                    creator_id: userId,
                    theme: theme,
                    status: 'lobby',
                    players: [{ id: userId, name: interaction.user.displayName || interaction.user.username, class: 'Adventurer' }]
                })
                .select()
                .single();

            if (error) {
                console.error('RPG Start Error:', error);
                return interaction.editReply('❌ เกิดข้อผิดพลาดในการสร้างห้องเมี๊ยว...');
            }

            const attachment = await generateRPGImage(session.players, interaction);

            const embed = new EmbedBuilder()
                .setTitle(`🏰 เริ่มต้นการผจญภัยบทใหม่: ${theme}`)
                .setDescription(`กดปุ่มด้านล่างเพื่อเข้าร่วมปาร์ตี้นะเมี๊ยว!\nเมื่อสมาชิกครบแล้ว ให้หัวหน้าปาร์ตี้กดปุ่ม **เริ่มการผจญภัย**`)
                .setImage('attachment://lobby.png')
                .setColor(0x8B5CF6)
                .setFooter({ text: 'ขอให้โชคดีในการเดินทางนะเมี๊ยว🐾' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rpg_join:${session.id}`)
                    .setLabel('เข้าร่วมปาร์ตี้')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🤝'),
                new ButtonBuilder()
                    .setCustomId(`rpg_begin:${session.id}`)
                    .setLabel('เริ่มการผจญภัย')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🚀')
            );

            return interaction.editReply({ embeds: [embed], components: [row], files: attachment ? [attachment] : [] });
        }

        if (sub === 'join') {
            const { data: session } = await supabase
                .from('rpg_sessions')
                .select('*')
                .eq('channel_id', channelId)
                .eq('status', 'lobby')
                .single();

            if (!session) return interaction.editReply('❌ ตอนนี้ไม่มีล็อบบี้ที่เปิดรับสมัครในห้องนี้เมี๊ยว');

            const players = session.players || [];
            if (players.length >= 8) return interaction.editReply('❌ ปาร์ตี้นี้เต็มแล้วนะเมี๊ยว! (รับได้สูงสุด 8 ท่าน)');
            if (players.find(p => p.id === userId)) return interaction.editReply('❌ คุณอยู่ในปาร์ตี้อยู่แล้วนะเมี๊ยว!');

            players.push({ id: userId, name: interaction.user.displayName || interaction.user.username, class: 'Adventurer' });
            await supabase.from('rpg_sessions').update({ players }).eq('id', session.id);

            return interaction.editReply(`✅ <@${userId}> เข้าร่วมปาร์ตี้เรียบร้อยแล้ว! เตรียมตัวให้พร้อมนะเมี๊ยว🐾`);
        }

        if (sub === 'begin') {
            const { startRPGGame } = require('../../utils/rpgManager');
            return await startRPGGame(interaction, channelId, userId);
        }

        if (sub === 'stop') {
            const { data: session } = await supabase
                .from('rpg_sessions')
                .select('*')
                .eq('channel_id', channelId)
                .neq('status', 'ended')
                .single();

            if (!session) return interaction.editReply('❌ ไม่มีเซสชันที่เล่นอยู่ในห้องนี้เมี๊ยว');
            if (session.creator_id !== userId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply('❌ เฉพาะหัวหน้าหรือแอดมินเท่านั้นที่สั่งจบเกมได้เมี๊ยว!');
            }

            await supabase.from('rpg_sessions').update({ status: 'ended' }).eq('id', session.id);
            return interaction.editReply('⏹️ จบการผจญภัยเรียบร้อยแล้วเมี๊ยว! ขอบคุณผู้กล้าทุกคนนะ🐾✨');
        }
    }
};

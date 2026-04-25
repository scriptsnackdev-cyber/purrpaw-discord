const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('🎫 ระบบเปิด Ticket สำหรับแจ้งเรื่องเมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('create')
                .setDescription('✨ สร้างปุ่มสำหรับเปิด Ticket ใหม่เมี๊ยว')
                .addStringOption(o => o.setName('title').setDescription('หัวข้อของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('message').setDescription('เนื้อหาของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('button_title').setDescription('ข้อความบนปุ่มเมี๊ยว').setRequired(true))
                .addChannelOption(o => o.setName('pending_channel').setDescription('ห้องสำหรับ Ticket ที่รอดำเนินการ (Pending)').setRequired(true).addChannelTypes(ChannelType.GuildText))
                .addChannelOption(o => o.setName('reject_channel').setDescription('ห้องสำหรับ Ticket ที่ถูกปฏิเสธ (Reject)').setRequired(true).addChannelTypes(ChannelType.GuildText))
                .addChannelOption(o => o.setName('approve_channel').setDescription('ห้องสำหรับ Ticket ที่อนุมัติ/เสร็จสิ้น (Approve)').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('📋 ดูรายการ Ticket ตามสถานะเมี๊ยว')
                .addStringOption(o => o.setName('status')
                    .setDescription('เลือกสถานะที่ต้องการดูเมี๊ยว')
                    .setRequired(true)
                    .addChoices(
                        { name: '🟡 Pending (รอดำเนินการ)', value: 'Pending' },
                        { name: '🔵 Acknowledge (รับทราบแล้ว)', value: 'Acknowledge' },
                        { name: '🔴 Reject (ปฏิเสธ)', value: 'Reject' },
                        { name: '🟢 Done (เสร็จสิ้น)', value: 'Done' }
                    )))
        .addSubcommand(sub =>
            sub.setName('all-clean')
                .setDescription('⚠️ ล้างข้อมูล Ticket ทั้งหมดในเซิร์ฟเวอร์ (รวมถึงลบข้อความในห้องแอดมินด้วยเมี๊ยว)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'create') {
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const buttonTitle = interaction.options.getString('button_title');
            const pendingCh = interaction.options.getChannel('pending_channel');
            const rejectCh = interaction.options.getChannel('reject_channel');
            const approveCh = interaction.options.getChannel('approve_channel');

            const embed = new EmbedBuilder()
                .setTitle(`🎫 ${title}`)
                .setDescription(message.replace(/\\n/g, '\n'))
                .setColor('#FFB6C1')
                .setFooter({ text: 'PurrPaw Ticket System 🐾' });

            // เก็บ ID ทั้ง 3 ห้องไว้ใน customId (คั่นด้วย |)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_open:${pendingCh.id}:${rejectCh.id}:${approveCh.id}`)
                    .setLabel(buttonTitle)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📩')
            );

            await interaction.reply({ content: `✅ สร้างระบบ Ticket เรียบร้อย!\n🟡 **Pending:** ${pendingCh}\n🔴 **Reject:** ${rejectCh}\n🟢 **Approve:** ${approveCh}\nเมี๊ยวว!`, ephemeral: true });
            return await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (subcommand === 'list') {
            await interaction.deferReply({ ephemeral: true });
            const status = interaction.options.getString('status');

            const { data: tickets, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('guild_id', guildId)
                .eq('status', status)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching tickets:', error);
                return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลเมี๊ยว!' });
            }

            if (!tickets || tickets.length === 0) {
                return interaction.editReply({ content: `📭 ไม่พบ Ticket ที่มีสถานะ **${status}** ในเซิร์ฟเวอร์นี้เลยเมี๊ยว!` });
            }

            const statusEmoji = {
                'Pending': '🟡',
                'Acknowledge': '🔵',
                'Reject': '🔴',
                'Done': '🟢'
            };

            const embed = new EmbedBuilder()
                .setTitle(`${statusEmoji[status]} รายการ Ticket สถานะ: ${status}`)
                .setColor(status === 'Done' ? 0x22C55E : (status === 'Reject' ? 0xEF4444 : (status === 'Acknowledge' ? 0x3B82F6 : 0xFAB005)))
                .setDescription(tickets.map((t, i) => 
                    `**${i + 1}. ${t.title}**\n` +
                    `👤 โดย: <@${t.user_id}> | 📅 <t:${Math.floor(new Date(t.created_at).getTime() / 1000)}:R>\n` +
                    `🔗 [ดูข้อความในห้องแอดมิน](https://discord.com/channels/${guildId}/${t.admin_channel_id}/${t.admin_message_id})`
                ).join('\n\n'))
                .setFooter({ text: `แสดงรายการล่าสุด 20 รายการเมี๊ยว 🐾` });

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'all-clean') {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ ยืนยันการล้างข้อมูล Ticket ทั้งหมด')
                .setDescription('การดำเนินการนี้จะ **ลบข้อมูล Ticket ทั้งหมด** ของเซิร์ฟเวอร์นี้ออกจากฐานข้อมูล และพยายาม **ลบข้อความ Ticket** ในห้องแอดมินทั้ง 3 ห้องด้วยนะเมี๊ยว!\n\nคุณแน่ใจใช่ไหมเมี๊ยว?')
                .setColor(0xEF4444);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_clean_confirm')
                    .setLabel('ใช่, ลบทั้งหมดเลยเมี๊ยว')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_clean_cancel')
                    .setLabel('ยกเลิก')
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    }
};

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, MessageFlags } = require('discord.js');
const supabase = require('../../supabaseClient');
const { getFillSettings, getNextQueueItems, setupAndOpenRoom, closeAndCleanup } = require('../../utils/botFillManager');
const dayjs = require('dayjs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botqueue')
        .setDescription('🤖 จัดการระบบคิวเติมบอทอัตโนมัติเมี๊ยว🐾')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcommand: Enable
        .addSubcommand(sub => sub.setName('enable').setDescription('✅ เปิดใช้งานระบบคิวเติมบอทอัตโนมัติ'))
        
        // Subcommand: Disable
        .addSubcommand(sub => sub.setName('disable').setDescription('❌ ปิดใช้งานระบบคิวเติมบอทอัตโนมัติ'))

        // Subcommand: Config
        .addSubcommand(sub => 
            sub.setName('config')
                .setDescription('⚙️ ตั้งค่าระบบคิวเติมบอท')
                .addChannelOption(opt => opt.setName('category').setDescription('เลือก Category ที่จะสร้างห้อง').addChannelTypes(ChannelType.GuildCategory))
        )

        // Subcommand: Add Queue
        .addSubcommand(sub => 
            sub.setName('add')
                .setDescription('➕ เพิ่มคิวเติมบอท (ต่อท้ายลิสต์)')
                .addIntegerOption(opt => opt.setName('room').setDescription('เลือกห้อง (1 หรือ 2)').setRequired(true).addChoices({ name: 'ห้องที่ 1', value: 1 }, { name: 'ห้องที่ 2', value: 2 }))
                .addStringOption(opt => opt.setName('char1').setDescription('เลือกตัวละครที่ 1 (ชื่อหรือ ID)').setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName('char2').setDescription('เลือกตัวละครที่ 2 (ชื่อหรือ ID)').setAutocomplete(true))
                .addStringOption(opt => opt.setName('char3').setDescription('เลือกตัวละครที่ 3 (ชื่อหรือ ID)').setAutocomplete(true))
        )

        // Subcommand: List
        .addSubcommand(sub => sub.setName('list').setDescription('📋 ดูตารางคิวและวันที่จะรันในอนาคต'))

        // Subcommand: Manual Open
        .addSubcommand(sub => sub.setName('manual-open').setDescription('🚀 สั่งเปิดห้องเติมบอททันที (จากคิวล่าสุด)'))

        // Subcommand: Manual Close
        .addSubcommand(sub => sub.setName('manual-close').setDescription('🧹 สั่งปิดและลบห้องเติมบอททันที')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // Defer ถูกจัดการโดย interactionCreate.js แล้วเมี๊ยว🐾
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }

        // --- Logic: Enable / Disable ---
        if (sub === 'enable' || sub === 'disable') {
            const enabled = sub === 'enable';
            const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (!settings.bot_fill) settings.bot_fill = {};
            settings.bot_fill.enabled = enabled;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            return interaction.editReply({ content: `${enabled ? '✅ **เปิด**' : '❌ **ปิด**'} ใช้งานระบบคิวเติมบอทเรียบร้อยแล้วเมี๊ยว🐾` });
        }

        // --- Logic: Config ---
        if (sub === 'config') {
            const category = interaction.options.getChannel('category');

            const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            if (!settings.bot_fill) settings.bot_fill = {};

            if (category) settings.bot_fill.category_id = category.id;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            return interaction.editReply({ content: '⚙️ บันทึกการตั้งค่าระบบคิวเติมบอทเรียบร้อยแล้วเมี๊ยว🐾\n(ใช้รูปพื้นหลังจาก Assets และอ้างอิงสิทธิ์ Admin/Mod จากระบบหลักโดยอัตโนมัติ)' });
        }

        // --- Logic: Add ---
        if (sub === 'add') {
            const room = interaction.options.getInteger('room');
            const chars = [
                interaction.options.getString('char1'),
                interaction.options.getString('char2'),
                interaction.options.getString('char3')
            ].filter(Boolean);

            // เช็คว่า ID ตัวละครมีอยู่จริงเมี๊ยว🐾
            const { data: validChars } = await supabase.from('ai_characters')
                .select('id, name')
                .in('id', chars)
                .or(`name.in.(${chars.map(c => `"${c}"`).join(',')})`);

            if (!validChars || validChars.length === 0) {
                return interaction.editReply({ content: '❌ หาตัวละครที่ระบุไม่เจอเลยเมี๊ยว🐾 กรุณาใช้ระบบ Autocomplete นะ!' });
            }

            const charIds = validChars.map(c => c.id).join(',');
            const charNames = validChars.map(c => c.name).join(', ');

            await supabase.from('bot_fill_queue').insert({
                guild_id: guildId,
                room_number: room,
                character_ids: charIds
            });

            return interaction.editReply({ content: `➕ เพิ่มคิวใน **ห้องที่ ${room}** เรียบร้อยแล้วเมี๊ยว🐾\n**ตัวละคร:** ${charNames}` });
        }

        // --- Logic: List ---
        if (sub === 'list') {
            const { data: queue } = await supabase
                .from('bot_fill_queue')
                .select('*')
                .eq('guild_id', guildId)
                .eq('is_processed', false)
                .order('created_at', { ascending: true });

            if (!queue || queue.length === 0) {
                return interaction.editReply({ content: '📋 ตอนนี้ยังไม่มีคิวเติมบอทในรายการเลยเมี๊ยว🐾' });
            }

            // คำนวณวันที่รันคิว (Tue, Thu, Sat)
            const getNextSessions = (count) => {
                const sessions = [];
                let current = dayjs().startOf('day');
                while (sessions.length < count) {
                    const day = current.day(); // 0=Sun, 1=Mon, 2=Tue...
                    if ([2, 4, 6].includes(day)) {
                        sessions.push(current.format('ddd DD/MM/YYYY'));
                    }
                    current = current.add(1, 'day');
                }
                return sessions;
            };

            const room1Queue = queue.filter(q => q.room_number === 1);
            const room2Queue = queue.filter(q => q.room_number === 2);
            const maxCount = Math.max(room1Queue.length, room2Queue.length);
            const sessions = getNextSessions(maxCount);

            const embed = new EmbedBuilder()
                .setTitle('📋 ตารางคิวเติมบอทอัตโนมัติเมี๊ยว🐾')
                .setColor(0xFFB6C1)
                .setFooter({ text: 'รันทุกวันอังคาร พฤหัส และเสาร์ เวลา 18:00 - 00:00' });

            let listContent = '';
            for (let i = 0; i < maxCount; i++) {
                const dateStr = sessions[i];
                const r1 = room1Queue[i] ? '✅ มีคิว' : '➖ ว่าง';
                const r2 = room2Queue[i] ? '✅ มีคิว' : '➖ ว่าง';
                listContent += `📅 **${dateStr}**\n   ห้อง 1: ${r1} | ห้อง 2: ${r2}\n\n`;
            }

            embed.setDescription(listContent || 'ไม่มีรายการคิว');
            return interaction.editReply({ embeds: [embed] });
        }

        // --- Logic: Manual Open ---
        if (sub === 'manual-open') {
            const settings = await getFillSettings(guildId);
            const { room1, room2 } = await getNextQueueItems(guildId);

            if (!room1 && !room2) {
                return interaction.editReply({ content: '❌ ไม่มีคิวรอรันอยู่ในระบบเมี๊ยว🐾' });
            }

            if (room1) await setupAndOpenRoom(interaction.guild, 1, room1, settings, true);
            if (room2) await setupAndOpenRoom(interaction.guild, 2, room2, settings, true);

            return interaction.editReply({ content: '🚀 สั่งเปิดห้องเติมบอทด้วยระบบ Manual เรียบร้อยแล้วเมี๊ยว🐾 (ไม่มีการประกาศ)' });
        }

        // --- Logic: Manual Close ---
        if (sub === 'manual-close') {
            const { data: activeQueue } = await supabase
                .from('bot_fill_queue')
                .select('*')
                .eq('guild_id', guildId)
                .eq('is_processed', false)
                .not('active_channel_id', 'is', null);

            if (!activeQueue || activeQueue.length === 0) {
                return interaction.editReply({ content: '❌ ไม่พบห้องเติมบอทที่กำลังรันอยู่ในขณะนี้เมี๊ยว🐾' });
            }

            for (const q of activeQueue) {
                await closeAndCleanup(interaction.guild, q);
            }

            return interaction.editReply({ content: '🧹 สั่งปิดและลบห้องเติมบอทด้วยระบบ Manual เรียบร้อยแล้วเมี๊ยว🐾' });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const guildId = interaction.guildId;

        const { data: chars } = await supabase.from('ai_characters')
            .select('id, name')
            .eq('guild_id', guildId)
            .ilike('name', `%${focusedValue}%`)
            .limit(25);

        if (chars) {
            await interaction.respond(chars.map(c => ({ name: c.name, value: c.id })));
        }
    }
};

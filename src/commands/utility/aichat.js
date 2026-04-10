const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aichat')
        .setDescription('🤖 จัดการตัวละคร AI และการตั้งค่าแชทเมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('create')
                .setDescription('✨ สร้างตัวละคร AI ใหม่เมี๊ยว')
                .addStringOption(o => o.setName('name').setDescription('ชื่อของ AI เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('persona').setDescription('นิสัยหรือบทบาทของ AI เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('image_url').setDescription('ลิงก์รูปโปรไฟล์ของ AI เมี๊ยว'))
                .addBooleanOption(o => o.setName('public').setDescription('อนุญาตให้เซิร์ฟเวอร์อื่นใช้ตัวละครนี้ไหมเมี๊ยว?')))
        .addSubcommand(sub => 
            sub.setName('summon')
                .setDescription('🕯️ อัญเชิญ AI มาที่ห้องแชทนี้เมี๊ยว')
                .addStringOption(o => o.setName('name_or_id').setDescription('ชื่อหรือไอดีของ AI เมี๊ยว').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => 
            sub.setName('list').setDescription('📋 ดูรายชื่อ AI ที่กำลังสแตนบายในห้องนี้เมี๊ยว'))
        .addSubcommand(sub => 
            sub.setName('my-char').setDescription('🗂️ รายชื่อตัวละคร AI ทั้งหมดที่สร้างในเซิร์ฟเวอร์นี้เมี๊ยว'))
        .addSubcommand(sub => 
            sub.setName('clean')
                .setDescription('🧹 ไล่ AI ทั้งหมดออกไปจากพื้นที่เมี๊ยว')
                .addStringOption(o => 
                    o.setName('target')
                        .setDescription('เลือกพื้นที่ที่จะทำความสะอาดเมี๊ยว')
                        .setRequired(true)
                        .addChoices({ name: '📍 ห้องนี้ (ที่นี่เมี๊ยว)', value: 'here' })))
        .addSubcommand(sub => 
            sub.setName('leave')
                .setDescription('👋 ส่ง AI บางตัวกลับบ้านไปก่อนเมี๊ยว')
                .addStringOption(o => o.setName('name_or_id').setDescription('ชื่อหรือไอดีของ AI เมี๊ยว').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => 
            sub.setName('settings')
                .setDescription('⚙️ ปรับแต่งความจำ/จำนวนข้อความที่ AI จำได้เมี๊ยว')
                .addIntegerOption(o => o.setName('memory').setDescription('จำนวนข้อความล่าสุดที่จะจำ (N ข้อความ)เมี๊ยว').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('set-introduction')
                .setDescription('📚 ตั้งค่าห้องแนะนำตัวให้ AI ไปแอบศึกษาเมี๊ยว')
                .addChannelOption(o => o.setName('channel').setDescription('ห้องแนะนำตัวเมี๊ยว').addChannelTypes(ChannelType.GuildText).setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;

        // ⭐ Defer reply เพื่อป้องกัน Timeout เมี๊ยว🐾
        await interaction.deferReply({ flags: 64 });

        // 1. Create Persona
        if (sub === 'create') {
            const name = interaction.options.getString('name');
            const persona = interaction.options.getString('persona');
            const image = interaction.options.getString('image_url');
            const isPublic = interaction.options.getBoolean('public') || false;

            const { data, error } = await supabase.from('ai_characters').insert({
                guild_id: guildId, name, persona, image_url: image, is_public: isPublic
            }).select().single();

            if (error) return interaction.editReply({ content: '❌ ฮืออ สร้างตัวละคร AI ไม่สำเร็จเมี๊ยว...' });
            
            const embed = new EmbedBuilder()
                .setTitle(`✅ สร้าง AI สำเร็จแล้วเมี๊ยว: ${name}`)
                .setDescription(`**ID:** \`${data.id}\`\n**นิสัย:** ${persona}`)
                .setThumbnail(image || null)
                .setColor(0x22C55E);
            
            return interaction.editReply({ embeds: [embed] });
        }

        // 2. Summon to Channel (Multiple AI support)
        if (sub === 'summon') {
            const search = interaction.options.getString('name_or_id');
            const { data: char, error } = await supabase.from('ai_characters')
                .select('*')
                .or(`id.eq.${search},name.ilike.${search}`)
                .eq('guild_id', guildId)
                .single();

            if (error || !char) return interaction.editReply({ content: '❌ หาตัวละคร AI ตัวนั้นไม่เจอเลยเมี๊ยว...' });

            await supabase.from('active_ai_chats').upsert({
                channel_id: channelId,
                guild_id: guildId,
                character_id: char.id
            });

            return interaction.editReply({ content: `✅ **${char.name}** ถูกอัญเชิญมาแล้วเมี๊ยว! 🕯️ พร้อมรับใช้แล้วนะ!` });
        }

        // 3. LIST: List AIs in channel
        if (sub === 'list') {
            const { data: activeList } = await supabase
                .from('active_ai_chats')
                .select('character_id, ai_characters(name, persona)')
                .eq('channel_id', channelId);

            if (!activeList || activeList.length === 0) return interaction.editReply({ content: '❌ ตอนนี้ไม่มี AI ตัวไหนอยู่ในห้องนี้เลยเมี๊ยว' });

            const list = activeList.map(a => `• **${a.ai_characters.name}** (\`${a.character_id}\`)\n  - ${a.ai_characters.persona}`).join('\n\n');
            const embed = new EmbedBuilder().setTitle('🤖 AI ที่กำลังแสตนบายในห้องนี้เมี๊ยว').setDescription(list).setColor(0x3B82F6);
            return interaction.editReply({ embeds: [embed] });
        }

        // 4. MY-CHAR: List all created in server
        if (sub === 'my-char') {
            const { data: allChars } = await supabase.from('ai_characters').select('*').eq('guild_id', guildId);
            if (!allChars || allChars.length === 0) return interaction.editReply({ content: '❌ ยังไม่มีใครสร้างตัวละคร AI ในเซิร์ฟนี้เลยเมี๊ยว...' });

            const list = allChars.map(c => `• **${c.name}** (\`${c.id}\`)\n  - สาธารณะ: ${c.is_public ? '✅' : '❌'}`).join('\n\n');
            const embed = new EmbedBuilder().setTitle('📋 รายชื่อตัวละคร AI ในเซิร์ฟเวอร์เมี๊ยว').setDescription(list).setColor(0x8B5CF6);
            return interaction.editReply({ embeds: [embed] });
        }

        // 5. CLEAN: Bulk remove
        if (sub === 'clean') {
            const target = interaction.options.getString('target');
            if (target === 'here') {
                await supabase.from('active_ai_chats').delete().eq('channel_id', channelId);
                return interaction.editReply({ content: '🧹 ไล่ AI ทุกตัวออกจากห้องนี้เรียบร้อยแล้วเมี๊ยว! สะอาดกริ๊บ!' });
            }
        }

        // 6. LEAVE: Remove specific
        if (sub === 'leave') {
            const search = interaction.options.getString('name_or_id');
            const { data: char } = await supabase.from('ai_characters')
                .select('id')
                .or(`id.eq.${search},name.ilike.${search}`)
                .eq('guild_id', guildId)
                .single();

            if (!char) return interaction.editReply({ content: 'หา AI ตัวนั้นไม่เจอเมี๊ยว...' });

            const { error } = await supabase.from('active_ai_chats').delete().eq('channel_id', channelId).eq('character_id', char.id);
            if (error) return interaction.editReply({ content: 'AI ตัวนี้ไม่ได้อยู่ในห้องนี้อยู่แล้วนะเมี๊ยว' });

            return interaction.editReply({ content: `👋 **${search}** ลากลับบ้านไปพักผ่อนแล้วนะเมี๊ยวว` });
        }

        // 7. Memory Settings
        if (sub === 'settings') {
            const memory = interaction.options.getInteger('memory');
            await supabase.from('active_ai_chats').update({ memory_limit: memory }).eq('channel_id', channelId);
            return interaction.editReply({ content: `✅ ตั้งความจำไว้ที่ **${memory}** ข้อความสำหรับห้องนี้แล้วนะเมี๊ยว!` });
        }

        // 8. Intro Channel Settings
        if (sub === 'set-introduction') {
            const channel = interaction.options.getChannel('channel');
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (!settings.ai_chat) settings.ai_chat = {};
            settings.ai_chat.intro_channel_id = channel.id;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            return interaction.editReply({ content: `✅ AI จะเริ่มไปแอบอ่านข้อมูลแนะนำตัวจากห้อง ${channel} แล้วนะเมี๊ยวว! 📚` });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const guildId = interaction.guild.id;

        const { data: chars } = await supabase
            .from('ai_characters')
            .select('id, name')
            .eq('guild_id', guildId)
            .ilike('name', `%${focusedValue}%`)
            .limit(25);

        if (!chars) return interaction.respond([]);

        await interaction.respond(
            chars.map(c => ({ name: c.name, value: c.id }))
        );
    }
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');
const { getFortuneAI } = require('../../utils/openRouter');


const TAROT_CARDS = {
    1: "The Magician (นักมายากล)",
    2: "The High Priestess (นักบวชหญิง)",
    3: "The Empress (จักรพรรดินี)",
    4: "The Emperor (จักรพรรดิ)",
    5: "The Hierophant (นักบวช)",
    6: "The Lovers (คนรัก)",
    7: "The Chariot (รถศึก)",
    8: "Strength (ความเข้มแข็ง)",
    9: "The Hermit (ฤาษี)",
    10: "Wheel of Fortune (กงล้อแห่งโชคชะตา)",
    11: "The Hanged Man (คนแขวน)",
    12: "Death (ความตาย)",
    13: "Temperance (ความพอดี)",
    14: "The Devil (ปีศาจ)",
    15: "The Tower (หอคอย)",
    16: "The Star (ดวงดาว)",
    17: "The Moon (ดวงจันทร์)",
    18: "The Sun (ดวงอาทิตย์)",
    19: "Judgement (การพิพากษา)",
    20: "The World (โลก)",
    21: "Judgement / Custom Nick (ไพ่พิเศษ/ชื่อผิด)",
    22: "The Fool (คนโง่)",
    23: "Ace of Wands (เอซไม้เท้า)",
    24: "Two of Wands (2 ไม้เท้า)",
    25: "Three of Wands (3 ไม้เท้า)",
    26: "Four of Wands (4 ไม้เท้า)",
    27: "Five of Wands (5 ไม้เท้า)",
    28: "Six of Wands (6 ไม้เท้า)",
    29: "Seven of Wands (7 ไม้เท้า)",
    30: "Eight of Wands (8 ไม้เท้า)",
    31: "Nine of Wands (9 ไม้เท้า)",
    32: "Ten of Wands (10 ไม้เท้า)",
    33: "Page of Wands (เด็กถือไม้เท้า)",
    34: "Knight of Wands (อัศวินไม้เท้า)",
    35: "Queen of Wands (ราชินีไม้เท้า)",
    36: "King of Wands (ราชาไม้เท้า)",
    37: "Ace of Cups (เอซถ้วย)",
    38: "Two of Cups (2 ถ้วย)",
    39: "Three of Cups (3 ถ้วย)",
    40: "Four of Cups (4 ถ้วย)",
    41: "Five of Cups (5 ถ้วย)",
    42: "Six of Cups (6 ถ้วย)",
    43: "Seven of Cups (7 ถ้วย)",
    44: "Eight of Cups (8 ถ้วย)",
    45: "Nine of Cups (9 ถ้วย)",
    46: "Ten of Cups (10 ถ้วย)",
    47: "Page of Cups (เด็กถือถ้วย)",
    48: "Knight of Cups (อัศวินถ้วย)",
    49: "Queen of Cups (ราชินีถ้วย)",
    50: "King of Cups (ราชาถ้วย)",
    51: "Ace of Swords (เอซดาบ)",
    52: "Two of Swords (2 ดาบ)",
    53: "Three of Swords (3 ดาบ)",
    54: "Four of Swords (4 ดาบ)",
    55: "Five of Swords (5 ดาบ)",
    56: "Six of Swords (6 ดาบ)",
    57: "Seven of Swords (7 ดาบ)",
    58: "Eight of Swords (8 ดาบ)",
    59: "Nine of Swords (9 ดาบ)",
    60: "Ten of Swords (10 ดาบ)",
    61: "Page of Swords (เด็กถือดาบ)",
    62: "Knight of Swords (อัศวินดาบ)",
    63: "Queen of Swords (ราชินีดาบ)",
    64: "King of Swords (ราชาดาบ)",
    65: "Ace of Pentacles (เอซเหรียญ)",
    66: "Two of Pentacles (2 เหรียญ)",
    67: "Three of Pentacles (3 เหรียญ)",
    68: "Four of Pentacles (4 เหรียญ)",
    69: "Five of Pentacles (5 เหรียญ)",
    70: "Six of Pentacles (6 เหรียญ)",
    71: "Seven of Pentacles (7 เหรียญ)",
    72: "Eight of Pentacles (8 เหรียญ)",
    73: "Nine of Pentacles (9 เหรียญ)",
    74: "Ten of Pentacles (10 เหรียญ)",
    75: "Page of Pentacles (เด็กถือเหรียญ)",
    76: "Knight of Pentacles (อัศวินเหรียญ)",
    77: "Queen of Pentacles (ราชินีเหรียญ)",
    78: "King of Pentacles (ราชาเหรียญ)"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fortune')
        .setDescription('🔮 ดูดวงชะตารายวันด้วยไพ่ทาโร่เมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
        .addSubcommand(sub => 
            sub.setName('enable')
                .setDescription('✨ เปิดใช้งานระบบสับไพ่ในห้องนี้ (Admin เท่านั้นเมี๊ยว)'))
        .addSubcommand(sub => 
            sub.setName('disable')
                .setDescription('🚫 ปิดใช้งานระบบทำนายดวงในเซิร์ฟเวอร์นี้ (Admin เท่านั้นเมี๊ยว)'))
        .addSubcommand(sub => 
            sub.setName('setread')
                .setDescription('📍 ตั้งค่าห้องให้บอท "แอบฟัง" เพื่อนำข้อมูลไปช่วยทำนายเมี๊ยว')
                .addChannelOption(o => 
                    o.setName('channel')
                        .setDescription('เลือกห้องที่ต้องการให้บอทอ่านข้อความเมี๊ยว')
                        .setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('disable_read')
                .setDescription('❌ ปิดการ "แอบฟัง" ของ AI สำหรับห้องทำนายดวงเมี๊ยว'))
        .addSubcommand(sub => 
            sub.setName('draw')
                .setDescription('🔮 จิ้มเพื่อสุ่มไพ่ทาโร่ 1 ใบให้คุณทันทีเมี๊ยว!')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { member, guild } = interaction;

        if (sub === 'enable' || sub === 'disable' || sub === 'setread' || sub === 'disable_read') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้นที่ใช้คำสั่งตั้งค่าได้นะเมี๊ยว!', ephemeral: true });
            }
        }

        const guildId = guild.id;

        if (sub === 'setread') {
            const channel = interaction.options.getChannel('channel');
            if (channel.type !== 0) { // 0 = GuildText
                return interaction.reply({ content: '❌ กรุณาเลือกห้องแชทปกติ (Text Channel) นะเมี๊ยว!', ephemeral: true });
            }

            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (!settings.fortune) settings.fortune = {};
            settings.fortune.read_channel_id = channel.id;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            return interaction.reply({ content: `✅ บอทจะเริ่ม "แอบฟัง" ข้อความจากแชนแนล ${channel} เพื่อนำไปใช้เป็นบริบทในการทำนายแล้วนะเมี๊ยว! 🐾`, ephemeral: true });
        }

        if (sub === 'disable_read') {
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (!settings.fortune) settings.fortune = {};
            settings.fortune.read_channel_id = null;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            return interaction.reply({ content: `✅ บอทจะไม่พยายามอ่านแชทอีกต่อไปแล้วเมี๊ยว! กลับไปทำนายแบบธรรมดาๆ เหมือนเดิม ✨`, ephemeral: true });
        }

        if (sub === 'enable') {
            const embed = new EmbedBuilder()
                .setTitle('🔮 PurrPaw Fortune Teller')
                .setDescription('🐾 **คุณอยากรู้ดวงชะตาของตัวเองในวันนี้ไหมเมี๊ยว?**\nจิ้มที่ปุ่มด้านล่างเพื่อสับไพ่และเลือกดวงชะตาของคุณ 1 ใบ!')
                .setColor(0x8B5CF6)
                .setImage('https://cfildssrpbwqxupnorqd.supabase.co/storage/v1/object/public/public-assets/daily-fortune/7.png')
                .setFooter({ text: 'ขอให้ดวงดาวนำทางอุ้งเท้าของคุณ... ประกายมระกต! ✨' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fortune_draw')
                    .setLabel('🔮 ดูดวงชะตาของฉัน (1 ใบ)')
                    .setStyle(ButtonStyle.Primary)
            );

            let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
            const features = guildData?.features || {};
            features.fortune = true;
            await supabase.from('guilds').upsert({ id: guildId, features: features });

            await interaction.reply({ content: '✅ เปิดระบบทำนายดวงในห้องนี้เรียบร้อยแล้วเมี๊ยวว!', ephemeral: true });
            return await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (sub === 'disable') {
            let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
            const features = guildData?.features || {};
            features.fortune = false;
            await supabase.from('guilds').upsert({ id: guildId, features: features });

            return await interaction.reply({ content: '❌ ปิดระบบทำนายดวงสำหรับเซิร์ฟเวอร์นี้แล้วเมี๊ยว...', ephemeral: true });
        }

        if (sub === 'draw') {
            return await drawCard(interaction);
        }
    }
};

async function drawCard(interaction) {
    const user = interaction.user;
    const cardId = Math.floor(Math.random() * 78) + 1;
    const cardName = TAROT_CARDS[cardId] || `Card ${cardId}`;
    const cardUrl = `https://cfildssrpbwqxupnorqd.supabase.co/storage/v1/object/public/public-assets/daily-fortune/${cardId}.png`;

    // 1. Loading Embed (เปลี่ยนเป็น Loading ระหว่างรอ AI)
    const loadingEmbed = new EmbedBuilder()
        .setTitle(`🔮 กำลังพยากรณ์ดวงชะตา: ${user.displayName}`)
        .setDescription('🐾 *PurrPaw กำลังเพ่งจิตไปที่ดวงดาวและค่อยๆ สับไพ่ให้อย่างตั้งใจ...* 🕯️')
        .setColor(0x8B5CF6);

    // Initial reply (loading state)
    await interaction.reply({ embeds: [loadingEmbed], fetchReply: true });

    // 2. AI Prompt (โครงสร้างคำทำนายดวง)
    // 2. ดึงบริบทแชท (ถ้ามี)
    let chatContext = "";
    try {
        const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', interaction.guildId).single();
        const readChannelId = guildData?.settings?.fortune?.read_channel_id;

        if (readChannelId) {
            const readChannel = await interaction.guild.channels.fetch(readChannelId).catch(() => null);
            if (readChannel && readChannel.isTextBased()) {
                const messages = await readChannel.messages.fetch({ limit: 50 });
                const userMessages = messages
                    .filter(m => m.author.id === user.id && m.content.length > 0)
                    .first(5)
                    .map(m => m.content)
                    .reverse();
                
                if (userMessages.length > 0) {
                    chatContext = `\n\n**บริบทเพิ่มเติมจากข้อความล่าสุดของผู้ใช้:**\n- ${userMessages.join('\n- ')}`;
                }
            }
        }
    } catch (e) {
        console.error('Fetch context error:', e);
    }

    // 3. AI Prompt
    const systemPrompt = `คุณคือ PurrPaw แมวนักพยากรณ์ผู้รอบรู้และมีเมตตา มีบุคลิกแมวๆ (มีเสียงครางในลำคอ "Purr..." หรือ "Meow..." บ้างบางครั้ง)
หน้าที่ของคุณคือทำนายไพ่ทาโร่ประจำวันให้กับผู้ใช้ในรูปแบบที่ชัดเจนและดูน่าเชื่อถือในภาษาไทย

**คำแนะนำพิเศษ:**
หากข้อมูลข้างล่างมี "บริบทเพิ่มเติมจากข้อความล่าสุดของผู้ใช้" ให้คุณลอง "แอบอ่านใจ" และเชื่อมโยงสิ่งที่เขาคุยไปกับการทำนายไพ่แบบเนียนๆ เหมือนแมวรู้ใจด้วยเมี๊ยว!

**โครงสร้างคำทำนายที่ต้องส่งออกมาเสนอ:**
---
🐱 **คำทำนายรายวันจาก PurrPaw**
[ใส่ข้อความเกริ่นนำสั้นๆ เกี่ยวกับบรรยากาศของไพ่ใบนี้]

❤️ **ความรักและความสัมพันธ์**
- **คนโสด:** [คำทำนาย]
- **คนมีคู่:** [คำทำนาย]

💼 **การงานและการเงิน**
- [คำทำนาย]

🍀 **สุขภาพและอารมณ์**
- [คำทำนาย]

🐾 **คำแนะนำจากอุ้งเท้าวิเศษ**
- [คำแนะนำเด็ดๆ 1 ข้อสำหรับวันนี้]
---`;

    const userMsg = `ไพ่ที่เปิดได้คือ: ${cardName}${chatContext}`;

    let aiResult;
    try {
        aiResult = await getFortuneAI(systemPrompt, userMsg);
    } catch (e) {
        console.error('Fortune AI Error:', e);
        aiResult = `🐾 *เกิดเมฆหมอกบังดวงดาวชั่วขณะเมี๊ยว...* แต่คุณได้รับไพ่ **${cardName}** ซึ่งมีความหมายที่ดี! ลองมาเปิดใหม่อีกครั้งทีหลังนะ! Purr...`;
    }

    const finalEmbed = new EmbedBuilder()
        .setTitle(`🔮 ผลการทำนาย: ${cardName}`)
        .setDescription(aiResult)
        .setImage(cardUrl)
        .setColor(0x8B5CF6)
        .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
        .setFooter({ text: 'ขอให้ดวงดาวนำทางคุณในวันนี้! ✨' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('fortune_draw')
            .setLabel('🔮 ดูดวงชะตาของฉัน (1 ใบ)')
            .setStyle(ButtonStyle.Primary)
    );

    // อัปเดตข้อความเดิมด้วยผลการพยากรณ์
    return await interaction.editReply({ embeds: [finalEmbed], components: [row] });
}

module.exports.drawCard = drawCard;

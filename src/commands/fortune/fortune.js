const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');
const { invalidateCache } = require('../../utils/guildCache');
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
    11: "Justice (ความยุติธรรม)",
    12: "The Hanged Man (คนแขวน)",
    13: "Death (ความตาย)",
    14: "Temperance (ความพอดี)",
    15: "The Devil (ปีศาจ)",
    16: "The Tower (หอคอย)",
    17: "The Star (ดวงดาว)",
    18: "The Moon (ดวงจันทร์)",
    19: "The Sun (ดวงอาทิตย์)",
    20: "Judgement (การพิพากษา)",
    21: "The World (โลก)",
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

const CARD_IMAGES = {
    "1": "https://s.showimg.link/LPQo3lz4e0.webp",
    "2": "https://s.showimg.link/39b6xeQoAu.webp",
    "3": "https://s.showimg.link/Z6BjarSSa9.webp",
    "4": "https://s.showimg.link/e4pyTT9LFd.webp",
    "5": "https://s.showimg.link/49kpTD-9dl.webp",
    "6": "https://s.showimg.link/2Ynk7vMWU2.webp",
    "7": "https://s.showimg.link/JMA-qFSFPM.webp",
    "8": "https://s.showimg.link/hrF7mZ3EOB.webp",
    "9": "https://s.showimg.link/2JixptBt1d.webp",
    "10": "https://s.showimg.link/vTUPuTceG6.webp",
    "11": "https://s.showimg.link/ClaD0awCJg.webp",
    "12": "https://s.showimg.link/KkvmZXOdNw.webp",
    "13": "https://s.showimg.link/SXz5wvvolN.webp",
    "14": "https://s.showimg.link/rYI7IQJM_3.webp",
    "15": "https://s.showimg.link/4D7HtV5e0W.webp",
    "16": "https://s.showimg.link/QiExqNVRHZ.webp",
    "17": "https://s.showimg.link/I8BCWaHgUU.webp",
    "18": "https://s.showimg.link/IkHdGap6Pf.webp",
    "19": "https://s.showimg.link/85nTi8A1mh.webp",
    "20": "https://s.showimg.link/EF9wrsRLVD.webp",
    "21": "https://s.showimg.link/xPuQyM6vgf.webp",
    "22": "https://s.showimg.link/RGNyjtL1Od.webp",
    "23": "https://s.showimg.link/m0aJxUCMxD.webp",
    "24": "https://s.showimg.link/AOxV0o1sZ-.webp",
    "25": "https://s.showimg.link/UaB6fePmi_.webp",
    "26": "https://s.showimg.link/ReWyodVto8.webp",
    "27": "https://s.showimg.link/SLYwx3kr42.webp",
    "28": "https://s.showimg.link/X_clMfxnMG.webp",
    "29": "https://s.showimg.link/u5Di3Xtplj.webp",
    "30": "https://s.showimg.link/ruBf40mC6G.webp",
    "31": "https://s.showimg.link/_Aalb_huYw.webp",
    "32": "https://s.showimg.link/Y_Npnxr2Wj.webp",
    "33": "https://s.showimg.link/U8l7OcYQDT.webp",
    "34": "https://s.showimg.link/Hg8sORhJUC.webp",
    "35": "https://s.showimg.link/BIqWpjNRVh.webp",
    "36": "https://s.showimg.link/fcxVr8QHZ9.webp",
    "37": "https://s.showimg.link/kMmvkKpHDF.webp",
    "38": "https://s.showimg.link/qJCVib-_Gr.webp",
    "39": "https://s.showimg.link/1yyrVYbbZz.webp",
    "40": "https://s.showimg.link/_IkXrDtEZG.webp",
    "41": "https://s.showimg.link/nm44L5PRX1.webp",
    "42": "https://s.showimg.link/Iya12CaOop.webp",
    "43": "https://s.showimg.link/7ymf6i_rOM.webp",
    "44": "https://s.showimg.link/uaTZKnt2pw.webp",
    "45": "https://s.showimg.link/h9kV-JpNBP.webp",
    "46": "https://s.showimg.link/9c24OG2LZY.webp",
    "47": "https://s.showimg.link/s_ALCAzJUr.webp",
    "48": "https://s.showimg.link/RvibDp7u2f.webp",
    "49": "https://s.showimg.link/KPCRGK2m2M.webp",
    "50": "https://s.showimg.link/35Z0Eiug9-.webp",
    "51": "https://s.showimg.link/BC0w6QG-B8.webp",
    "52": "https://s.showimg.link/veTH4pAebO.webp",
    "53": "https://s.showimg.link/qZErZ_FdT0.webp",
    "54": "https://s.showimg.link/KIszCeJYpK.webp",
    "55": "https://s.showimg.link/N0e8yn2KP2.webp",
    "56": "https://s.showimg.link/o9OmeuukMG.webp",
    "57": "https://s.showimg.link/4sx3xmjTk0.webp",
    "58": "https://s.showimg.link/VKMthaUMNm.webp",
    "59": "https://s.showimg.link/Xb2m4CxjQ0.webp",
    "60": "https://s.showimg.link/mggbKWydB4.webp",
    "61": "https://s.showimg.link/m2AFcizS5y.webp",
    "62": "https://s.showimg.link/jIGH8RMfBt.webp",
    "63": "https://s.showimg.link/XEpk_v3vJp.webp",
    "64": "https://s.showimg.link/ZwyjbHFHVh.webp",
    "65": "https://s.showimg.link/gjHS5rHRzU.webp",
    "66": "https://s.showimg.link/0nsKCFfl2W.webp",
    "67": "https://s.showimg.link/m0LZKV3vjf.webp",
    "68": "https://s.showimg.link/KmdmtmCVmu.webp",
    "69": "https://s.showimg.link/cbt2m_M_NG.webp",
    "70": "https://s.showimg.link/RaN5XThvPz.webp",
    "71": "https://s.showimg.link/_odFYYrpnp.webp",
    "72": "https://s.showimg.link/WfJ-J_8lXg.webp",
    "73": "https://s.showimg.link/PaLd4ay6a6.webp",
    "74": "https://s.showimg.link/C0rXJgV4_O.webp",
    "75": "https://s.showimg.link/Nh_2ziU88b.webp",
    "76": "https://s.showimg.link/OLqgEq46E3.webp",
    "77": "https://s.showimg.link/qO1yEW8UG_.webp",
    "78": "https://s.showimg.link/2jeDEe82tP.webp"
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
            invalidateCache(guildId);
            return interaction.reply({ content: `✅ บอทจะเริ่ม "แอบฟัง" ข้อความจากแชนแนล ${channel} เพื่อนำไปใช้เป็นบริบทในการทำนายแล้วนะเมี๊ยว! 🐾`, ephemeral: true });
        }

        if (sub === 'disable_read') {
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};

            if (!settings.fortune) settings.fortune = {};
            settings.fortune.read_channel_id = null;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            invalidateCache(guildId);
            return interaction.reply({ content: `✅ บอทจะไม่พยายามอ่านแชทอีกต่อไปแล้วเมี๊ยว! กลับไปทำนายแบบธรรมดาๆ เหมือนเดิม ✨`, ephemeral: true });
        }

        if (sub === 'enable') {
            const embed = new EmbedBuilder()
                .setTitle('🔮 PurrPaw Fortune Teller')
                .setDescription('🐾 **คุณอยากรู้ดวงชะตาของตัวเองในวันนี้ไหมเมี๊ยว?**\nจิ้มที่ปุ่มด้านล่างเพื่อสับไพ่และเลือกดวงชะตาของคุณ 1 ใบ!')
                .setColor(0x8B5CF6)
                .setImage(CARD_IMAGES[7])
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
            invalidateCache(guildId);

            await interaction.reply({ content: '✅ เปิดระบบทำนายดวงในห้องนี้เรียบร้อยแล้วเมี๊ยวว!', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (sub === 'disable') {
            let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
            const features = guildData?.features || {};
            features.fortune = false;
            await supabase.from('guilds').upsert({ id: guildId, features: features });
            invalidateCache(guildId);

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
    const cardUrl = CARD_IMAGES[cardId];

    // 1. Loading Embed (เปลี่ยนเป็น Loading ระหว่างรอ AI)
    const loadingEmbed = new EmbedBuilder()
        .setTitle(`🔮 กำลังพยากรณ์ดวงชะตา: ${user.displayName}`)
        .setDescription('🐾 *PurrPaw กำลังเพ่งจิตไปที่ดวงดาวและค่อยๆ สับไพ่ให้อย่างตั้งใจ...* 🕯️')
        .setImage('https://s.showimg.link/XMJwqN8ofy.webp') // รูปหลังไพ่ระหว่างรอ
        .setColor(0x8B5CF6);

    // Initial reply (loading state)
    await interaction.reply({ embeds: [loadingEmbed], withResponse: true });

    // สร้าง Promise สำหรับ Delay 5 วินาที
    const delay = ms => new Promise(res => setTimeout(res, ms));
    const delayPromise = delay(5000);

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
`;

    const userMsg = `ไพ่ที่เปิดได้คือ: ${cardName}${chatContext}`;

    let aiResult;
    try {
        aiResult = await getFortuneAI(systemPrompt, userMsg);
    } catch (e) {
        console.error('Fortune AI Error:', e);
        aiResult = `🐾 *เกิดเมฆหมอกบังดวงดาวชั่วขณะเมี๊ยว...* แต่คุณได้รับไพ่ **${cardName}** ซึ่งมีความหมายที่ดี! ลองมาเปิดใหม่อีกครั้งทีหลังนะ! Purr...`;
    }

    // รอให้ครบ 5 วินาทีก่อนค่อยแสดงผล (ถ้า AI ตอบเร็วกว่า)
    await delayPromise;

    const finalEmbed = new EmbedBuilder()
        .setTitle(`🔮 ไพ่ทาโร่ประจำวัน: ${cardName}`)
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

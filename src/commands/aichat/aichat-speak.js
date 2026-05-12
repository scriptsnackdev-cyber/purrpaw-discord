const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const supabase = require('../../supabaseClient');
const globalAIQueue = require('../../utils/aiQueue');

let globalCharsCache = null;
let globalCharsCacheTime = 0;

async function getAutocompleteChars() {
    const now = Date.now();
    if (globalCharsCache && (now - globalCharsCacheTime < 300000)) {
        return globalCharsCache;
    }
    const { data } = await supabase.from('ai_characters')
        .select('id, name, guild_id, is_public, called_at')
        .order('called_at', { ascending: false }); // เรียงตามตัวที่ใช้ล่าสุดเมี๊ยว🐾
        
    if (data) {
        globalCharsCache = data;
        globalCharsCacheTime = now;
        return data;
    }
    return globalCharsCache || [];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aichat-speak')
        .setDescription('🎙️ สั่งให้ AI เจาะจงตัวละครมาตอบทันที')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => 
            o.setName('persona')
                .setDescription('เลือก AI ที่ต้องการให้ตอบ')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(o => 
            o.setName('topic')
                .setDescription('หัวข้อที่อยากให้พูดถึง (ไม่ระบุก็ได้)')
                .setRequired(false)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const botId = interaction.options.getString('persona');
        const topic = interaction.options.getString('topic');

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        }

        const { data: char } = await supabase.from('ai_characters').select('*').eq('id', botId).single();
        if (!char) return interaction.editReply({ content: '❌ ไม่พบตัวละคร AI ตัวที่ระบุ' });

        // 🕒 อัปเดตเวลาที่ถูกเรียกใช้ล่าสุดเมี๊ยว🐾
        await supabase.from('ai_characters').update({ called_at: new Date().toISOString() }).eq('id', botId);
        globalCharsCacheTime = 0; // ล้าง Cache เพื่อให้ Autocomplete อัปเดตทันที

        // ดึงประวัติแชทเพื่อสร้าง Context
        const history = await interaction.channel.messages.fetch({ limit: 15 });
        const historyData = Array.from(history.values()).reverse();

        const { getChatAI } = require('../../utils/aiProvider');
        const { getGuildData } = require('../../utils/guildCache');
        const { settings } = await getGuildData(guildId);

        const activeUserIds = new Set();
        historyData.forEach(m => { if (!m.author.bot) activeUserIds.add(m.author.id); });

        // 5. ดึงข้อมูลการแนะนำตัว (Introductions) จาก Supabase 🚀
        const userNamesMap = new Map();
        const userIntrosMap = new Map();

        // ดึงข้อมูลลูกบ้านทุกคนที่มีส่วนร่วมในแชทล่าสุดจาก Supabase เมี๊ยว🐾
        const userIdsToFetch = Array.from(activeUserIds);
        const { data: dbIntros } = await supabase
            .from('user_introductions')
            .select('user_id, message_introduction, message_bot_introduction, message_birthday, birth_date, favorite_characters')
            .eq('guild_id', guildId)
            .in('user_id', userIdsToFetch);

        // นำข้อมูลที่ได้ใส่ลง Map โดยใช้ระบบลำดับความสำคัญ (Priority) เมี๊ยว🐾
        dbIntros?.forEach(row => {
            // ลำดับ: 1. Bot Intro 2. Birthday 3. Intro ปกติ
            const content = row.message_bot_introduction || row.message_birthday || row.message_introduction || "";
            
            if (content) {
                const nameMatch = content.match(/ชื่อ\s*[:：]\s*([^\n]+)/);
                if (nameMatch) userNamesMap.set(row.user_id, nameMatch[1].trim());
                userIntrosMap.set(row.user_id, content);
            }
        });

        // จัดการชื่อและ Introduction พื้นฐานสำหรับคนที่ยังไม่มีใน DB หรือเคสพิเศษ
        for (const uId of activeUserIds) {
            const uObj = interaction.client.users.cache.get(uId);
            const uname = uObj ? uObj.username : uId;

            if (uname === 'superdupermeow_') {
                const smIntro = `⊹₊˚‧︵‿₊୨ᰔ୧₊‿︵‧˚₊⊹\nชื่อ: คุณแม่เหมียว\nเพศ: หญิง\nบทบาท: คุณแม่เหมียวในห้อง ห้ามเถียง ห้ามด่า ต้องฟังแม่ ห้ามมารักหรือชอบแม่ ไปชอบลูกแมวเหมียว\n⊹₊˚‧︵‿₊୨ᰔ୧₊‿︵‧˚₊⊹`;
                userIntrosMap.set(uId, smIntro);
                userNamesMap.set(uId, 'คุณแม่เหมียว');
            } else if (!userIntrosMap.has(uId)) {
                userNamesMap.set(uId, uname);
            }
        }

        let usersContextXml = "<users_context>\n";
        for (const [uId, introContent] of userIntrosMap.entries()) {
            const dbUser = dbIntros?.find(r => r.user_id === uId);
            const bdayAttr = dbUser?.birth_date ? ` birthday="${dbUser.birth_date.replace(/"/g, '')}"` : "";
            const favAttr = dbUser?.favorite_characters ? ` favorite_chars="${dbUser.favorite_characters.replace(/"/g, '')}"` : "";

            const sanitizedIntro = introContent.replace(/[<>]/g, ''); // ป้องกัน XML พังเมี๊ยว🐾
            const userName = (userNamesMap.get(uId) || 'Unknown').replace(/"/g, '');
            usersContextXml += `  <user name="${userName}"${bdayAttr}${favAttr}>${sanitizedIntro}</user>\n`;
        }
        usersContextXml += "</users_context>";

        let finalPersona = char.persona ? char.persona.replace(/{{char}}/gi, char.name) : "";
        finalPersona = finalPersona.replace(/{{user}}/gi, interaction.user.username);

        const now = new Date();
        const currentDateTime = `${now.getDate()} ${now.toLocaleString('th-TH', { month: 'long' })} ${now.getFullYear()} เวลา ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;

        const systemPrompt = `<instructions>
วันเวลาปัจจุบัน: ${currentDateTime}
You are playing as ${char.name}.
[CORE RULES]
- **IMMERSIVE PORTRAYAL:** มั่นคงในคาแรคเตอร์และอารมณ์ของตัวละครเสมอ
- **XML OUTPUT ONLY:** ตอบกลับภายใต้โครงสร้าง XML ที่กำหนดให้เท่านั้น
- **NO HEADERS:** ห้ามใส่ [HH:mm] หรือ ชื่อตัวละคร : ลงในบทสนทนา

[OUTPUT STRUCTURE]
<turn_responses>
  <persona name="${char.name}">
    <thought>...วิเคราะห์สถานการณ์...</thought>
    <dialogue>...บทสนทนาคำพูดล้วนๆ (จำกัด 50-100 ตัวอักษร)...</dialogue>
  </persona>
</turn_responses>

[MULTI-CHARACTER RULES]
- ตัวละครควรพูดสั้นๆ (50-100 ตัวอักษร) เพื่อความสมจริง
${topic ? `\n[PRIORITY TOPIC]\n- ให้เน้นพูดคุยเกี่ยวกับหัวข้อ: "${topic}" เป็นหลักในบทสนทนานี้` : ''}
</instructions>

<characters>
  <persona name="${char.name}">${finalPersona}</persona>
</characters>

${usersContextXml}`;

        const messagesForAI = [{ role: 'system', content: systemPrompt }];
        historyData.forEach(m => {
            const name = userNamesMap.get(m.author.id) || m.author.username;
            const typeAttr = m.author.bot ? ' type="persona"' : '';
            messagesForAI.push({
                role: m.author.bot ? 'assistant' : 'user',
                content: `<msg from="${name}"${typeAttr}>${m.content.replace(/[<>]/g, '')}</msg>`
            });
        });

        const aiResponse = await globalAIQueue.run(() => getChatAI(messagesForAI));
        const dialogueRegex = /<dialogue>([\s\S]*?)<\/dialogue>/i;
        const dialogueMatch = aiResponse && typeof aiResponse === 'string' ? aiResponse.match(dialogueRegex) : null;
        let finalMsg = dialogueMatch ? dialogueMatch[1].trim() : (typeof aiResponse === 'string' ? aiResponse.replace(/<[^>]+>/g, '').trim() : '');

        if (!finalMsg) return interaction.editReply({ content: '❌ AI ไม่ตอบอะไรกลับมาเลย' });

        if (!interaction.client.aiSpeakCache) interaction.client.aiSpeakCache = new Map();
        interaction.client.aiSpeakCache.set(interaction.id, {
            content: finalMsg,
            charName: char.name,
            charAvatar: char.image_url
        });

        const embed = new EmbedBuilder()
            .setAuthor({ name: char.name, iconURL: char.image_url || null })
            .setDescription(finalMsg)
            .setColor(0x8B5CF6)
            .setFooter({ text: 'คุณต้องการส่งข้อความนี้ไหม? (เห็นแค่คนเดียว)' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ai_speak_approve:${interaction.id}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`ai_speak_edit:${interaction.id}`).setLabel('Edit').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
            new ButtonBuilder().setCustomId(`ai_speak_reject:${interaction.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const guildId = interaction.guild.id;
        const allChars = await getAutocompleteChars();
        const filtered = allChars.filter(c => (c.guild_id === guildId || c.is_public) && c.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        try {
            await interaction.respond(filtered.map(c => ({ name: c.name, value: c.id })));
        } catch (err) {
            if (err.code === 10062) return;
            console.error('Autocomplete Error in aichat-speak:', err);
        }
    }
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

/**
 * 🤖 ให้ AI คิดคำศัพท์แมวพร้อมสลับตัวอักษรมาให้เลย
 */
async function generateWordPuzzle() {
    const { getChatAI } = require('../../utils/aiProvider');
    const messages = [
        { 
            role: 'system', 
            content: `คุณคือเครื่องสร้างคำถามเกมทายคำศัพท์เกี่ยวกับแมว สัตว์เลี้ยง หรือคาเฟ่แมว
คุณต้องตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON
รูปแบบ:
{"word":"คำตอบที่ถูกต้อง","swap":"คำที่สลับตัวอักษรแล้ว","hint":"คำใบ้สั้นๆ 1 ประโยค","category":"หมวดหมู่ของคำ"}

กฎ:
- word ต้องเป็นคำภาษาไทย 2-5 พยางค์ ที่เกี่ยวกับแมว สัตว์เลี้ยง อาหารแมว อุปกรณ์แมว พฤติกรรมแมว สายพันธุ์แมว หรือคาเฟ่แมว
- swap ต้องเป็นการสลับตัวอักษรของ word ให้ไม่เหมือน word เดิม (ห้ามเหมือนกัน)
- hint ต้องเป็นคำใบ้ที่ช่วยให้คนเดาได้ แต่ไม่ง่ายเกินไป
- category เช่น: อาหาร, ของเล่น, ร่างกาย, สายพันธุ์, พฤติกรรม, อุปกรณ์, สถานที่
- สร้างคำที่หลากหลาย ไม่ซ้ำกัน ทุกครั้งที่ถูกเรียก` 
        },
        { role: 'user', content: 'สร้างคำถามเกมทายคำศัพท์แมวมา 1 ข้อ (JSON เท่านั้น)' }
    ];

    const response = await getChatAI(messages);
    
    // แกะ JSON จากคำตอบ AI (รองรับกรณี AI ครอบด้วย ```json ... ```)
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
    const parsed = JSON.parse(jsonStr);

    // Validate ว่ามีฟิลด์ครบ
    if (!parsed.word || !parsed.swap || !parsed.hint || !parsed.category) {
        throw new Error('AI response missing required fields');
    }
    // ป้องกัน AI ส่ง swap เหมือน word
    if (parsed.word === parsed.swap) {
        throw new Error('AI returned swap identical to word');
    }

    return parsed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('เล่นมินิเกมกันเมี๊ยว! 🎮🐾')
        .addSubcommand(sub =>
            sub.setName('word')
                .setDescription('ทายคำศัพท์แมว — แข่งกันทั้งห้อง! 🧠')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'word') {
            await interaction.deferReply();

            // เช็คว่ามีเกมกำลังเล่นอยู่ในห้องนี้ไหม
            if (!interaction.client.wordGames) interaction.client.wordGames = new Map();
            if (interaction.client.wordGames.has(interaction.channelId)) {
                return interaction.editReply({ content: '❌ มีเกมกำลังเล่นอยู่ในห้องนี้แล้วนะเมี๊ยว! รอให้จบก่อนเมี๊ยว🐾' });
            }

            // 🤖 ให้ AI คิดคำมาให้
            let wordData;
            try {
                wordData = await generateWordPuzzle();
            } catch (err) {
                console.error('[WordGame] AI Generate error:', err.message);
                return interaction.editReply({ content: '❌ AI คิดคำไม่ออกเมี๊ยว! ลองใหม่อีกครั้งนะ🐾' });
            }

            const answer = wordData.word;
            const scrambled = wordData.swap;
            const timeLimit = 30; // วินาที

            // สร้าง Embed คำถาม
            const questionEmbed = new EmbedBuilder()
                .setTitle('🧠 ทายคำศัพท์แมวเมี๊ยว!')
                .setDescription(`ตัวอักษรที่สลับ:\n# 「 ${scrambled.split('').join('  ')} 」`)
                .addFields(
                    { name: '📂 หมวด', value: wordData.category, inline: true },
                    { name: '💡 คำใบ้', value: wordData.hint, inline: true },
                    { name: '⏰ เวลา', value: `${timeLimit} วินาที`, inline: true }
                )
                .setColor(0xFBBF24)
                .setFooter({ text: 'พิมพ์คำตอบลงในแชทได้เลยเมี๊ยว! คนแรกที่ถูกชนะ!🐾' });

            await interaction.editReply({ embeds: [questionEmbed] });

            // ตั้งค่าเกม
            const gameData = { answer, startTime: Date.now(), channelId: interaction.channelId };
            interaction.client.wordGames.set(interaction.channelId, gameData);

            // สร้าง Message Collector เพื่อรอคำตอบ
            const filter = (msg) => !msg.author.bot;
            const collector = interaction.channel.createMessageCollector({ filter, time: timeLimit * 1000 });

            let winner = null;

            collector.on('collect', (msg) => {
                const userAnswer = msg.content.trim();
                if (userAnswer === answer) {
                    winner = msg.author;
                    collector.stop('correct');
                }
            });

            collector.on('end', async (collected, reason) => {
                // ลบเกมออกจาก Map
                interaction.client.wordGames.delete(interaction.channelId);

                if (reason === 'correct' && winner) {
                    const responseTime = ((Date.now() - gameData.startTime) / 1000).toFixed(1);

                    // ✅ ตอบถูก → เรียก AI Character มาชมเชย
                    let aiCelebration = null;
                    try {
                        // สุ่มตัวละครที่ Active อยู่ในห้อง (หรือในเซิร์ฟเวอร์)
                        const { data: activeChats } = await supabase
                            .from('active_ai_chats')
                            .select('character_id, ai_characters(id, name, persona, image_url)')
                            .eq('guild_id', interaction.guildId);

                        let character = null;
                        if (activeChats && activeChats.length > 0) {
                            const randomChat = activeChats[Math.floor(Math.random() * activeChats.length)];
                            character = randomChat.ai_characters;
                        }

                        if (character) {
                            // เรียก AI ให้ชมเชยแบบ In-Character
                            const { getChatAI } = require('../../utils/aiProvider');
                            const messages = [
                                { role: 'system', content: `${character.persona}\n\n[สถานการณ์พิเศษ] มีเกมทายคำศัพท์แมวเกิดขึ้นในห้องแชท คนชื่อ "${winner.displayName}" ทายคำว่า "${answer}" ถูกต้องภายใน ${responseTime} วินาที! จงแสดงความยินดีกับเขาแบบสั้นๆ (1-2 ประโยค) ในคาแรกเตอร์ของตัวเอง อย่าพูดยาว` },
                                { role: 'user', content: `${winner.displayName} ทายคำว่า "${answer}" ถูกต้อง!` }
                            ];
                            aiCelebration = await getChatAI(messages);

                            // ส่งผ่าน Webhook เพื่อใช้ชื่อและรูปตัวละคร
                            if (aiCelebration && aiCelebration.length > 0) {
                                const webhooks = await interaction.channel.fetchWebhooks();
                                let webhook = webhooks.find(wh => wh.name === 'PurrPaw-AI');
                                if (!webhook) webhook = await interaction.channel.createWebhook({ name: 'PurrPaw-AI' });

                                await webhook.send({
                                    content: aiCelebration,
                                    username: character.name,
                                    avatarURL: character.image_url || null
                                });
                            }
                        }
                    } catch (err) {
                        console.error('[WordGame] AI Celebration error:', err.message);
                    }

                    // สร้าง Embed ผลลัพธ์
                    const resultEmbed = new EmbedBuilder()
                        .setTitle('🎉 มีคนตอบถูกแล้วเมี๊ยว!')
                        .setDescription(`# ✅ คำตอบ: ${answer}`)
                        .addFields(
                            { name: '🏆 ผู้ชนะ', value: `<@${winner.id}>`, inline: true },
                            { name: '⏱️ เวลาที่ใช้', value: `${responseTime} วินาที`, inline: true },
                            { name: '📂 หมวด', value: wordData.category, inline: true }
                        )
                        .setColor(0x22C55E)
                        .setFooter({ text: 'ใช้ /game word เพื่อเล่นรอบใหม่เมี๊ยว!🐾' })
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [resultEmbed] });

                } else {
                    // ❌ หมดเวลา → ใช้ Logic ธรรมดา (ไม่เรียก AI)
                    const failEmbed = new EmbedBuilder()
                        .setTitle('⏰ หมดเวลาแล้วเมี๊ยว!')
                        .setDescription(`# ❌ คำตอบที่ถูกคือ: ${answer}`)
                        .addFields(
                            { name: '💡 คำใบ้ที่ให้', value: wordData.hint },
                            { name: '📂 หมวด', value: wordData.category, inline: true }
                        )
                        .setColor(0xEF4444)
                        .setFooter({ text: 'ไม่มีใครตอบถูกเลยเมี๊ยว... ลองใหม่นะ! ใช้ /game word 🐾' })
                        .setTimestamp();

                    // เพิ่มข้อความปลอบใจแบบสุ่ม (ไม่ใช้ AI)
                    const comfortMessages = [
                        '🐾 ยากไปหน่อยเนอะ... ครั้งหน้าจะง่ายกว่านี้นะเมี๊ยว!',
                        '😿 อ้าวว ไม่มีใครตอบถูกเลยเหรอ ไม่เป็นไรนะเมี๊ยว ลองใหม่!',
                        '🙀 คำนี้ยากจริงๆ นะเมี๊ยว! อย่าท้อ ลองอีกรอบ!',
                        '😸 ถ้าแมวตอบได้ คงเก่งกว่าทุกคนแล้วเมี๊ยว ฮิฮิ~',
                    ];
                    const comfort = comfortMessages[Math.floor(Math.random() * comfortMessages.length)];

                    await interaction.channel.send({ content: comfort, embeds: [failEmbed] });
                }
            });
        }
    }
};

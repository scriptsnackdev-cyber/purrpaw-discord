const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

// โหลดข้อมูลจากไฟล์ JSON
const QUESTIONS = require('./MBTI_Question.json');
const MBTI_IMAGES = require('./MBTI_IMAGES.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mbti')
        .setDescription('🧠 แบบทดสอบ MBTI สไตล์ PurrPaw')
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('✨ เปิดใช้งานปุ่มเริ่มทำแบบทดสอบในห้องนี้ (Admin เท่านั้นเมี๊ยว)'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('🚫 ปิดใช้งานระบบ MBTI ในเซิร์ฟเวอร์นี้ (Admin เท่านั้นเมี๊ยว)'))
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('🧠 เริ่มทำแบบทดสอบ MBTI 12 ข้อทันทีเมี๊ยว!')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { member, guild } = interaction;

        if (sub === 'enable' || sub === 'disable') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้นที่ใช้คำสั่งนี้ได้นะเมี๊ยว!', ephemeral: true });
            }
        }

        const guildId = guild.id;

        if (sub === 'enable') {
            // รวบรวมรูปภาพทั้งหมดที่มีในระบบเพื่อสุ่มแสดงในหน้าปกเมี๊ยว🐾
            const allImages = Object.values(MBTI_IMAGES).flat();
            const randomCover = allImages[Math.floor(Math.random() * allImages.length)] || 'https://s.showimg.link/q-NlDl2Z-7.webp';

            const embed = new EmbedBuilder()
                .setTitle('🧠 PurrPaw MBTI Test')
                .setDescription('🐾 **คุณเป็นแมวบุคลิกไหนกันแน่เมี๊ยว?**\nมาลองทำแบบทดสอบสั้นๆ 12 ข้อเพื่อค้นหาบุคลิกที่แท้จริงของคุณกัน!\n\n*กดปุ่มด้านล่างเพื่อเริ่มทำแบบทดสอบ*')
                .setColor(0x3B82F6)
                .setImage(randomCover)
                .setFooter({ text: 'ค้นหาตัวตนของคุณผ่านอุ้งเท้าวิเศษ... ✨' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('mbti_start')
                    .setLabel('🧠 เริ่มทำแบบทดสอบ (12 ข้อ)')
                    .setStyle(ButtonStyle.Primary)
            );

            let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
            const features = guildData?.features || {};
            features.mbti = true;
            await supabase.from('guilds').upsert({ id: guildId, features: features });

            await interaction.reply({ content: '✅ เปิดระบบ MBTI เรียบร้อยแล้วเมี๊ยวว!', ephemeral: true });
            return await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (sub === 'disable') {
            let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
            const features = guildData?.features || {};
            features.mbti = false;
            await supabase.from('guilds').upsert({ id: guildId, features: features });
            return await interaction.reply({ content: '❌ ปิดระบบ MBTI เรียบร้อยแล้วเมี๊ยว...', ephemeral: true });
        }

        if (sub === 'start') {
            return await startTest(interaction);
        }
    }
};

async function startTest(interaction) {
    const user = interaction.user;
    let currentIdx = 0;
    // เริ่มต้นที่ 0 ทุกคู่ แล้วสะสม +/- ตามน้ำหนักแต่ละข้อ
    const scores = { E: 0, S: 0, T: 0, J: 0 };

    const getEmbed = (idx) => {
        const q = QUESTIONS[idx];
        const progress = Math.round(((idx) / QUESTIONS.length) * 100);
        const filled = Math.round((idx / QUESTIONS.length) * 10);
        const bar = '🟦'.repeat(filled) + '⬜'.repeat(10 - filled);

        return new EmbedBuilder()
            .setTitle(`🧠 แบบทดสอบ MBTI: ข้อที่ ${idx + 1}/${QUESTIONS.length}`)
            .setDescription(`${bar} ${progress}%\n\n🐾 **คำถาม:** ${q.text}`)
            .setColor(0x3B82F6)
            .setFooter({ text: 'เลือกสิ่งที่ตรงกับตัวคุณมากที่สุดนะเมี๊ยว! 🐾' });
    };

    const getRows = (idx) => {
        const q = QUESTIONS[idx];
        // แบ่งตัวเลือก 4 ข้อ ออกเป็น 2 แถว แถวละ 2 ปุ่ม เพื่อให้ label ยาวได้
        const rows = [];
        for (let r = 0; r < 2; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < 2; c++) {
                const i = r * 2 + c;
                if (i < q.options.length) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`mbti_ans:${idx}:${i}`)
                            .setLabel(q.options[i].label)
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
            }
            rows.push(row);
        }
        return rows;
    };

    await interaction.reply({
        embeds: [getEmbed(0)],
        components: getRows(0),
        ephemeral: true
    });
    
    const response = await interaction.fetchReply();

    const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === user.id,
        time: 600000
    });

    collector.on('collect', async (i) => {
        const parts = i.customId.split(':');
        const qIdx = Number(parts[1]);
        const optIdx = Number(parts[2]);
        const q = QUESTIONS[qIdx];
        const opt = q.options[optIdx];

        // สะสมคะแนนแบบ weighted (+2, +1, -1, -2)
        scores[q.dim] += opt.val;
        currentIdx++;

        if (currentIdx < QUESTIONS.length) {
            await i.update({
                embeds: [getEmbed(currentIdx)],
                components: getRows(currentIdx)
            });
        } else {
            // คำนวณผลลัพธ์: ถ้า score >= 0 จะได้ตัวอักษรแรก (E/S/T/J) ถ้า < 0 จะได้ตัวตรงข้าม (I/N/F/P)
            const mbti = [
                scores.E >= 0 ? 'E' : 'I',
                scores.S >= 0 ? 'S' : 'N',
                scores.T >= 0 ? 'T' : 'F',
                scores.J >= 0 ? 'J' : 'P'
            ].join('');

            await i.update({
                content: `🐾 **ประมวลผลเสร็จแล้วเมี๊ยว!** กำลังสรุปผลลัพธ์สักครู่... 🕯️`,
                embeds: [],
                components: []
            });

            // 📝 บันทึกผลลงฐานข้อมูล (Global Profile) เมี๊ยว🐾
            await supabase.from('user_profiles').upsert({
                user_id: user.id,
                mbti: mbti
            });

            const mbtiData = require('./MBTI.json');
            const resultData = mbtiData[mbti];

            // ดึงรูปภาพแบบสุ่มจาก MBTI_IMAGES.json
            const mbtiImages = require('./MBTI_IMAGES.json');
            const images = mbtiImages[mbti] || ["https://s.showimg.link/XMJwqN8ofy.webp"];
            const randomImage = images[Math.floor(Math.random() * images.length)];

            const resultEmbed = new EmbedBuilder()
                .setTitle(`${resultData.emoji} ผลทดสอบ MBTI: ${resultData.title} (${mbti})`)
                .setDescription(`🐱 **คุณคือ: ${resultData.cat_type}**\n\n${resultData.description}\n\n🌟 **จุดเด่นของคุณ:**\n- ${resultData.strengths.join('\n- ')}\n\n🐾 **คำแนะนำสไตล์แมว:**\n- ${resultData.advice}`)
                .setImage(randomImage)
                .setColor(0x3B82F6)
                .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
                .setFooter({ text: 'อยากรู้ว่าตัวเองเป็นแมวพันธุ์ไหน? กดปุ่มด้านล่างได้เลยเมี๊ยว! ✨' });

            const resultRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('mbti_start')
                    .setLabel('🧠 เริ่มทำแบบทดสอบบ้าง (12 ข้อ)')
                    .setStyle(ButtonStyle.Primary)
            );

            await i.channel.send({
                content: `✨ **ประกาศผล MBTI ของ <@${user.id}> เมี๊ยวว!**`,
                embeds: [resultEmbed],
                components: [resultRow]
            });

            await i.editReply({
                content: `✅ ส่งผลลัพธ์ไปที่แชนแนลเรียบร้อยแล้วนะเมี๊ยว! ไปแชร์ให้เพื่อนๆ ดูได้เลย!`,
                embeds: [],
                components: []
            });

            collector.stop();
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            interaction.editReply({ content: '⏰ หมดเวลาทำแบบทดสอบแล้วเมี๊ยว! ลองใหม่อีกครั้งนะ🐾', embeds: [], components: [] }).catch(() => { });
        }
    });
}

module.exports.startTest = startTest;
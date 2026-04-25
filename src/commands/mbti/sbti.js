const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

// โหลดข้อมูลจากไฟล์ JSON
const QUESTIONS = require('./SBTI_Question.json');
const SBTI_DATA = require('./SBTI.json');
const SBTI_IMAGES = require('./SBTI_IMAGES.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sbti')
        .setDescription('🐾 แบบทดสอบ SBTI: ค้นหาตัวตนในแบบ PurrPaw')
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('✨ เปิดใช้งานปุ่มเริ่มทำแบบทดสอบ SBTI ในห้องนี้ (Admin เท่านั้นเมี๊ยว)'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('🚫 ปิดใช้งานระบบ SBTI ในเซิร์ฟเวอร์นี้ (Admin เท่านั้นเมี๊ยว)'))
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('🧠 เริ่มทำแบบทดสอบ SBTI 12 ข้อทันทีเมี๊ยว!')),

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
            // รวบรวมรูปภาพทั้งหมด (กรอง place-holder ออก) เพื่อสุ่มแสดงหน้าปก🐾
            const allImages = Object.values(SBTI_IMAGES).flat().filter(url => url !== 'place-holder');
            const randomCover = allImages[Math.floor(Math.random() * allImages.length)] || 'https://s.showimg.link/IcLHujxdqW.webp';

            const embed = new EmbedBuilder()
                .setTitle('🐾 PurrPaw SBTI Test')
                .setDescription('**คุณเป็นคนประเภทไหนใน 27 สไตล์ของ PurrPaw?**\nมาลองทำแบบทดสอบสั้นๆ 12 ข้อเพื่อค้นหาตัวตนที่แท้จริงของคุณกัน!\n\n*กดปุ่มด้านล่างเพื่อเริ่มทำแบบทดสอบ*')
                .setColor(0xF472B6)
                .setImage(randomCover)
                .setFooter({ text: 'ค้นหาตัวตนของคุณผ่านอุ้งเท้าวิเศษ... ✨' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('sbti_start')
                    .setLabel('🧠 เริ่มทำแบบทดสอบ (12 ข้อ)')
                    .setStyle(ButtonStyle.Success)
            );

            let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
            const features = guildData?.features || {};
            features.sbti = true;
            await supabase.from('guilds').upsert({ id: guildId, features: features });

            await interaction.reply({ content: '✅ เปิดระบบ SBTI เรียบร้อยแล้วเมี๊ยวว!', ephemeral: true });
            return await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (sub === 'disable') {
            let { data: guildData } = await supabase.from('guilds').select('features').eq('id', guildId).single();
            const features = guildData?.features || {};
            features.sbti = false;
            await supabase.from('guilds').upsert({ id: guildId, features: features });
            return await interaction.reply({ content: '❌ ปิดระบบ SBTI เรียบร้อยแล้วเมี๊ยว...', ephemeral: true });
        }

        if (sub === 'start') {
            return await startTest(interaction);
        }
    }
};

async function startTest(interaction) {
    const user = interaction.user;
    let currentIdx = 0;
    
    // ระบบคะแนนแบบ Vote สำหรับ 27 types
    const scores = {};

    const getEmbed = (idx) => {
        const q = QUESTIONS[idx];
        const progress = Math.round(((idx) / QUESTIONS.length) * 100);
        const filled = Math.round((idx / QUESTIONS.length) * 10);
        const bar = '🌸'.repeat(filled) + '⬜'.repeat(10 - filled);

        return new EmbedBuilder()
            .setTitle(`🐾 แบบทดสอบ SBTI: ข้อที่ ${idx + 1}/${QUESTIONS.length}`)
            .setDescription(`${bar} ${progress}%\n\n🐾 **คำถาม:** ${q.text}`)
            .setColor(0xF472B6)
            .setFooter({ text: 'เลือกสิ่งที่ตรงกับตัวคุณมากที่สุดนะเมี๊ยว! 🐾' });
    };

    const getRows = (idx) => {
        const q = QUESTIONS[idx];
        const rows = [];
        for (let r = 0; r < 2; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < 2; c++) {
                const i = r * 2 + c;
                if (i < q.options.length) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`sbti_ans:${idx}:${i}`)
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

        // เพิ่มคะแนนให้ Types ที่เกี่ยวข้อง
        opt.types.forEach(type => {
            scores[type] = (scores[type] || 0) + 1;
        });
        
        currentIdx++;

        if (currentIdx < QUESTIONS.length) {
            await i.update({
                embeds: [getEmbed(currentIdx)],
                components: getRows(currentIdx)
            });
        } else {
            // คำนวณผลลัพธ์: เลือก Type ที่ได้คะแนนสูงสุด
            const sortedTypes = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            const sbtiResult = sortedTypes.length > 0 ? sortedTypes[0][0] : "OG8K";

            await i.update({
                content: `🐾 **ประมวลผลเสร็จแล้วเมี๊ยว!** กำลังสรุปตัวตนของคุณ... ✨`,
                embeds: [],
                components: []
            });

            // 📝 บันทึกผลลงฐานข้อมูล
            await supabase.from('user_profiles').upsert({
                user_id: user.id,
                sbti: sbtiResult
            });

            const resultData = SBTI_DATA[sbtiResult] || SBTI_DATA["OG8K"];

            // ดึงรูปภาพแบบสุ่มจาก SBTI_IMAGES.json
            const images = SBTI_IMAGES[sbtiResult] || ["https://s.showimg.link/XMJwqN8ofy.webp"];
            const randomImage = images[Math.floor(Math.random() * images.length)];

            const resultEmbed = new EmbedBuilder()
                .setTitle(`${resultData.emoji} ผลทดสอบ SBTI: ${resultData.title}`)
                .setDescription(`🐱 **คุณคือ: ${resultData.cat_type}**\n\n${resultData.description}\n\n🌟 **จุดเด่นของคุณ:**\n- ${resultData.strengths.join('\n- ')}\n\n🐾 **คำแนะนำสไตล์แมว:**\n- ${resultData.advice}`)
                .setImage(randomImage)
                .setColor(0xF472B6)
                .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
                .setFooter({ text: 'อยากรู้ว่าตัวเองเป็นแมวพันธุ์ไหน? กดปุ่มด้านล่างได้เลยเมี๊ยว! ✨' });

            const resultRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('sbti_start')
                    .setLabel('🧠 ทำแบบทดสอบ SBTI บ้าง (12 ข้อ)')
                    .setStyle(ButtonStyle.Success)
            );

            await i.channel.send({
                content: `✨ **ประกาศผล SBTI ของ <@${user.id}> เมี๊ยวว!**`,
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

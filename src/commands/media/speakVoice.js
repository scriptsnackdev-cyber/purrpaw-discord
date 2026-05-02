const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');
const axios = require('axios');
const { Readable } = require('stream');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('speak-voice')
        .setDescription('🎙️ ส่งข้อความเสียงในนามตัวละคร AI เมี๊ยว🐾')
        .addStringOption(opt => 
            opt.setName('character')
                .setDescription('เลือกตัวละครที่จะสวมบทบาทเมี๊ยว')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(opt =>
            opt.setName('text')
                .setDescription('ข้อความที่ต้องการให้พูดเมี๊ยว')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('voice_id')
                .setDescription('ใส่ Voice ID จาก ElevenLabs (ถ้าไม่ใส่จะใช้เสียงเริ่มต้นของระบบ)เมี๊ยว')
                .setAutocomplete(true)),

    async execute(interaction) {
        const charId = interaction.options.getString('character');
        const text = interaction.options.getString('text');
        const manualVoiceId = interaction.options.getString('voice_id');
        const { guild, channel, client } = interaction;

        await interaction.deferReply({ flags: 64 }); // Ephemeral defer

        try {
            // 1. ดึงข้อมูลตัวละครจาก Supabase
            const { data: char, error: charError } = await supabase
                .from('ai_characters')
                .select('*')
                .eq('id', charId)
                .single();

            if (charError || !char) {
                return interaction.editReply('❌ ไม่พบข้อมูลตัวละครนี้ในเซิร์ฟเวอร์นะเมี๊ยว!');
            }

            // 2. เตรียม Voice ID
            // ถ้าไม่ได้ระบุ ให้ดึงจาก settings ของเซิร์ฟเวอร์
            let voiceId = manualVoiceId;
            if (!voiceId) {
                const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
                voiceId = guildData?.settings?.tts_voice || "21m00Tcm4TlvDq8ikWAM"; // Default Rachel
            }

            // 3. เจนเสียงจาก ElevenLabs
            if (!process.env.ELEVEN_API_KEY) {
                return interaction.editReply('❌ ระบบไม่ได้ตั้งค่า ElevenLabs API Key ไว้เมี๊ยว!');
            }

            const response = await axios({
                method: 'post',
                url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': process.env.ELEVEN_API_KEY,
                    'Content-Type': 'application/json',
                },
                data: {
                    text: text,
                    model_id: "eleven_v3",
                    voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0 }
                },
                responseType: 'arraybuffer'
            });

            const audioBuffer = Buffer.from(response.data);
            const attachment = new AttachmentBuilder(audioBuffer, { name: `${char.name}_voice.mp3` });

            // 4. ส่งข้อความทดสอบ (Ephemeral) พร้อมปุ่มยืนยัน
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🎙️ ทดสอบเสียง: ${char.name}`)
                .setDescription(`**ข้อความ:** ${text}\n**Voice ID:** \`${voiceId}\``)
                .setFooter({ text: 'กด "ยืนยันการส่ง" เพื่อส่งข้อความนี้เข้าห้องแชทเมี๊ยว🐾' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_voice_${interaction.id}`)
                    .setLabel('ยืนยันการส่ง ✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`cancel_voice_${interaction.id}`)
                    .setLabel('ยกเลิก ❌')
                    .setStyle(ButtonStyle.Danger)
            );

            const previewMessage = await interaction.editReply({
                embeds: [embed],
                files: [attachment],
                components: [row]
            });

            // 5. รอการตอบรับจากปุ่ม (Collector)
            const collector = previewMessage.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 60000 // ให้เวลา 1 นาทีในการตัดสินใจ
            });

            collector.on('collect', async i => {
                if (i.customId.startsWith('cancel_voice')) {
                    await i.update({ content: '🚫 ยกเลิกการส่งแล้วเมี๊ยว!', embeds: [], files: [], components: [] });
                    return collector.stop();
                }

                if (i.customId.startsWith('confirm_voice')) {
                    await i.update({ content: '⏳ กำลังส่งข้อความเสียงเมี๊ยว...', embeds: [], files: [], components: [] });
                    
                    try {
                        // ── ส่งผ่าน Webhook ──
                        const webhooks = await channel.fetchWebhooks();
                        let webhook = webhooks.find(wh => wh.name === 'PurrPaw Speak');
                        if (!webhook) {
                            webhook = await channel.createWebhook({ name: 'PurrPaw Speak', avatar: client.user.displayAvatarURL() });
                        }

                        await webhook.send({
                            content: text,
                            username: char.name,
                            avatarURL: char.image_url,
                            files: [attachment]
                        });

                        await i.editReply({ content: '✅ ส่งข้อความเสียงสำเร็จแล้วเมี๊ยวว! ✨', components: [] });
                    } catch (error) {
                        console.error('Confirm Voice Error:', error);
                        await i.editReply({ content: `❌ เกิดข้อผิดพลาดในการส่ง: ${error.message}`, components: [] });
                    }
                    collector.stop();
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    interaction.editReply({ content: '⏰ หมดเวลาการยืนยันแล้วเมี๊ยว!', components: [] });
                }
            });

        } catch (error) {
            console.error('Speak Voice Error:', error);
            const errorMessage = error.response?.data?.toString() || error.message;
            await interaction.editReply(`❌ เกิดข้อผิดพลาดเมี๊ยว: ${errorMessage}`);
        }
    },

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const focusedValue = focusedOption.value.toLowerCase();

        if (focusedOption.name === 'character') {
            try {
                const { data: characters } = await supabase
                    .from('ai_characters')
                    .select('id, name')
                    .eq('guild_id', interaction.guildId);

                const choices = characters
                    .filter(c => c.name.toLowerCase().includes(focusedValue))
                    .slice(0, 25)
                    .map(c => ({ name: c.name, value: c.id }));

                await interaction.respond(choices);
            } catch (error) {
                console.error('Character Autocomplete Error:', error);
                await interaction.respond([]);
            }
        }

        if (focusedOption.name === 'voice_id') {
            try {
                const apiKey = process.env.ELEVEN_API_KEY;
                if (!apiKey) return interaction.respond([]);

                const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
                    headers: { 'xi-api-key': apiKey }
                });

                const choices = response.data.voices
                    .filter(v => v.name.toLowerCase().includes(focusedValue))
                    .slice(0, 25)
                    .map(v => ({ name: `${v.name} (${v.labels?.gender || 'General'})`, value: v.voice_id }));

                await interaction.respond(choices);
            } catch (error) {
                console.error('Voice Autocomplete Error:', error);
                await interaction.respond([]);
            }
        }
    }
};

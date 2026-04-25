const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');
const axios = require('axios');

const VOICE_DETAILS = require('../../utils/voice_details.json');
const VOICE_RECOMMEND = require('../../utils/voice_recommend.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tts')
        .setDescription('🎙️ ระบบแจ้งเตือนด้วยเสียง (Text-to-Speech) เมี๊ยว🐾')

        // ── เพิ่มบอท TTS เข้าห้องเสียง ──
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('🎙️ เพิ่มบอทเข้าห้องเสียงเพื่อเริ่มระบบเสียงเมี๊ยว🐾'))

        // ── เอาบอท TTS ออกจากห้องเสียง ──
        .addSubcommand(sub =>
            sub.setName('leave')
                .setDescription('👋 สั่งให้บอทเลิกพูดและออกจากห้องเมี๊ยว🐾'))

        // ── จัดการ Premium ──
        .addSubcommandGroup(group =>
            group.setName('premium')
                .setDescription('✨ ตั้งค่าโหมดพรีเมียมของพ่อค้าเมี๊ยว🐾')
                .addSubcommand(sub =>
                    sub.setName('enable')
                        .setDescription('🔓 เปิดใช้งานโหมด Premium สำหรับ TTS ในเซิร์ฟเวอร์นี้เมี๊ยว🐾'))
                .addSubcommand(sub =>
                    sub.setName('disable')
                        .setDescription('🔒 ปิดใช้งานโหมด Premium เมี๊ยว🐾'))
                .addSubcommand(sub =>
                    sub.setName('limit')
                        .setDescription('💰 ตั้งค่าจำกัดงบประมาณรายวันของ TTS (THB) เมี๊ยว🐾')
                        .addIntegerOption(opt =>
                            opt.setName('thb').setDescription('จำนวนบาทที่จำกัดต่อวันเมี๊ยว').setRequired(true).setMinValue(1)))
                .addSubcommand(sub =>
                    sub.setName('setvoice')
                        .setDescription('🎤 เลือกเสียงพรีเมียมที่ต้องการใช้เมี๊ยว🐾')
                        .addStringOption(opt =>
                            opt.setName('voice').setDescription('พิมพ์ชื่อเสียงเพื่อค้นหาเมี๊ยว🐾').setRequired(true).setAutocomplete(true)))
                .addSubcommand(sub =>
                    sub.setName('setcustom')
                        .setDescription('🎤 ใส่รหัส Voice ID ที่ต้องการด้วยตัวเองเมี๊ยว🐾')
                        .addStringOption(opt =>
                            opt.setName('id').setDescription('รหัส Voice ID จากหน้าเว็บ ElevenLabs เมี๊ยว🐾').setRequired(true)))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();
        const { member, guild, client, channel } = interaction;

        // ────────────────────────────────
        // ✨ PREMIUM LOGIC
        // ────────────────────────────────
        if (group === 'premium') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ **Manage Server** ก่อนนะเมี๊ยว!', flags: 64 });
            }

            // ⭐ Defer reply เพื่อป้องกัน Timeout เนื่องจากมีการเรียก API ภายนอกเมี๊ยว🐾
            await interaction.deferReply({ flags: 64 });

            // 1. ดึง settings ปัจจุบันมา
            const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guild.id).single();
            const currentSettings = guildData?.settings || {};

            if (sub === 'enable' || sub === 'disable') {
                const isEnable = sub === 'enable';

                // 2. อัปเดต settings JSON
                const updatedSettings = {
                    ...currentSettings,
                    tts_premium_enabled: isEnable
                };

                const { error } = await supabase
                    .from('guilds')
                    .update({ settings: updatedSettings })
                    .eq('id', guild.id);

                if (error) return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลเมี๊ยว!' });

                return interaction.editReply({
                    content: `✨ โหมด Premium TTS ถูก **${isEnable ? 'เปิด' : 'ปิด'}** เรียบร้อยแล้วนะเมี๊ยวว!🐾`
                });
            }

            if (sub === 'limit') {
                const limit = interaction.options.getInteger('thb');

                // 2. อัปเดต settings JSON
                const updatedSettings = {
                    ...currentSettings,
                    tts_premium_limit_thb: limit
                };

                const { error } = await supabase
                    .from('guilds')
                    .update({ settings: updatedSettings })
                    .eq('id', guild.id);

                if (error) return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลเมี๊ยว!' });

                return interaction.editReply({
                    content: `💰 ตั้งค่าจำกัดการใช้งาน TTS รายวันเป็น **${limit} บาท** สำเร็จแล้วเมี๊ยว!🐾`
                });
            }

            if (sub === 'setvoice') {
                const voiceId = interaction.options.getString('voice');

                // ค้นหาชื่อเสียงเพื่อให้การตอบกลับดูดีขึ้นเมี๊ยว🐾
                let displayName = voiceId;
                const apiKey = process.env.ELEVEN_API_KEY;
                if (apiKey) {
                    try {
                        const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
                            headers: { 'xi-api-key': apiKey }
                        });
                        const voice = response.data.voices.find(v => v.voice_id === voiceId);
                        if (voice) {
                            const detail = VOICE_DETAILS[voiceId];
                            if (detail) {
                                displayName = `${voice.name} (${detail.desc})`;
                            } else {
                                displayName = voice.name;
                            }
                        }
                    } catch (e) {
                        console.error('Fetch Voice Name Error:', e.message);
                    }
                }

                // 2. อัปเดต settings JSON
                const updatedSettings = {
                    ...currentSettings,
                    tts_voice: voiceId
                };

                const { error } = await supabase
                    .from('guilds')
                    .update({ settings: updatedSettings })
                    .eq('id', guild.id);

                if (error) return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลเมี๊ยว!' });

                return interaction.editReply({
                    content: `🎤 เปลี่ยนเสียง TTS เป็น **${displayName}** เรียบร้อยแล้วนะเมี๊ยวว!🐾`
                });
            }

            if (sub === 'setcustom') {
                const voiceId = interaction.options.getString('id');

                // 2. อัปเดต settings JSON
                const updatedSettings = {
                    ...currentSettings,
                    tts_voice: voiceId
                };

                const { error } = await supabase
                    .from('guilds')
                    .update({ settings: updatedSettings })
                    .eq('id', guild.id);

                if (error) return interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลเมี๊ยว!' });

                return interaction.editReply({
                    content: `🎤 เปลี่ยนเสียง TTS เป็นรหัสกำหนดเอง (**${voiceId}**) สำเร็จแล้วนะเมี๊ยวว!🐾`
                });
            }
        }

        // ────────────────────────────────
        // 🎙️ TTS ADD / LEAVE
        // ────────────────────────────────
        if (sub === 'add') {
            if (!member.voice.channel) {
                return interaction.reply({ content: '❌ คุณต้องเข้าห้องพูดคุยก่อนนะเเมี๊ยว!', flags: 64 });
            }

            try {
                // เข้าร่วมห้องเดียวกับที่เพลงใช้อยู่
                await client.distube.voices.join(member.voice.channel);

                // บันทึกแชนแนลที่บอทต้อง "ฟัง" ข้อความ
                client.ttsManager.ttsChannels.set(guild.id, channel.id);

                const embed = new EmbedBuilder()
                    .setColor(0x22C55E)
                    .setTitle('🎙️ ระบบ TTS เริ่มทำงานแล้วเมี๊ยว!')
                    .setDescription(`บอทจะอ่านข้อความที่ถูกส่งในห้อง <#${channel.id}> ออกทางห้องพูดคุย\n\n**หมายเหตุ:** หากเปิดเพลงอยู่ ระบบจะลดเสียงเพลงลงขณะพูด (Ducking Mode) อัตโนมัติเมี๊ยว🐾`)
                    .setFooter({ text: 'ใช้ /tts leave เพื่อปิดระบบนะเมี๊ยว🐾' });

                return interaction.reply({ embeds: [embed] });
            } catch (err) {
                console.error('TTS Add Error:', err);
                return interaction.reply({ content: '❌ ไม่สามารถเข้าร่วมห้องเสียงได้เมี๊ยว...', flags: 64 });
            }
        }

        if (sub === 'leave') {
            client.ttsManager.ttsChannels.delete(guild.id);
            const voice = client.distube.voices.get(guild.id);
            const queue = client.distube.getQueue(guild.id);

            let message = '🎙️ ปิดระบบ TTS เรียบร้อยแล้วเมี๊ยว!';

            if (voice) {
                // ถ้าไม่มีเพลงเล่นอยู่เลย ถึงจะสั่งให้ออกจากห้องเมี๊ยว🐾
                if (!queue) {
                    await voice.leave();
                    message = '👋 บิดไมค์ เลิกพ่นไฟและออกจากห้องแล้วเมี๊ยว!🐾🌸';
                } else {
                    message = '🎙️ ปิดระบบ TTS ของห้องนี้แล้ว แต่เพลงยังคงบรรเลงต่อนะเมี๊ยวว!🐾🎶';
                }
            }

            return interaction.reply(message);
        }
    },

    async autocomplete(interaction) {
        let focusedValue = interaction.options.getFocused().toLowerCase();
        let genderFilter = null;

        // 🔍 ตรวจสอบคำนำหน้าเพื่อกรองเพศเมี๊ยว🐾
        if (focusedValue.startsWith('male:') || focusedValue.startsWith('ชาย:')) {
            genderFilter = 'male';
            focusedValue = focusedValue.split(':')[1].trim();
        } else if (focusedValue.startsWith('female:') || focusedValue.startsWith('หญิง:')) {
            genderFilter = 'female';
            focusedValue = focusedValue.split(':')[1].trim();
        }

        try {
            const apiKey = process.env.ELEVEN_API_KEY;
            if (!apiKey) return interaction.respond([]);

            const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': apiKey }
            });

            const voices = response.data.voices;

            // กรองและสร้างตัวเลือกเมี๊ยว🐾
            const choices = voices
                .filter(voice => {
                    const detail = VOICE_DETAILS[voice.voice_id];
                    const gender = detail ? detail.gender : voice.labels?.gender;

                    // 1. กรองเพศเมี๊ยว🐾
                    if (genderFilter && gender !== genderFilter) return false;

                    // 2. กรองคำค้นหาเมี๊ยว🐾
                    if (focusedValue && !voice.name.toLowerCase().includes(focusedValue)) return false;

                    // 3. ถ้าไม่ได้พิมพ์อะไรเลย ให้แสดงเฉพาะตัวแนะนำเมี๊ยว🐾
                    if (!focusedValue && !genderFilter && !VOICE_RECOMMEND.some(v => v.id === voice.voice_id)) return false;

                    return true;
                })
                .sort((a, b) => {
                    // เรียง: ชาย > หญิง > ทั่วไป
                    const getOrder = (vId) => {
                        const detail = VOICE_DETAILS[vId];
                        const gender = detail ? detail.gender : 'general';
                        if (gender === 'male') return 1;
                        if (gender === 'female') return 2;
                        return 3;
                    };
                    return getOrder(a.voice_id) - getOrder(b.voice_id);
                })
                .slice(0, 25)
                .map(voice => {
                    const detail = VOICE_DETAILS[voice.voice_id];
                    const gender = detail ? detail.gender : voice.labels?.gender;
                    const desc = detail ? detail.desc : (voice.labels?.description || "ไม่มีคำอธิบาย");

                    let typeLabel = "[GENERAL]";
                    if (gender === "male") typeLabel = "[MALE]";
                    else if (gender === "female") typeLabel = "[FEMALE]";

                    return {
                        name: `${typeLabel} - ${voice.name} | ${desc}`,
                        value: voice.voice_id
                    };
                });

            await interaction.respond(choices);
        } catch (error) {
            console.error('Autocomplete Error:', error.message);
            await interaction.respond([]);
        }
    },
};

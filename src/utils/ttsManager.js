const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const supabase = require('../supabaseClient');
const dayjs = require('dayjs');
const { OpenAI } = require('openai');
const { Readable } = require('stream');
const axios = require('axios');
const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined,
    defaultHeaders: {
        "HTTP-Referer": "https://purrpaw.bot",
        "X-Title": "PurrPaw Discord Bot",
    }
});

class TTSManager {
    constructor(client) {
        this.client = client;
        this.ttsChannels = new Map(); 
        this.queues = new Map();      
        this.processing = new Map();  
        this.notifiedHistory = new Map(); 
        this.charCostTHB = 0.006; 
    }

    async speak(guildId, text) {
        if (!text) return;

        // 1. ลบ Discord Emojis (<:name:id> หรือ <a:name:id>)
        let cleanText = text.replace(/<a?:\w+:\d+>/g, '');

        // 2. ลบ Unicode Emojis 
        // ใช้ Regex ครอบคลุมช่วง Emoji ยอดนิยมเมี๊ยว🐾
        cleanText = cleanText.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu, '');

        // 3. ลบช่องว่างส่วนเกิน
        cleanText = cleanText.trim();

        // 4. ถ้าลบแล้วไม่เหลือข้อความให้อ่าน (เช่น มีแต่ Emoji) ให้ข้ามไปเลยเมี๊ยว🐾
        if (!cleanText) return;

        if (!this.queues.has(guildId)) this.queues.set(guildId, []);
        this.queues.get(guildId).push(cleanText);
        if (!this.processing.get(guildId)) {
            this.processQueue(guildId);
        }
    }

    async processQueue(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || queue.length === 0) {
            this.processing.set(guildId, false);
            return;
        }

        this.processing.set(guildId, true);
        const text = queue.shift();

        const distube = this.client.distube;
        const dQueue = distube.getQueue(guildId);
        const voice = distube.voices.get(guildId);
        if (!voice || !voice.connection) {
            this.processing.set(guildId, false);
            return;
        }

        try {
            const { data: guildData } = await supabase.from('guilds').select('settings, balance_thb').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            const currentBalance = guildData?.balance_thb || 0;
            const today = dayjs().format('YYYY-MM-DD');
            
            const premiumEnabled = settings.tts_premium_enabled || false;
            const cost = text.length * this.charCostTHB;

            let resource;
            let usedPremium = false;

            let oldVolume = 100;
            if (dQueue) {
                oldVolume = dQueue.volume;
                dQueue.setVolume(15);
            }

            if (premiumEnabled && currentBalance >= cost && process.env.ELEVEN_API_KEY) {
                try {
                    const voiceId = settings.tts_voice || "21m00Tcm4TlvDq8ikWAM";
                    console.log(`[TTS-Debug] Sending text to ElevenLabs: "${text}"`);
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
                    resource = createAudioResource(Readable.from(Buffer.from(response.data)));
                    usedPremium = true;
                } catch (err) {
                    console.error('[TTS-Debug] ElevenLabs Error:', err.message);
                }
            }

            if (!usedPremium) {
                const url = googleTTS.getAudioUrl(text.slice(0, 200), {
                    lang: 'th', host: 'https://translate.google.com'
                });
                resource = createAudioResource(url);
            }

            const player = createAudioPlayer();
            voice.connection.subscribe(player);
            player.play(resource);

            await new Promise((resolve) => {
                const t = setTimeout(() => { player.stop(); resolve(); }, 30000);
                player.on(AudioPlayerStatus.Idle, () => { clearTimeout(t); resolve(); });
                player.on('error', () => { clearTimeout(t); resolve(); });
            });

            if (usedPremium) {
                await supabase.from('tts_usage_logs').insert({ guild_id: guildId, characters_count: text.length, cost_thb: cost });
                await supabase.from('guilds').update({ balance_thb: currentBalance - cost }).eq('id', guildId);
            }

            if (dQueue) dQueue.setVolume(oldVolume);
            if (voice.audioPlayer) voice.connection.subscribe(voice.audioPlayer);

        } catch (error) {
            console.error('TTS Error:', error);
        } finally {
            this.processQueue(guildId);
        }
    }
}

module.exports = TTSManager;

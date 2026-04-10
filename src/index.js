require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { DisTube, Song } = require('distube');
const TTSManager = require('./utils/ttsManager');

const execFileAsync = promisify(execFile);

// ── Path ของ yt-dlp ──
const isWindows = process.platform === 'win32';
const YTDLP_PATH = isWindows 
    ? path.join(__dirname, '..', 'yt-dlp.exe') 
    : 'yt-dlp';

console.log(`🎵 yt-dlp path: ${YTDLP_PATH} (System: ${process.platform})`);
if (isWindows && !fs.existsSync(YTDLP_PATH)) {
    console.warn(`[WARNING] yt-dlp.exe not found at ${YTDLP_PATH}`);
}

// ── Helper: เรียก yt-dlp แล้วรับ JSON กลับมา (มี timeout 30 วินาที) ──
async function ytdlp(args) {
    const { stdout } = await execFileAsync(YTDLP_PATH, args, {
        timeout: 30000,             // 30 วินาที ถ้านานกว่านี้ kill process
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        windowsHide: true,
    });
    return JSON.parse(stdout);
}

// ── Custom yt-dlp Plugin สำหรับ DisTube v5 ──
const ytdlpPlugin = {
    type: 'extractor',  // ← ทั้ง search + resolve + stream
    name: 'yt-dlp-custom',

    init() {},

    async validate(url) {
        return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.youtube.com');
    },

    // ── เปิดเพลงจาก URL ──
    async resolve(url, options = {}) {
        // ตัด playlist param ออกเสมอ ป้องกันค้าง
        const cleanUrl = url.replace(/[?&]list=[^&]*/g, '').replace(/[?&]index=[^&]*/g, '');
        console.log(`[yt-dlp] Resolving: ${cleanUrl}`);

        const info = await ytdlp([
            '--dump-single-json', '--no-warnings', '--no-call-home',
            '--skip-download', '--simulate', '--no-playlist',
            cleanUrl,
        ]);

        return new Song({
            plugin: ytdlpPlugin,
            source: 'youtube',
            playFromSource: true,
            id: info.id,
            name: info.title || info.fulltitle,
            url: info.webpage_url || info.original_url,
            duration: info.is_live ? 0 : (info.duration || 0),
            isLive: info.is_live || false,
            thumbnail: info.thumbnail,
            views: info.view_count || 0,
            likes: info.like_count || 0,
            uploader: { name: info.uploader || 'Unknown', url: info.uploader_url || '' },
        }, { member: options.member, metadata: options.metadata });
    },

    // ── ค้นหาเพลงจากชื่อ ──
    async searchSong(query, options = {}) {
        console.log(`[yt-dlp] Searching: ${query}`);
        try {
            const info = await ytdlp([
                '--dump-single-json', '--no-warnings', '--no-call-home',
                '--skip-download', '--simulate', '--no-playlist',
                '--flat-playlist',
                `ytsearch1:${query}`,
            ]);

            // ytsearch ส่ง { entries: [...] } กลับมา
            const entry = info.entries?.[0] || info;
            if (!entry || !entry.id) return null;

            const videoUrl = entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`;

            return new Song({
                plugin: ytdlpPlugin,
                source: 'youtube',
                playFromSource: true,
                id: entry.id,
                name: entry.title || 'Unknown',
                url: videoUrl,
                duration: entry.duration || 0,
                isLive: entry.is_live || false,
                thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || null,
                views: entry.view_count || 0,
                uploader: { name: entry.uploader || entry.channel || 'Unknown', url: entry.uploader_url || entry.channel_url || '' },
            }, { member: options.member, metadata: options.metadata });
        } catch (e) {
            console.error('[yt-dlp] Search error:', e.message);
            return null;
        }
    },

    // ── ดึง Stream URL สำหรับ FFmpeg ──
    async getStreamURL(song) {
        console.log(`[yt-dlp] Getting stream URL: ${song.url}`);
        const info = await ytdlp([
            '--dump-single-json', '--no-warnings', '--no-call-home',
            '--skip-download', '--simulate', '--no-playlist',
            '--format', 'ba/ba*',  // best audio only
            song.url,
        ]);
        console.log(`[yt-dlp] Got stream URL ✅`);
        return info.url;
    },

    // ── ดึงเพลงแนะนำสำหรับ Autoplay ──
    async getRelatedSongs(song) {
        try {
            console.log(`[yt-dlp] Getting related songs for: ${song.name}`);
            const videoId = song.id || new URL(song.url).searchParams.get('v');
            if (!videoId) return [];

            // ใช้ YouTube Mix (RD playlist) เพื่อดึงเพลงแนะนำ
            const info = await ytdlp([
                '--dump-single-json', '--no-warnings', '--no-call-home',
                '--skip-download', '--simulate',
                '--flat-playlist',
                '--playlist-end', '6',  // ดึงแค่ 6 เพลง (เพลงแรกคือเพลงปัจจุบัน)
                `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`,
            ]);

            const entries = (info.entries || [])
                .filter(e => e.id !== videoId)  // ข้ามเพลงปัจจุบัน
                .slice(0, 5);

            return entries.map(e => new Song({
                plugin: ytdlpPlugin,
                source: 'youtube',
                playFromSource: true,
                id: e.id,
                name: e.title || 'Unknown',
                url: e.webpage_url || e.url || `https://www.youtube.com/watch?v=${e.id}`,
                duration: e.duration || 0,
                thumbnail: e.thumbnail || e.thumbnails?.[0]?.url || null,
                uploader: { name: e.uploader || e.channel || 'Unknown', url: e.uploader_url || '' },
            }));
        } catch (e) {
            console.error('[yt-dlp] Related songs error:', e.message);
            return [];
        }
    },
};

// ──────────────────────────────────────────────────────
// Discord Client + DisTube Setup
// ──────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

client.distube = new DisTube(client, {
    ffmpeg: { path: require('@ffmpeg-installer/ffmpeg').path },
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    plugins: [ytdlpPlugin],
});

// ── TTS Manager ──
client.ttsManager = new TTSManager(client);

client.commands = new Collection();
const handlerFiles = fs.readdirSync('./src/handlers').filter(file => file.endsWith('.js'));
for (const file of handlerFiles) {
    require(`./handlers/${file}`)(client);
}

client.login(process.env.DISCORD_TOKEN);

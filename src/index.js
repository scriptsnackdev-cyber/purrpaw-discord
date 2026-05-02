require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { DisTube, Song } = require('distube');
const TTSManager = require('./utils/ttsManager');
const supabase = require('./supabaseClient');
const { initDailyScheduler } = require('./utils/dailyScheduler');
const { registerSystemFonts } = require('./utils/fontHelper');

// 🎨 ลงทะเบียนฟอนต์สำหรับทั้งระบบเมี๊ยว🐾
registerSystemFonts();

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
// ── Helper: เรียก yt-dlp แล้วรับ JSON กลับมา (มี timeout 30 วินาที) ──
async function ytdlp(args, useCookie = true) {
    const finalArgs = [...args];
    
    // ถ้ามี Cookie ใน .env และต้องการใช้ ให้ส่งไปด้วยเมี๊ยว🐾
    if (useCookie && process.env.YOUTUBE_COOKIE) {
        finalArgs.push('--add-header', `Cookie:${process.env.YOUTUBE_COOKIE}`);
    }

    // เพิ่ม flag พื้นฐานเพื่อความเสถียรเมี๊ยว🐾
    finalArgs.push('--no-check-certificates');

    try {
        const { stdout } = await execFileAsync(YTDLP_PATH, finalArgs, {
            timeout: 30000,             // 30 วินาที ถ้านานกว่านี้ kill process
            maxBuffer: 1024 * 1024 * 50, // 50MB buffer
            windowsHide: true,
        });
        
        if (!stdout || !stdout.trim()) {
            throw new Error('yt-dlp returned empty output');
        }

        return JSON.parse(stdout);
    } catch (err) {
        // 🚨 ถ้าล้มเหลวขณะใช้ Cookie ให้ลองอีกครั้งแบบไม่ใช้ Cookie เมี๊ยว🐾
        // (หลายครั้งที่ Cookie หมดอายุหรือโดน YouTube บล็อกแบบเจาะจงบัญชี)
        if (useCookie && process.env.YOUTUBE_COOKIE) {
            console.warn(`[yt-dlp] Failed with cookie, retrying without cookie... Error: ${err.message}`);
            return ytdlp(args, false);
        }
        
        throw err;
    }
}

// ── Custom yt-dlp Plugin สำหรับ DisTube v5 ──
const ytdlpPlugin = {
    type: 'extractor',  // ← ทั้ง search + resolve + stream
    name: 'yt-dlp-custom',

    init() {},

    async validate(url) {
        // ให้ Plugin นี้จัดการทั้งหมด (รวมถึงการ Search ด้วยชื่อเพลง) เมี๊ยว🐾
        return true;
    },

    // ── เปิดเพลงจาก URL ──
    async resolve(url, options = {}) {
        // ตัด playlist param ออกเสมอ ป้องกันค้าง
        const cleanUrl = url.replace(/[?&]list=[^&]*/g, '').replace(/[?&]index=[^&]*/g, '');
        console.log(`[yt-dlp] Resolving: ${cleanUrl}`);

        const info = await ytdlp([
            '--dump-single-json', '--no-warnings',
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
                '--dump-single-json', '--no-warnings',
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
            '--dump-single-json', '--no-warnings',
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
                '--dump-single-json', '--no-warnings',
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
        GatewayIntentBits.GuildPresences,
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
// 📂 โหลดคำสั่ง (Commands) จากโฟลเดอร์ย่อยเมี๊ยว🐾
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        if (fs.lstatSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                }
            }
        } else if (folder.endsWith('.js')) {
            const command = require(folderPath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            }
        }
    }
}

// 📂 โหลด Handlers เมี๊ยว🐾
const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
    const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));
    for (const file of handlerFiles) {
        require(`./handlers/${file}`)(client);
    }
}

// ── ระบบจัดการ AI Chat Cleanup & Private Room Cleanup ──
const { cleanupExpiredSessions } = require('./utils/aiCleanup');
const { cleanupPrivateRooms, warnPrivateRooms } = require('./utils/privateRoomCleanup');

const { REST, Routes } = require('discord.js');

client.once('clientReady', async () => {
    // 🚀 เริ่มทำงาน Dashboard UI เมี๊ยว🐾
    const { startDashboard, formatMessage } = require('./dashboard/server');
    startDashboard(client);

    // ── Real-time Dashboard Updates ──
    client.on('messageCreate', (message) => {
        if (client.dashboardIo) {
            client.dashboardIo.to(message.channel.id).emit('new_message', formatMessage(message));
        }
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
        if (client.dashboardIo && newState.guild.id) {
            // Tell dashboard to refresh channels for this guild
            client.dashboardIo.emit('voice_update', newState.guild.id);
        }
    });

    console.log(`✅ บอทออนไลน์แล้วเมี๊ยว: ${client.user.tag}`);
    
    // 🚀 ระบบอัปเดตคำสั่งอัตโนมัติราย Guild เมี๊ยว🐾
    try {
        const { data: allGuilds } = await supabase.from('guilds').select('id');
        if (allGuilds && allGuilds.length > 0) {
            const rest = new REST().setToken(process.env.DISCORD_TOKEN);
            const commandsJSON = Array.from(client.commands.values()).map(c => c.data.toJSON());
            
            console.log(`📡 กำลังอัปเดตคำสั่งให้ ${allGuilds.length} เซิร์ฟเวอร์... 🐾`);
            
            for (const g of allGuilds) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, g.id),
                    { body: commandsJSON }
                ).catch(err => console.error(`[Deploy] Failed for Guild ${g.id}:`, err.message));
            }
            console.log('✅ อัปเดตคำสั่งทุกเซิร์ฟเวอร์เรียบร้อยแล้วเมี๊ยวว! ✨');
        }
    } catch (err) {
        console.error('[Deploy] Error:', err);
    }

    // รัน Cleanup และแจ้งเตือน ทุกๆ 1 นาทีเมี๊ยว🐾
    setInterval(() => {
        cleanupExpiredSessions(client);
        cleanupPrivateRooms(client);
        warnPrivateRooms(client);
    }, 1000 * 60);
    
    // รันทันทีหนึ่งรอบตอนเปิดบอทเมี๊ยว🐾
    cleanupExpiredSessions(client);
    cleanupPrivateRooms(client);
    warnPrivateRooms(client);

    // เริ่มทำงาน Daily Scheduler เมี๊ยว🐾
    initDailyScheduler(client);
});

client.login(process.env.DISCORD_TOKEN);

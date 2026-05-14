require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { io } = require('socket.io-client');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const { DisTube, Song } = require('distube');
const ffmpegStatic = require('ffmpeg-static');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
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
    : (fs.existsSync(path.join(__dirname, '..', 'yt-dlp')) 
        ? path.join(__dirname, '..', 'yt-dlp') 
        : 'yt-dlp');

console.log(`🎵 yt-dlp path: ${YTDLP_PATH} (System: ${process.platform})`);

// ── Helper: เรียก yt-dlp ──
async function ytdlp(args, useCookie = true) {
    const finalArgs = [...args];
    if (useCookie) {
        const cookiePath = path.join(__dirname, '..', 'cookies.txt');
        if (fs.existsSync(cookiePath)) {
            finalArgs.push('--cookies', cookiePath);
        } else if (process.env.YOUTUBE_COOKIE) {
            finalArgs.push('--add-header', `Cookie:${process.env.YOUTUBE_COOKIE}`);
        }
    }
    finalArgs.push('--no-check-certificates', '--prefer-free-formats', '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');

    try {
        const { stdout } = await execFileAsync(YTDLP_PATH, finalArgs, {
            timeout: 30000,
            maxBuffer: 1024 * 1024 * 50,
            windowsHide: true,
        });
        return JSON.parse(stdout);
    } catch (err) {
        if (useCookie && process.env.YOUTUBE_COOKIE) return ytdlp(args, false);
        throw err;
    }
}

// ── Custom yt-dlp Plugin สำหรับ DisTube ──
const ytdlpPlugin = {
    type: 'extractor',
    name: 'yt-dlp-custom',
    init(distube) {
        this.distube = distube;
    },
    async validate(url) {
        return url.includes('youtube.com') || url.includes('youtu.be') || !url.startsWith('http');
    },
    async resolve(url, options = {}) {
        const cleanUrl = url.replace(/[?&]list=[^&]*/g, '').replace(/[?&]index=[^&]*/g, '');
        const info = await ytdlp(['--dump-single-json', '--no-warnings', '--skip-download', '--simulate', '--no-playlist', cleanUrl]);
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
            uploader: { name: info.uploader || 'Unknown', url: info.uploader_url || '' },
        }, { member: options.member });
    },
    async searchSong(query, options = {}) {
        try {
            const info = await ytdlp(['--dump-single-json', '--no-warnings', '--skip-download', '--simulate', '--no-playlist', '--flat-playlist', `ytsearch1:${query}`]);
            const entry = info.entries?.[0] || info;
            if (!entry || !entry.id) return null;
            return new Song({
                plugin: ytdlpPlugin,
                source: 'youtube',
                playFromSource: true,
                id: entry.id,
                name: entry.title || 'Unknown',
                url: entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                duration: entry.duration || 0,
                isLive: entry.is_live || false,
                thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || null,
                uploader: { name: entry.uploader || entry.channel || 'Unknown', url: '' },
            }, { member: options.member });
        } catch (e) { return null; }
    },
    async getStreamURL(song) {
        const info = await ytdlp(['--dump-single-json', '--no-warnings', '--skip-download', '--simulate', '--no-playlist', '--format', 'bestaudio/best', song.url]);
        return info.url;
    },
    async getRelatedSongs(song) {
        if (song.source !== 'youtube') return [];
        try {
            // ค้นหาเพลงที่คล้ายกับเพลงปัจจุบันเมี๊ยว🐾
            const results = await this.distube.search(song.name, { limit: 5 });
            return results.map(s => {
                s.plugin = ytdlpPlugin; // บังคับให้ใช้ Plugin ตัวนี้ในการเล่นต่อเมี๊ยว🐾
                return s;
            }).filter(s => s.id !== song.id);
        } catch (e) {
            return [];
        }
    }
};

const { YouTubePlugin } = require('@distube/youtube');

// ── Discord Client Setup ──
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

const ffmpegPaths = [
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    ffmpegInstaller?.path,
    ffmpegStatic || null,
].filter(Boolean);

const ffmpegPath = ffmpegPaths.find(p => fs.existsSync(p)) || 'ffmpeg';

client.distube = new DisTube(client, {
    ffmpeg: { path: ffmpegPath },
    emitNewSongOnly: true,
    plugins: [
        ytdlpPlugin, // ให้สิทธิ์ตัว Custom จัดการก่อนเพื่อเลี่ยงการโดนบล็อกเมี๊ยว🐾
        new YouTubePlugin() // ตัวนี้ช่วยเรื่องหาเพลง Related (Autoplay)
    ],
});

client.commands = new Collection();
client.ttsManager = new TTSManager(client);

// 📂 โหลดคำสั่ง
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(path.join(folderPath, file));
                if (command.data && command.execute) client.commands.set(command.data.name, command);
            }
        }
    }
}

// 📂 โหลด Handlers
const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
    fs.readdirSync(handlersPath).filter(f => f.endsWith('.js')).forEach(file => {
        require(`./handlers/${file}`)(client);
    });
}

// ── ระบบจัดการ AI Chat Cleanup & Private Room Cleanup ──
const { cleanupExpiredSessions } = require('./utils/aiCleanup');
const { cleanupPrivateRooms, warnPrivateRooms } = require('./utils/privateRoomCleanup');
const { cleanupExpiredBans } = require('./utils/banManager');
const { syncAllGuildProfiles } = require('./utils/profileSyncer');

client.once('clientReady', async () => {
    console.log(`✅ บอทออนไลน์แล้วเมี๊ยว: ${client.user.tag}`);
    
    // 🚀 Sync ข้อมูลโปรไฟล์จากห้องต่างๆ เมื่อเริ่มต้นระบบเมี๊ยว🐾
    syncAllGuildProfiles(client).catch(err => console.error('[ProfileSyncer] Startup error:', err));
    try {
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        const commandsJSON = Array.from(client.commands.values()).map(c => c.data.toJSON());
        const { data: allGuilds } = await supabase.from('guilds').select('id');
        if (allGuilds) {
            for (const g of allGuilds) {
                await rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: commandsJSON }).catch(() => {});
            }
        }
    } catch (err) {}
    
    // รัน Cleanup ทุกนาที
    setInterval(() => {
        cleanupExpiredSessions(client);
        cleanupPrivateRooms(client);
        warnPrivateRooms(client);
        cleanupExpiredBans(client);
    }, 1000 * 60);

    initDailyScheduler(client);
});

// 🌐 Socket.io Client Setup
const DASHBOARD_URL = process.env.WEB_BASE_URL || `http://localhost:${process.env.DASHBOARD_PORT || 3000}`;
const socket = io(DASHBOARD_URL, { reconnection: true });

client.emitMusicUpdate = (guildId) => {
    const q = client.distube.getQueue(guildId);
    if (!q || !q.songs.length) {
        socket.emit('music_update', { guildId, current: null, queue: [], paused: false, volume: 50, currentTime: 0 });
        return;
    }
    const s = q.songs[0];
    socket.emit('music_update', {
        guildId,
        current: { name: s.name, thumbnail: s.thumbnail, duration: s.duration, uploader: s.uploader?.name || 'Unknown', url: s.url },
        queue: q.songs.map(x => ({ name: x.name, thumbnail: x.thumbnail, duration: x.duration, member: x.member?.displayName || 'ทาสแมว' })),
        paused: q.paused, volume: q.volume, currentTime: q.currentTime,
        autoplay: q.autoplay // เพิ่มสถานะ Autoplay เมี๊ยว🐾
    });
};

socket.on('connect', () => {
    console.log(`✅ Connected to Dashboard Socket at ${DASHBOARD_URL}`);
    client.guilds.cache.forEach(g => socket.emit('join_guild', g.id));
});

// รับคำสั่งควบคุมเพลง
socket.on('bot_command', async (data) => {
    const { guildId, action, value } = data;
    const q = client.distube.getQueue(guildId);
    try {
        if (action === 'request_update') return client.emitMusicUpdate(guildId);
        if (!q && action !== 'play') return;
        switch (action) {
            case 'toggle': q.paused ? q.resume() : q.pause(); break;
            case 'skip': await q.skip().catch(() => q.stop()); break;
            case 'previous': await q.previous().catch(() => { }); break;
            case 'volume': q.setVolume(value); break;
            case 'seek': q.seek(value); break;
            case 'autoplay': q.toggleAutoplay(); break; // เพิ่มคำสั่งเปิด/ปิด Autoplay เมี๊ยว🐾
            case 'play':
                const g = client.guilds.cache.get(guildId);
                const vc = g.members.me.voice.channel || g.channels.cache.find(c => c.type === 2);
                if (vc) await client.distube.play(vc, value);
                break;
        }
        client.emitMusicUpdate(guildId);
    } catch (e) { console.error('[Socket] Error:', e); }
});

setInterval(() => {
    client.guilds.cache.forEach(g => {
        const q = client.distube.getQueue(g.id);
        // เฉพาะถ้าเล่นอยู่และไม่หยุดชั่วคราว ถึงจะส่งอัปเดตเมี๊ยว🐾
        if (q && !q.paused && q.songs.length > 0) client.emitMusicUpdate(g.id);
    });
}, 5000); // ปรับเป็น 5 วินาทีเพื่อลดโหลดเมี๊ยว🐾


client.login(process.env.DISCORD_TOKEN);

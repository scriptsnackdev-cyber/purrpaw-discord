require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { io } = require('socket.io-client');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const { DisTube, Song } = require('distube');
const TTSManager = require('./utils/ttsManager');
const supabase = require('./supabaseClient');
const { initDailyScheduler } = require('./utils/dailyScheduler');
const { registerSystemFonts } = require('./utils/fontHelper');

registerSystemFonts();
const execFileAsync = promisify(execFile);
const YTDLP_PATH = process.platform === 'win32' ? path.join(__dirname, '..', 'yt-dlp.exe') : (fs.existsSync(path.join(__dirname, '..', 'yt-dlp')) ? path.join(__dirname, '..', 'yt-dlp') : 'yt-dlp');

async function ytdlp(args, useCookie = true) {
    const finalArgs = [...args];
    if (useCookie) {
        const cp = path.join(__dirname, '..', 'cookies.txt');
        if (fs.existsSync(cp)) finalArgs.push('--cookies', cp);
        else if (process.env.YOUTUBE_COOKIE) finalArgs.push('--add-header', `Cookie:${process.env.YOUTUBE_COOKIE}`);
    }
    finalArgs.push('--no-check-certificates', '--prefer-free-formats', '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');
    try {
        const { stdout } = await execFileAsync(YTDLP_PATH, finalArgs, { timeout: 30000, maxBuffer: 1024 * 1024 * 50, windowsHide: true });
        return JSON.parse(stdout);
    } catch (err) {
        if (useCookie && process.env.YOUTUBE_COOKIE) return ytdlp(args, false);
        throw err;
    }
}

const ytdlpPlugin = {
    type: 'extractor', name: 'yt-dlp-custom', init() {},
    async validate(url) { return url.includes('youtube.com') || url.includes('youtu.be') || !url.startsWith('http'); },
    async resolve(url, options = {}) {
        const info = await ytdlp(['--dump-single-json', '--no-warnings', '--skip-download', '--simulate', '--no-playlist', url.replace(/[?&]list=[^&]*/g, '')]);
        return new Song({ plugin: ytdlpPlugin, source: 'youtube', playFromSource: true, id: info.id, name: info.title || info.fulltitle, url: info.webpage_url || info.original_url, duration: info.is_live ? 0 : (info.duration || 0), isLive: info.is_live || false, thumbnail: info.thumbnail, uploader: { name: info.uploader || 'Unknown', url: info.uploader_url || '' } }, { member: options.member });
    },
    async searchSong(query, options = {}) {
        try {
            const info = await ytdlp(['--dump-single-json', '--no-warnings', '--skip-download', '--simulate', '--no-playlist', '--flat-playlist', `ytsearch1:${query}`]);
            const entry = info.entries?.[0] || info;
            if (!entry || !entry.id) return null;
            return new Song({ plugin: ytdlpPlugin, source: 'youtube', playFromSource: true, id: entry.id, name: entry.title || 'Unknown', url: entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`, duration: entry.duration || 0, isLive: entry.is_live || false, thumbnail: entry.thumbnail || null, uploader: { name: entry.uploader || 'Unknown', url: '' } }, { member: options.member });
        } catch (e) { return null; }
    },
    async getStreamURL(song) {
        const info = await ytdlp(['--dump-single-json', '--no-warnings', '--skip-download', '--simulate', '--no-playlist', '--format', 'bestaudio/best', song.url]);
        return info.url;
    }
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });
client.distube = new DisTube(client, { ffmpeg: { path: fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : (require('ffmpeg-static').path || 'ffmpeg') }, emitNewSongOnly: true, plugins: [ytdlpPlugin] });
client.commands = new Collection();
client.ttsManager = new TTSManager(client);

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    fs.readdirSync(commandsPath).forEach(folder => {
        const fp = path.join(commandsPath, folder);
        if (fs.lstatSync(fp).isDirectory()) {
            fs.readdirSync(fp).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(fp, file));
                if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd);
            });
        }
    });
}

const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
    fs.readdirSync(handlersPath).filter(f => f.endsWith('.js')).forEach(file => require(`./handlers/${file}`)(client));
}

client.once('clientReady', async () => {
    console.log(`✅ บอทออนไลน์แล้วเมี๊ยว: ${client.user.tag}`);
    try {
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        const cmdsJSON = Array.from(client.commands.values()).map(c => c.data.toJSON());
        const { data: gs } = await supabase.from('guilds').select('id');
        if (gs) for (const g of gs) await rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: cmdsJSON }).catch(() => {});
    } catch (e) {}
    initDailyScheduler(client);
});

// 🌐 Socket.io Client Setup
const DASHBOARD_URL = process.env.WEB_BASE_URL || `http://localhost:${process.env.DASHBOARD_PORT || 3000}`;
const socket = io(DASHBOARD_URL, { reconnection: true });

client.emitMusicUpdate = (guildId) => {
    const q = client.distube.getQueue(guildId);
    if (!q || !q.songs.length) return socket.emit('music_update', { guildId, current: null, queue: [], paused: false, volume: 50, currentTime: 0 });
    const s = q.songs[0];
    socket.emit('music_update', {
        guildId, current: { name: s.name, thumbnail: s.thumbnail, duration: s.duration, uploader: s.uploader?.name || 'Unknown', url: s.url },
        queue: q.songs.map(x => ({ name: x.name, thumbnail: x.thumbnail, duration: x.duration, member: x.member?.displayName || 'ทาสแมว' })),
        paused: q.paused, volume: q.volume, currentTime: q.currentTime
    });
};

socket.on('connect', () => {
    console.log(`✅ Connected to Dashboard Socket at ${DASHBOARD_URL}`);
    client.guilds.cache.forEach(g => socket.emit('join_guild', g.id));
});

// 🚨 หัวใจหลัก: รับคำสั่งจากหน้าเว็บ
socket.on('bot_command', async (data) => {
    const { guildId, action, value } = data;
    const q = client.distube.getQueue(guildId);
    try {
        if (action === 'request_update') return client.emitMusicUpdate(guildId);
        if (!q && action !== 'play') return;
        switch (action) {
            case 'toggle': q.paused ? q.resume() : q.pause(); break;
            case 'skip': await q.skip().catch(() => q.stop()); break;
            case 'volume': q.setVolume(value); break;
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
        if (q && !q.paused) client.emitMusicUpdate(g.id);
    });
}, 3000);

client.login(process.env.DISCORD_TOKEN);

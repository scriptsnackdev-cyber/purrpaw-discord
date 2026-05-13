require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits } = require('discord.js');
const supabase = require('../supabaseClient');
const { MBTI_DATA, SBTI_DATA } = require('../utils/mbtiShared');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.login(process.env.DISCORD_TOKEN).catch(() => {});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.DASHBOARD_PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/music-panel', (req, res) => res.sendFile(path.join(__dirname, 'music.html')));

io.on('connection', (socket) => {
    socket.on('join_guild', (guildId) => {
        if (!guildId) return;
        socket.join(`guild_${guildId}`);
        console.log(`[Socket] Joined: guild_${guildId}`);
        socket.emit('joined', { success: true, guildId });
    });

    // รับจากบอท -> ส่งให้หน้าเว็บ
    socket.on('music_update', (data) => {
        if (data.guildId) io.to(`guild_${data.guildId}`).emit('music_status', data);
    });

    // รับจากหน้าเว็บ -> ส่งให้บอท
    socket.on('music_command', (data) => {
        if (data.guildId) io.to(`guild_${data.guildId}`).emit('bot_command', data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Dashboard Server running on port ${PORT}`);
});

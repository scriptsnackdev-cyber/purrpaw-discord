const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const supabase = require('../supabaseClient');
const { sendTestResult } = require('../utils/mbtiShared');
const QUESTIONS_MBTI = require('../commands/mbti/MBTI_Question.json');
const QUESTIONS_SBTI = require('../commands/mbti/SBTI_Question.json');


const upload = multer({ storage: multer.memoryStorage() });

function startDashboard(client) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: "*" }
    });

    const PORT = process.env.DASHBOARD_PORT || 3000;

    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.static(path.join(__dirname, 'public')));

    // ── MBTI / SBTI Routes (ตรวจสอบ Token/Session ก่อนเข้าเมี๊ยว🐾) ──
    const serveTestPage = async (req, res) => {
        const { sessionId } = req.query;
        if (!sessionId) return res.status(403).send('❌ Forbidden: กรุณาเข้าผ่านปุ่มใน Discord เท่านั้นนะเมี๊ยว🐾');

        try {
            // ตรวจสอบความถูกต้องของ Session ใน DB
            const { data, error } = await supabase.from('user_mbti_sessions')
                .select('id, expires_at')
                .eq('id', sessionId)
                .single();

            if (error || !data) return res.status(403).send('❌ Invalid Session: ลิงก์ไม่ถูกต้องหรือหมดอายุแล้วเมี๊ยว🐾');
            
            // เช็ควันหมดอายุ
            if (new Date(data.expires_at) < new Date()) {
                return res.status(403).send('⏰ Session Expired: ลิงก์นี้หมดอายุแล้วเมี๊ยว! กรุณากดปุ่มใหม่จาก Discord นะ🐾');
            }

            res.sendFile(path.join(__dirname, 'mbti.html'));
        } catch (err) {
            res.status(500).send('งื้อออ เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์เมี๊ยว🐾');
        }
    };

    app.get('/mbti', serveTestPage);
    app.get('/sbti', serveTestPage);

    // ── MBTI / SBTI API ──
    app.get('/api/session/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { data: session, error } = await supabase.from('user_mbti_sessions').select('*').eq('id', sessionId).single();
            if (error || !session) return res.status(404).json({ error: 'ไม่พบเซสชันเมี๊ยว🐾' });

            const questions = session.type === 'sbti' ? QUESTIONS_SBTI : QUESTIONS_MBTI;
            res.json({ session, questions });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/submit', async (req, res) => {
        try {
            const { sessionId, scores, result } = req.body;
            const { data: session, error } = await supabase.from('user_mbti_sessions').select('*').eq('id', sessionId).single();
            if (error || !session) return res.status(404).json({ error: 'Session Expired เมี๊ยว🐾' });

            // บันทึกผลลงโปรไฟล์เมี๊ยว🐾
            await supabase.from('user_profiles').upsert({
                user_id: session.user_id,
                [session.type]: result
            });

            // ส่งผลลัพธ์ไปที่ Discord เมี๊ยว🐾
            await sendTestResult(client, {
                userId: session.user_id,
                guildId: session.guild_id,
                channelId: session.channel_id,
                type: session.type,
                result: result
            });

            res.json({ success: true, result });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── Socket.io Connection ──
    io.on('connection', (socket) => {
        socket.on('join_channel', (channelId) => socket.join(channelId));
        socket.on('leave_channel', (channelId) => socket.leave(channelId));
    });

    client.dashboardIo = io;

    // ── API: Get Guilds ──
    app.get('/api/guilds', async (req, res) => {
        try {
            const guilds = client.guilds.cache.map(g => ({
                id: g.id,
                name: g.name,
                icon: g.iconURL()
            }));
            res.json(guilds);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // ── API: Get Channels ──
    app.get('/api/channels/:guildId', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Guild not found' });
            const channels = guild.channels.cache
                .filter(c => c.type === 0 || c.type === 2)
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    parentId: c.parentId,
                    position: c.rawPosition,
                    members: c.type === 2 ? c.members.map(m => ({
                        id: m.id,
                        displayName: m.displayName,
                        avatar: m.user.displayAvatarURL()
                    })) : []
                }))
                .sort((a, b) => a.position - b.position);
            res.json(channels);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // ── API: Get AI Characters ──
    app.get('/api/characters/:guildId', async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('ai_characters')
                .select('*')
                .eq('guild_id', req.params.guildId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            res.json(data || []);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // ── API: Create AI Character ──
    app.post('/api/characters', async (req, res) => {
        const { guildId, name, imageUrl, persona } = req.body;
        try {
            const { data, error } = await supabase
                .from('ai_characters')
                .insert([{ guild_id: guildId, name, image_url: imageUrl, persona: persona || '', created_at: new Date() }])
                .select();
            if (error) throw error;
            res.json(data[0]);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // ── API: Get Message History ──
    app.get('/api/messages/:guildId/:channelId', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            const channel = guild?.channels.cache.get(req.params.channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });
            const messages = await channel.messages.fetch({ limit: 100 });
            const history = messages.map(m => formatMessage(m)).reverse();
            res.json(history);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // ── API: Get Guild Members ──
    app.get('/api/members/:guildId', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Guild not found' });
            const members = await guild.members.fetch();
            const roles = guild.roles.cache.filter(r => r.hoist).sort((a, b) => b.position - a.position);
            const groupedMembers = [];
            roles.forEach(role => {
                const roleMembers = members.filter(m => m.roles.cache.has(role.id));
                if (roleMembers.size > 0) {
                    groupedMembers.push({
                        roleName: role.name,
                        members: roleMembers.map(m => ({
                            id: m.id,
                            displayName: m.displayName,
                            avatar: m.user.displayAvatarURL(),
                            status: m.presence?.status || 'offline',
                            color: role.hexColor === '#000000' ? '#ffffff' : role.hexColor
                        }))
                    });
                }
            });
            const others = members.filter(m => !new Set(groupedMembers.flatMap(g => g.members.map(m => m.id))).has(m.id));
            if (others.size > 0) {
                groupedMembers.push({
                    roleName: 'ออนไลน์',
                    members: others.map(m => ({ id: m.id, displayName: m.displayName, avatar: m.user.displayAvatarURL(), status: m.presence?.status || 'offline', color: '#ffffff' }))
                });
            }

            // For Mentions (Include Roles)
            const mentionableRoles = guild.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor, type: 'role' }));

            res.json({ groups: groupedMembers, roles: mentionableRoles });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // ── API: Send Message (Speak) with Attachments ──
    app.post('/api/speak', upload.array('files'), async (req, res) => {
        const { guildId, channelId, characterId, message, manualName, manualAvatar } = req.body;
        const files = req.files;

        try {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });

            let finalName = manualName || 'PurrPaw';
            let finalAvatar = manualAvatar;

            if (characterId) {
                const { data: charData } = await supabase.from('ai_characters').select('name, image_url').eq('id', characterId).single();
                if (charData) {
                    finalName = charData.name;
                    finalAvatar = charData.image_url || finalAvatar;
                }
            }

            const webhooks = await channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.name === 'PurrPaw Speak');
            if (!webhook) {
                webhook = await channel.createWebhook({ name: 'PurrPaw Speak', avatar: client.user.displayAvatarURL() });
            }

            const attachments = files ? files.map(file => ({
                attachment: file.buffer,
                name: file.originalname
            })) : [];

            await webhook.send({
                content: message || '',
                username: finalName,
                avatarURL: finalAvatar || null,
                files: attachments
            });

            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    server.listen(PORT, () => console.log(`🚀 Dashboard UI is running at: http://localhost:${PORT}`))
          .on('error', (err) => {
              if (err.code === 'EADDRINUSE') {
                  const nextPort = parseInt(PORT) + 1;
                  console.log(`⚠️ Port ${PORT} ไม่ว่างเมี๊ยว... กำลังลองใช้ Port ${nextPort} แทนนะ🐾`);
                  server.listen(nextPort);
              } else {
                  console.error(err);
              }
          });
}

function formatMessage(m) {
    return {
        id: m.id, content: m.cleanContent || m.content,
        author: { name: m.member?.displayName || m.author.username, avatar: m.author.displayAvatarURL(), isBot: m.author.bot },
        timestamp: m.createdAt,
        attachments: m.attachments.map(a => ({ url: a.url, name: a.name })),
        embeds: m.embeds.map(e => ({ title: e.title, description: e.description, url: e.url, color: e.color, image: e.image?.url, thumbnail: e.thumbnail?.url, footer: e.footer?.text, fields: e.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })) }))
    };
}

module.exports = { startDashboard, formatMessage };

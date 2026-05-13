require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits } = require('discord.js');
const supabase = require('../supabaseClient');
const { sendTestResult, MBTI_DATA, MBTI_IMAGES, SBTI_DATA, SBTI_IMAGES } = require('../utils/mbtiShared');
const QUESTIONS_MBTI = require('../commands/mbti/MBTI_Question.json');
const QUESTIONS_SBTI = require('../commands/mbti/SBTI_Question.json');

// ── Standalone Client เพื่อใช้ส่งข้อความเมี๊ยว🐾 ──
const client = new Client({
    intents: [GatewayIntentBits.Guilds] // ต้องการแค่ Guilds เพื่อส่งข้อความเมี๊ยว🐾
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Standalone Client Login Failed:', err.message);
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.DASHBOARD_PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper: ดึง IP Address ของผู้ใช้เมี๊ยว🐾 ──
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.socket.remoteAddress;
};

// ── MBTI / SBTI Routes ──
const serveTestPage = async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) return res.redirect('/');

    try {
        const { data, error } = await supabase.from('user_mbti_sessions')
            .select('id, expires_at, type')
            .eq('id', sessionId)
            .single();

        if (error || !data) return res.status(403).send('❌ Invalid Session: ลิงก์ไม่ถูกต้องหรือหมดอายุแล้วเมี๊ยว🐾');
        if (new Date(data.expires_at) < new Date()) {
            return res.status(403).send('⏰ Session Expired: ลิงก์นี้หมดอายุแล้วเมี๊ยว! กรุณากดปุ่มใหม่จาก Discord นะ🐾');
        }

        const fileName = data.type === 'sbti' ? 'sbti.html' : 'mbti.html';
        res.sendFile(path.join(__dirname, fileName));
    } catch (err) {
        res.status(500).send('งื้อออ เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์เมี๊ยว🐾');
    }
};

app.get('/mbti', serveTestPage);
app.get('/sbti', serveTestPage);
app.get('/phone', (req, res) => res.sendFile(path.join(__dirname, 'phone.html')));

// ── MBTI / SBTI API ──
app.get('/api/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const ip = getClientIp(req);

        // บันทึก IP ลง Session เพื่อติดตามการใช้งานเมี๊ยว🐾
        await supabase.from('user_mbti_sessions')
            .update({ ip_address: ip })
            .eq('id', sessionId);

        const { data: session, error } = await supabase.from('user_mbti_sessions').select('*').eq('id', sessionId).single();
        if (error || !session) return res.status(404).json({ error: 'ไม่พบเซสชันเมี๊ยว🐾' });

        const questions = session.type === 'sbti' ? QUESTIONS_SBTI : QUESTIONS_MBTI;
        res.json({ session, questions });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/submit', async (req, res) => {
    try {
        const { 
            sessionId, scores, result, fingerprint, userAgent, deviceModel, 
            gpuInfo, screenRes, ramInfo, cpuCores,
            clientHints, touchPoints, colorGamut, webglExtCount
        } = req.body;
        const { data: session, error } = await supabase.from('user_mbti_sessions').select('*').eq('id', sessionId).single();
        if (error || !session) return res.status(404).json({ error: 'Session Expired เมี๊ยว🐾' });

        const isSBTI = session.type === 'sbti';
        const data = isSBTI ? SBTI_DATA[result] : MBTI_DATA[result];
        const images = isSBTI ? SBTI_IMAGES[result] : MBTI_IMAGES[result];
        const randomImage = images[Math.floor(Math.random() * images.length)] || "https://s.showimg.link/XMJwqN8ofy.webp";

        await supabase.from('user_profiles').upsert({
            user_id: session.user_id,
            [session.type]: result
        });

        await supabase.from('user_mbti_sessions').update({ 
            status: 'completed', 
            result_mbti: result,
            ip_address: getClientIp(req),
            fingerprint: fingerprint || null,
            user_agent: userAgent || null,
            device_model: deviceModel || null,
            gpu_info: gpuInfo || null,
            screen_res: screenRes || null,
            ram_info: ramInfo || null,
            cpu_cores: cpuCores || null,
            client_hints: clientHints || null,
            touch_points: touchPoints || null,
            color_gamut: colorGamut || null,
            webgl_ext_count: webglExtCount || null,
            completed_at: new Date().toISOString()
        }).eq('id', sessionId);

        res.json({ 
            success: true, 
            result, 
            cat_type: data.cat_type,
            image_url: randomImage
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/share', async (req, res) => {
    try {
        const { sessionId, result } = req.body;
        const { data: session, error } = await supabase.from('user_mbti_sessions').select('*').eq('id', sessionId).single();
        if (error || !session) return res.status(404).json({ error: 'Session not found เมี๊ยว🐾' });

        // รอให้ Client พร้อมเมี๊ยว🐾
        if (!client.readyAt) {
            return res.status(503).json({ error: 'บอทกำลังเตรียมความพร้อม กรุณาลองใหม่ในอีกสักครู่นะเมี๊ยว🐾' });
        }

        await sendTestResult(client, {
            userId: session.user_id,
            guildId: session.guild_id,
            channelId: session.channel_id,
            type: session.type,
            result: result
        });

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

server.listen(PORT, () => console.log(`🚀 Standalone MBTI Web is running at: http://localhost:${PORT}`));

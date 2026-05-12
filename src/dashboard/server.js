const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const supabase = require('../supabaseClient');
const { sendTestResult } = require('../utils/mbtiShared');
const QUESTIONS_MBTI = require('../commands/mbti/MBTI_Question.json');
const QUESTIONS_SBTI = require('../commands/mbti/SBTI_Question.json');

function startDashboard(client) {
    const app = express();
    const server = http.createServer(app);

    const PORT = process.env.DASHBOARD_PORT || 3000;

    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.static(path.join(__dirname, 'public')));

    // ── MBTI / SBTI Routes (ตรวจสอบ Token/Session ก่อนเข้าเมี๊ยว🐾) ──
    const serveTestPage = async (req, res) => {
        const { sessionId } = req.query;
        if (!sessionId) return res.redirect('/'); // ถ้าไม่มี Token ให้กลับหน้าแรกเมี๊ยว🐾

        try {
            const { data, error } = await supabase.from('user_mbti_sessions')
                .select('id, expires_at')
                .eq('id', sessionId)
                .single();

            if (error || !data) return res.status(403).send('❌ Invalid Session: ลิงก์ไม่ถูกต้องหรือหมดอายุแล้วเมี๊ยว🐾');
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

            await supabase.from('user_profiles').upsert({
                user_id: session.user_id,
                [session.type]: result
            });

            await sendTestResult(client, {
                userId: session.user_id,
                guild_id: session.guild_id,
                channelId: session.channel_id,
                type: session.type,
                result: result
            });

            await supabase.from('user_mbti_sessions').update({ 
                status: 'completed', 
                result_mbti: result,
                completed_at: new Date().toISOString()
            }).eq('id', sessionId);

            res.json({ success: true, result });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    server.listen(PORT, () => console.log(`🚀 PurrPaw MBTI Web is running at: http://localhost:${PORT}`))
          .on('error', (err) => {
              if (err.code === 'EADDRINUSE') {
                  const nextPort = parseInt(PORT) + 1;
                  server.listen(nextPort);
              }
          });
}

module.exports = { startDashboard };

const express = require('express');
const cors = require('cors');
const path = require('path');
const supabase = require('../supabaseClient');
const QUESTIONS_MBTI = require('../commands/mbti/MBTI_Question.json');
const QUESTIONS_SBTI = require('../commands/mbti/SBTI_Question.json'); // สมมติว่ามี
const MBTI_DATA = require('../commands/mbti/MBTI.json');
const MBTI_IMAGES = require('../commands/mbti/MBTI_IMAGES.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper: ดึง IP Address ของผู้ใช้เมี๊ยว🐾 ──
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.socket.remoteAddress;
};

// API สำหรับดึงข้อมูล Session และคำถามเมี๊ยว🐾
app.get('/api/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const ip = getClientIp(req);

        // บันทึก IP ลง Session เพื่อติดตามการใช้งานเมี๊ยว🐾
        await supabase.from('user_mbti_sessions')
            .update({ ip_address: ip })
            .eq('id', sessionId);

        const { data: session, error } = await supabase.from('user_mbti_sessions').select('*').eq('id', sessionId).single();

        if (error || !session) {
            return res.status(404).json({ error: 'ไม่พบเซสชันเมี๊ยว🐾' });
        }

        const questions = session.type === 'sbti' ? QUESTIONS_SBTI : QUESTIONS_MBTI;
        res.json({ session, questions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API สำหรับส่งผลลัพธ์กลับไปยัง Discord เมี๊ยว🐾
app.post('/api/submit', async (req, res) => {
    try {
        const { sessionId, scores, result, fingerprint, userAgent, deviceModel, gpuInfo, screenRes, ramInfo, cpuCores } = req.body;
        
        // 1. ตรวจสอบ Session
        const { data: session, error } = await supabase.from('user_mbti_sessions').select('*').eq('id', sessionId).single();
        if (error || !session) return res.status(404).json({ error: 'Session Expired เมี๊ยว🐾' });

        // 2. บันทึกผลลง user_profiles
        await supabase.from('user_profiles').upsert({
            user_id: session.user_id,
            [session.type]: result
        });

        // 3. เตรียมข้อมูลสำหรับส่ง Webhook (ใช้บอทส่งข้อความ)
        // หมายเหตุ: ในที่นี้เราจะให้บอทที่รันอยู่ส่งข้อความแทน หรือใช้ Webhook URL ถ้ามี
        // แต่เนื่องจากเราอยู่ในโปรเจคเดียวกัน เราสามารถส่งผ่าน EventEmitter หรือเก็บลง DB แล้วให้บอทเช็ค
        // วิธีที่ง่ายที่สุดคือ บันทึกสถานะว่า "เสร็จแล้ว" แล้วให้บอทในตัวหลักจัดการ
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
            completed_at: new Date().toISOString()
        }).eq('id', sessionId);

        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Web Test Server is running on http://localhost:${PORT} เมี๊ยว🐾`);
});

module.exports = app;

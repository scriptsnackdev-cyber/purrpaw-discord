const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.ELEVEN_API_KEY;

if (!apiKey) {
    console.error('❌ ไม่พบ ELEVEN_API_KEY ในไฟล์ .env เมี๊ยว!');
    process.exit(1);
}

axios.get('https://api.elevenlabs.io/v1/models', {
    headers: { 'xi-api-key': apiKey }
})
.then(res => {
    console.log('--- 🤖 รายชื่อโมเดลที่ใช้งานได้ในบัญชีของคุณท่านเมี๊ยว ---');
    res.data.forEach(m => {
        console.log(`${m.name} : ${m.model_id}`);
    });
    console.log('----------------------------------------------------');
})
.catch(err => {
    console.error('❌ เกิดข้อผิดพลาด:', err.response?.data || err.message);
});

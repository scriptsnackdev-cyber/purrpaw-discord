const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.ELEVEN_API_KEY;

if (!apiKey) {
    console.error('❌ ไม่พบ ELEVEN_API_KEY ในไฟล์ .env เมี๊ยว!');
    process.exit(1);
}

// 1. เช็คข้อมูลผู้ใช้ก่อนเมี๊ยว🐾
axios.get('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': apiKey }
})
.then(userRes => {
    console.log(`--- 👤 ข้อมูลเจ้าของ Key: ${userRes.data.subscription?.tier || 'Unknown Tier'} ---`);
    console.log(`Character Count: ${userRes.data.subscription?.character_count} / ${userRes.data.subscription?.character_limit}`);
    
    // 2. เช็ครายชื่อเสียงต่อเลยเมี๊ยว🐾
    return axios.get('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey }
    });
})
.then(res => {
    console.log('--- 🎤 รายชื่อเสียงที่ใช้งานได้เมี๊ยว ---');
    if (res.data.voices.length === 0) {
        console.log('⚠️ ไม่พบเสียงในรายการเลยเมี๊ยว! (Empty)');
    } else {
        res.data.voices.forEach(v => {
            console.log(`${v.name} : ${v.voice_id}`);
        });
    }
    console.log('----------------------------------------------------');
})
.catch(err => {
    console.error('❌ เกิดข้อผิดพลาด:', err.response?.data || err.message);
});

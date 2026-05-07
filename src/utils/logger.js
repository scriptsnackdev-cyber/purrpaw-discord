const fs = require('fs');
const path = require('path');

/**
 * AI Logger Utility เมี๊ยว🐾
 * บันทึกประวัติการคุยลงไฟล์ ai_log.txt
 */

const logPath = path.join(__dirname, '../../ai_log.txt');

function logAI(type, rawData) {
    // ตรวจสอบว่าเปิดการเก็บ Log หรือไม่ (ค่าเริ่มต้นคือ false ถ้าไม่ได้ตั้งไว้) เมี๊ยว🐾
    if (process.env.ENABLE_AI_LOG !== 'false') return;

    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // เตรียมข้อมูลที่จะบันทึก
    const formattedData = typeof rawData === 'object' ? JSON.stringify(rawData, null, 2) : rawData;
    const logEntry = `[${timestamp}] : [${type}] - ${formattedData}\n`;

    // เขียนลงไฟล์แบบ Append (เพิ่มต่อท้าย)
    fs.appendFile(logPath, logEntry, (err) => {
        if (err) console.error('Error writing to ai_log.txt:', err);
    });
}

module.exports = { logAI };

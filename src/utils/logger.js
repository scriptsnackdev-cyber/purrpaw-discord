const fs = require('fs');
const path = require('path');

/**
 * AI Logger Utility เมี๊ยว🐾
 * บันทึกประวัติการคุยลงไฟล์ ai_log.txt
 */

const logPath = path.join(__dirname, '../../ai_log.txt');

function logAI(type, rawData) {
    // ปิดการบันทึก Log ถาวรตามคำขอคุณแม่เมี๊ยว🐾
    return;
}

module.exports = { logAI };

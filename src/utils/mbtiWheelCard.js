const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const { fontStack, fontStackBold } = require('./fontHelper');
const { drawImageCover } = require('./canvasHelper');

const MBTI_TYPES = [
    'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
    'ISTP', 'ISFP', 'INFP', 'INTP',
    'ESTP', 'ESFP', 'ENFP', 'ENTP',
    'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'
];

const GENDERS = ['ชาย', 'หญิง'];

// สร้างรายการทั้งหมด 32 อัน
const WHEEL_ITEMS = [];
MBTI_TYPES.forEach(type => {
    GENDERS.forEach(gender => {
        WHEEL_ITEMS.push(`${type} (${gender})`);
    });
});

const PASTEL_COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', 
    '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF',
    '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', 
    '#B5EAD7', '#C7CEEA', '#F4976C', '#FBE8A6',
    '#D4A5A5', '#97C1A9', '#809BCE', '#B8E0D2',
    '#D6EADF', '#EAC4D5', '#FFF1E6', '#F0EFEB',
    '#EDDCD2', '#DBE7E4', '#F08080', '#F4978E',
    '#F8AD9D', '#FBC4AB', '#FFDAB9', '#E0BBE4'
];

/**
 * สร้างรูปกงล้อสุ่ม MBTI
 * @param {number} winnerIndex - ดัชนีของผู้ชนะในรายการที่ส่งมา
 * @param {string[]} items - รายการของที่อยู่ในกงล้อ (Default: WHEEL_ITEMS)
 */
async function createMbtiWheelCard(winnerIndex, items = WHEEL_ITEMS) {
    const width = 1200;
    const height = 1200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 450;

    // 1. วาดพื้นหลัง (ใช้รูปพรีเมียมที่เตรียมไว้เมี๊ยว🐾)
    try {
        const bgPath = path.join(__dirname, '../assets/mbti_wheel_bg.png');
        const background = await loadImage(bgPath);
        drawImageCover(ctx, background, 0, 0, width, height);
        
        // ใส่ Overlay ขาวจางๆ เพื่อให้กงล้อเด่นขึ้น
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        // Fallback Gradient
        const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width);
        bgGradient.addColorStop(0, '#FFF5F5');
        bgGradient.addColorStop(1, '#FFEBEE');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
    }

    // 2. วาดตัวกงล้อ
    const numSegments = items.length;
    const segmentAngle = (Math.PI * 2) / numSegments;

    // หมุนกงล้อให้เข็มชี้ไปที่ตัวที่ชนะ (เข็มอยู่ด้านบนสุด = -90 องศา หรือ 3*PI/2)
    // ตัวที่ i จะอยู่ที่มุม i * segmentAngle ถึง (i+1) * segmentAngle
    // เราต้องการให้ตรงกลางของ segment ที่ winnerIndex อยู่ที่ตำแหน่ง -PI/2
    // ตำแหน่งกลางของ segment i คือ (i + 0.5) * segmentAngle
    // ดังนั้นเราต้องหมุนกงล้อไปที่ -PI/2 - (winnerIndex + 0.5) * segmentAngle
    const rotationOffset = -Math.PI / 2 - (winnerIndex + 0.5) * segmentAngle;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset);

    for (let i = 0; i < numSegments; i++) {
        const startAngle = i * segmentAngle;
        const endAngle = (i + 1) * segmentAngle;

        // วาดส่วนโค้ง
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = PASTEL_COLORS[i % PASTEL_COLORS.length];
        ctx.fill();

        // วาดเส้นขอบ
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // วาดตัวหนังสือ
        ctx.save();
        ctx.rotate(startAngle + segmentAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#4A4A4A';
        ctx.font = `bold 24px ${fontStack}`;
        ctx.fillText(items[i], radius - 30, 10);
        ctx.restore();
    }
    ctx.restore();

    // 3. วาดขอบกงล้อให้ดูพรีเมียม
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 15, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 15;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 25, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD1DC';
    ctx.lineWidth = 5;
    ctx.stroke();

    // 4. วาดป้ายผลลัพธ์ตรงกลาง (MBTI ตัวใหญ่ๆเมี๊ยว🐾)
    try {
        const winnerText = items[winnerIndex];
        const mbtiOnly = winnerText.split(' ')[0]; // เช่น INTP
        const genderOnly = winnerText.split(' ')[1] || ''; // เช่น (ชาย)

        // วาดวงกลมพื้นหลังสีขาวพรีเมียม
        ctx.beginPath();
        ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        
        // วาดขอบวงกลมกลาง
        ctx.strokeStyle = '#FFD1DC';
        ctx.lineWidth = 15;
        ctx.stroke();

        // ใส่เงาให้ป้ายตรงกลางดูนูนออกมา
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 30;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // วาดตัวหนังสือ MBTI (ตัวใหญ่)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF6B6B';
        ctx.font = `bold 100px ${fontStackBold}`;
        ctx.fillText(mbtiOnly, centerX, centerY - 20);

        // วาดเพศ (ตัวเล็กกว่าด้านล่าง)
        ctx.fillStyle = '#888888';
        ctx.font = `bold 40px ${fontStack}`;
        ctx.fillText(genderOnly, centerX, centerY + 55);

        // เพิ่มไอคอนแมวเล็กๆ ตกแต่งข้างบน
        const catImagePath = path.join(__dirname, '../assets/Cat/Persian.png');
        const catImage = await loadImage(catImagePath);
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY - 110, 40, 0, Math.PI * 2);
        ctx.clip();
        drawImageCover(ctx, catImage, centerX - 40, centerY - 150, 80, 80);
        ctx.restore();
        
    } catch (e) {
        console.error('Failed to draw center result:', e);
    }

    // 5. วาดเข็มชี้ (Arrow)
    ctx.fillStyle = '#FF4D4D';
    ctx.beginPath();
    ctx.moveTo(centerX - 30, centerY - radius - 50);
    ctx.lineTo(centerX + 30, centerY - radius - 50);
    ctx.lineTo(centerX, centerY - radius + 20);
    ctx.closePath();
    ctx.fill();
    
    // ใส่เงาให้เข็ม
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    return canvas.toBuffer('image/png');
}

module.exports = { createMbtiWheelCard, WHEEL_ITEMS };

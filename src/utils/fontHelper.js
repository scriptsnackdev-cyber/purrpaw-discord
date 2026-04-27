const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// 🎨 ชุดฟอนต์สำหรับการแสดงผล (Fallback Stack) เมี๊ยว🐾
const fontStack = '"Leelawadee UI", "Quivira", "NotoSymbols", "NotoEmoji", "Segoe UI Symbol", "Segoe UI Emoji", "Arial Unicode MS", sans-serif';
const fontStackBold = '"Leelawadee UI", "Quivira", "NotoSymbolsBold", "NotoEmoji", "Segoe UI Symbol", "Segoe UI Emoji", "Arial Unicode MS", sans-serif';

/**
 * ลงทะเบียนฟอนต์สำหรับทั้งระบบ
 */
function registerSystemFonts() {
    try {
        // Path อ้างอิงจากโฟลเดอร์ utils ไปยัง assets/fonts
        const fontsPath = path.join(__dirname, '../assets/fonts');
        
        GlobalFonts.registerFromPath(path.join(fontsPath, 'Quivira/Quivira.otf'), 'Quivira');
        GlobalFonts.registerFromPath(path.join(fontsPath, 'Noto_Color_Emoji,Noto_Sans_Symbols/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf'), 'NotoEmoji');
        GlobalFonts.registerFromPath(path.join(fontsPath, 'Noto_Sans_Symbols/static/NotoSansSymbols-Bold.ttf'), 'NotoSymbolsBold');
        GlobalFonts.registerFromPath(path.join(fontsPath, 'Noto_Sans_Symbols/static/NotoSansSymbols-Regular.ttf'), 'NotoSymbols');
        
        console.log('✅ [Fonts] ลงทะเบียนฟอนต์ชุดใหญ่เรียบร้อยแล้วเมี๊ยว🐾');
    } catch (e) {
        console.error('❌ [Fonts] Font registration failed:', e);
    }
}

module.exports = {
    fontStack,
    fontStackBold,
    registerSystemFonts
};

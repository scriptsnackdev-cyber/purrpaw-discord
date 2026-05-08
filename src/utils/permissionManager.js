const { getGuildData } = require('./guildCache');
const fs = require('fs');
const path = require('path');

// Fallback Default Config (กรณีใน Supabase ยังไม่มีการตั้งค่าเมี๊ยว🐾)
const localConfigPath = path.join(__dirname, '../../config/permissions.json');
let localConfig = { adminRoles: ["Administrator"], adminUsers: [], commands: {} };
try {
    localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
} catch (e) {}

/**
 * Permission Manager Utility (Supabase Version 🐾)
 * จัดการสิทธิ์การใช้งานคำสั่งผ่าน Supabase และ Cache เมี๊ยว
 */

async function checkPermission(interaction, commandName) {
    const { settings } = await getGuildData(interaction.guild.id);
    
    // ดึงค่าสิทธิ์จาก Supabase
    const permissions = settings.permissions || localConfig;
    
    // ดึงชื่อ Subcommand (ถ้ามี) เมี๊ยว🐾
    let subcommandName = null;
    try {
        subcommandName = interaction.options.getSubcommand(false);
    } catch (e) {}

    // ลำดับการเช็ค: 1. command:subcommand -> 2. command -> 3. admin (default)
    const fullKey = subcommandName ? `${commandName}:${subcommandName}` : commandName;
    const requiredLevel = permissions.commands?.[fullKey] || 
                          permissions.commands?.[commandName] || 
                          localConfig.commands?.[fullKey] ||
                          localConfig.commands?.[commandName] || 
                          'admin';

    // 🛡️ เช็คสิทธิ์สูงสุด (Administrator หรือ ID พิเศษ) -> เป็น Admin เมี๊ยว🐾
    const isAdmin = interaction.member.permissions.has('Administrator') || 
                    (permissions.adminUsers || localConfig.adminUsers || []).includes(interaction.user.id);

    // 1. ถ้าใครๆ ก็ใช้ได้ ก็ปล่อยผ่านเลยเมี๊ยว🐾
    if (requiredLevel === 'everyone') return true;

    // 2. ถ้าเป็น Admin อยู่แล้ว ให้ผ่านทุกด่านเมี๊ยว🐾
    if (isAdmin) return true;

    // 3. ถ้าเป็นระดับ Admin แต่ผู้ใช้ไม่ใช่ Admin -> ปัดตกเมี๊ยว
    if (requiredLevel === 'admin' && !isAdmin) return false;

    // 4. ถ้าเป็นระดับ Mod (หรือระบุชื่อ Role โดยตรง)
    const modRoles = permissions.mod_roles || [];
    
    // เช็คกรณีระบุเป็นชื่อ Role หรือ ID โดยตรงใน JSON
    if (Array.isArray(requiredLevel)) {
        return interaction.member.roles.cache.some(role => 
            requiredLevel.includes(role.id) || requiredLevel.includes(role.name)
        );
    }

    // เช็คกรณีต้องการระดับ Mod (ถ้ามี Role ใน mod_roles ก็ให้ผ่านเมี๊ยว🐾)
    if (requiredLevel === 'mod') {
        return interaction.member.roles.cache.some(role => 
            modRoles.includes(role.id) || modRoles.includes(role.name)
        );
    }

    return isAdmin; // Fallback
}

module.exports = { checkPermission };

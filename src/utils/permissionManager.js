const fs = require('fs');
const path = require('path');

/**
 * Permission Manager Utility
 * จัดการสิทธิ์การใช้งานคำสั่งผ่าน JSON เมี๊ยว🐾
 */

const configPath = path.join(__dirname, '../../config/permissions.json');

function getPermissions() {
    try {
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading permissions.json:', error);
        // Fallback default
        return { adminRoles: ["Administrator"], adminUsers: [], commands: {} };
    }
}

function checkPermission(interaction, commandName) {
    const config = getPermissions();
    const requiredLevel = config.commands[commandName] || 'everyone';

    // ถ้าใครๆ ก็ใช้ได้ ก็ปล่อยผ่านเลยเมี๊ยว🐾
    if (requiredLevel === 'everyone') return true;

    // เช็คสิทธิ์ Admin
    if (requiredLevel === 'admin') {
        // 1. เช็คจาก ID ผู้ใช้ (ถ้ามีระบุในไฟล์)
        if (config.adminUsers.includes(interaction.user.id)) return true;

        // 2. เช็คจากสิทธิ์ Administrator ของ Discord
        if (interaction.member.permissions.has('Administrator')) return true;

        // 3. เช็คจากชื่อ Role ที่ระบุไว้
        const hasAdminRole = interaction.member.roles.cache.some(role => 
            config.adminRoles.includes(role.name)
        );
        if (hasAdminRole) return true;

        return false;
    }

    return true;
}

module.exports = { checkPermission };

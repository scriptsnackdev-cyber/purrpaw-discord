const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const supabase = require('../../supabaseClient');
const { getGuildData, invalidateCache } = require('../../utils/guildCache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('permission')
        .setDescription('🛡️ จัดการสิทธิ์การใช้งานคำสั่งในเซิร์ฟเวอร์เมี๊ยว🐾')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcommand: เพิ่ม Role เข้ากลุ่มสิทธิ์ (Mod)
        .addSubcommand(sub => 
            sub.setName('add-mod')
                .setDescription('➕ เพิ่ม Role เข้ากลุ่มสิทธิ์ Mod เมี๊ยว🐾')
                .addRoleOption(opt => opt.setName('role').setDescription('เลือก Role ที่ต้องการเพิ่ม').setRequired(true))
        )
        
        // Subcommand: ลบ Role ออกจากกลุ่มสิทธิ์
        .addSubcommand(sub => 
            sub.setName('remove-mod')
                .setDescription('➖ ลบ Role ออกจากกลุ่มสิทธิ์ Mod เมี๊ยว🐾')
                .addRoleOption(opt => opt.setName('role').setDescription('เลือก Role ที่ต้องการลบ').setRequired(true))
        )
        
        // Subcommand: กำหนดสิทธิ์รายคำสั่ง
        .addSubcommand(sub => 
            sub.setName('set-command')
                .setDescription('⚙️ กำหนดสิทธิ์ที่จำเป็นสำหรับแต่ละคำสั่งเมี๊ยว🐾')
                .addStringOption(opt => 
                    opt.setName('command')
                        .setDescription('ชื่อคำสั่ง (เช่น ban, music, aichat)')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(opt => 
                    opt.setName('level')
                        .setDescription('ระดับสิทธิ์ที่ต้องใช้')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Admin Only (เจ้าของเซิร์ฟ)', value: 'admin' },
                            { name: 'Mod & Admin', value: 'mod' },
                            { name: 'Everyone (ทุกคน)', value: 'everyone' }
                        ))
                .addStringOption(opt => 
                    opt.setName('subcommand')
                        .setDescription('ชื่อคำสั่งย่อย (ถ้ามี เช่น play, summon)')
                        .setRequired(false))
        )
        
        // Subcommand: ล้างสิทธิ์รายคำสั่ง
        .addSubcommand(sub => 
            sub.setName('clear-command')
                .setDescription('🗑️ ล้างการตั้งค่าสิทธิ์ของคำสั่งนั้นๆ (Reset) เมี๊ยว🐾')
                .addStringOption(opt => 
                    opt.setName('command')
                        .setDescription('ชื่อคำสั่งที่จะล้างสิทธิ์')
                        .setRequired(true)
                        .setAutocomplete(true))
        )
        
        // Subcommand: เปลี่ยนระดับสิทธิ์
        .addSubcommand(sub => 
            sub.setName('move-command')
                .setDescription('🏹 เปลี่ยนระดับสิทธิ์ของคำสั่งเมี๊ยว🐾')
                .addStringOption(opt => 
                    opt.setName('command')
                        .setDescription('ชื่อคำสั่งที่จะเปลี่ยนระดับ')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(opt => 
                    opt.setName('level')
                        .setDescription('ระดับสิทธิ์ใหม่')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Admin Only', value: 'admin' },
                            { name: 'Mod & Admin', value: 'mod' },
                            { name: 'Everyone', value: 'everyone' }
                        ))
        )
        
        // Subcommand: ดูการตั้งค่าปัจจุบัน
        .addSubcommand(sub => 
            sub.setName('list')
                .setDescription('📋 ดูรายการสิทธิ์และ Role ทั้งหมดในปัจจุบันเมี๊ยว🐾'))
        
        // Subcommand: รีโหลดสิทธิ์
        .addSubcommand(sub => 
            sub.setName('reload')
                .setDescription('🔄 รีโหลดการตั้งค่าสิทธิ์ใหม่ทั้งหมดจาก Database ทันทีเมี๊ยว🐾')),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // ถ้าเป็นคำสั่ง clear-command หรือ move-command ให้โชว์เฉพาะคำสั่งที่เคยตั้งค่าไว้
        if (sub === 'clear-command' || sub === 'move-command') {
            const { settings } = await getGuildData(guildId);
            const configuredCommands = Object.keys(settings?.permissions?.commands || {});
            
            const filtered = configuredCommands
                .filter(c => c.toLowerCase().includes(focusedValue))
                .slice(0, 25);
            
            return interaction.respond(filtered.map(c => ({ name: `/${c.replace(':', ' ')}`, value: c })));
        }

        const commands = [
            'setup', 'initial', 'rolebuttons', 'autoroles', 'welcome', 'goodbye', 
            'leveling', 'form', 'ticket', 'send', 'purrpaw', 'speak', 'speak-voice', 
            'ban', 'unban', 'giverole', 'addset', 'daily', 'aichat', 'summary', 
            'fortune', 'mbti', 'sbti', 'rpg', 'private', 'setbg', 'toptier', 
            'profile', 'music', 'tts', 'scoreboard', 'ping', 'aichat-speak', 'termbot-clean', 'botqueue'
        ];

        const filtered = commands.filter(c => c.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filtered.map(c => ({ name: c, value: c })));
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const { settings } = await getGuildData(guildId);
        
        if (!settings.permissions) {
            settings.permissions = {
                mod_roles: [],
                commands: {}
            };
        }

        const perms = settings.permissions;

        if (sub === 'add-mod') {
            const role = interaction.options.getRole('role');
            if (!perms.mod_roles) perms.mod_roles = [];

            if (perms.mod_roles.includes(role.id)) {
                return interaction.reply({ content: `❌ Role **${role.name}** (ID: ${role.id}) เป็น Mod อยู่แล้วนะเมี๊ยว!`, ephemeral: true });
            }

            perms.mod_roles.push(role.id);
            await saveSettings(interaction, settings);
            return interaction.reply({ content: `✅ เพิ่ม Role **${role.name}** (ID: ${role.id}) เข้ากลุ่มสิทธิ์ **Mod** เรียบร้อยแล้วเมี๊ยวว!🐾` });
        }

        if (sub === 'remove-mod') {
            const role = interaction.options.getRole('role');
            if (!perms.mod_roles) perms.mod_roles = [];

            const index = perms.mod_roles.indexOf(role.id);
            if (index === -1) {
                return interaction.reply({ content: `❌ ไม่พบ Role **${role.name}** (ID: ${role.id}) ในกลุ่มสิทธิ์ Mod นะเมี๊ยว!`, ephemeral: true });
            }

            perms.mod_roles.splice(index, 1);
            await saveSettings(interaction, settings);
            return interaction.reply({ content: `✅ ลบ Role **${role.name}** ออกจากกลุ่มสิทธิ์ **Mod** เรียบร้อยแล้วเมี๊ยวว!🐾` });
        }

        if (sub === 'set-command') {
            const command = interaction.options.getString('command');
            const subcommand = interaction.options.getString('subcommand');
            const level = interaction.options.getString('level');
            
            const key = subcommand ? `${command}:${subcommand}` : command;
            
            if (!perms.commands) perms.commands = {};
            perms.commands[key] = level;

            await saveSettings(interaction, settings);
            return interaction.reply({ content: `✅ ตั้งค่าสิทธิ์คำสั่ง **/${key.replace(':', ' ')}** ให้เป็นระดับ **${level}** เรียบร้อยแล้วเมี๊ยวว!🐾` });
        }

        if (sub === 'clear-command') {
            const key = interaction.options.getString('command');
            
            if (!perms.commands || !perms.commands[key]) {
                return interaction.reply({ content: `❌ ไม่พบการตั้งค่าของคำสั่ง **/${key.replace(':', ' ')}** นะเมี๊ยว!`, ephemeral: true });
            }

            delete perms.commands[key];
            await saveSettings(interaction, settings);
            return interaction.reply({ content: `✅ ล้างการตั้งค่าสิทธิ์ของคำสั่ง **/${key.replace(':', ' ')}** เรียบร้อยแล้วเมี๊ยวว!🐾 (กลับไปใช้ค่าเริ่มต้น)` });
        }

        if (sub === 'move-command') {
            const key = interaction.options.getString('command');
            const newLevel = interaction.options.getString('level');

            if (!perms.commands || !perms.commands[key]) {
                return interaction.reply({ content: `❌ ไม่พบการตั้งค่าเดิมของคำสั่ง **/${key.replace(':', ' ')}** กรุณาใช้ set-command แทนนะเมี๊ยว!`, ephemeral: true });
            }

            perms.commands[key] = newLevel;
            await saveSettings(interaction, settings);
            return interaction.reply({ content: `✅ ย้ายระดับสิทธิ์คำสั่ง **/${key.replace(':', ' ')}** เป็นระดับ **${newLevel}** เรียบร้อยแล้วเมี๊ยวว!🐾` });
        }

        if (sub === 'list') {
            const embed = new EmbedBuilder()
                .setTitle('📋 รายการสิทธิ์การใช้งาน (Permissions) 🐾')
                .setColor('#5865F2')
                .addFields(
                    { name: '🛡️ Admin Access', value: 'เฉพาะผู้ที่มีสิทธิ์ **Administrator** ของเซิร์ฟเวอร์เท่านั้นเมี๊ยว🐾', inline: false },
                    { name: '⚔️ Mod Roles (สิทธิ์ที่เพิ่มเอง)', value: perms.mod_roles?.length > 0 ? perms.mod_roles.map(r => `• ${r}`).join('\n') : 'ยังไม่มีการตั้งค่า (ไม่มี Mod)', inline: false }
                );

            if (perms.commands && Object.keys(perms.commands).length > 0) {
                const cmdList = Object.entries(perms.commands).map(([cmd, lvl]) => `• **/${cmd}**: ${lvl}`).join('\n');
                embed.addFields({ name: '⚙️ คำสั่งที่ปรับแต่งสิทธิ์', value: cmdList });
            }

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'reload') {
            await interaction.deferReply({ ephemeral: true });
            const { REST, Routes } = require('discord.js');
            
            invalidateCache(guildId);
            
            // 1. ดึงข้อมูลสิทธิ์ใหม่
            const data = await getGuildData(guildId); 

            // 2. 🚀 Force Deploy คำสั่งใหม่ทั้งหมดให้เซิร์ฟเวอร์นี้ (เพื่อให้ Discord อัปเดตตัวล็อก Administrator)
            try {
                const rest = new REST().setToken(interaction.client.token);
                const commandsJSON = Array.from(interaction.client.commands.values()).map(c => c.data.toJSON());
                
                await rest.put(
                    Routes.applicationGuildCommands(interaction.client.user.id, guildId),
                    { body: commandsJSON }
                );
            } catch (err) {
                console.error('[Reload:Deploy] Failed:', err);
            }

            // 3. Sync การมองเห็นของ Mod Roles
            await syncDiscordPermissions(interaction, data.settings?.permissions);
            
            return interaction.editReply({ content: '🔄 **Force Reloaded & Synced!** บอทได้ทำการรีเฟรชคำสั่งและอัปเดตสิทธิ์การมองเห็นกับ Discord ให้ใหม่หมดแล้วเมี๊ยววว! (หากยังไม่หาย ให้ลองกด Ctrl+R เพื่อรีเฟรช Discord นะ🐾✨)' });
        }
    }
};

async function saveSettings(interaction, settings) {
    const guildId = interaction.guildId;
    await supabase.from('guilds').update({ settings }).eq('id', guildId);
    invalidateCache(guildId);
    
    // 🔄 Sync การมองเห็นคำสั่งกับ Discord ทันทีเมี๊ยว🐾
    try {
        await syncDiscordPermissions(interaction, settings.permissions);
    } catch (err) {
        console.error('[PermissionSync] Failed:', err);
    }
}

/**
 * 🔄 ฟังก์ชัน Sync สิทธิ์การมองเห็นคำสั่งกับ Discord API
 * เพื่อให้คนที่มีสิทธิ์เท่านั้นที่ "มองเห็น" คำสั่งในเมนู / เมี๊ยว🐾
 */
async function syncDiscordPermissions(interaction, perms) {
    if (!perms) return;
    const { guild } = interaction;
    const everyoneRoleId = guild.id;
    
    console.log(`[PermissionSync] Starting sync for Guild: ${guild.name} (${guild.id})`);

    // 1. ดึงรายการคำสั่งของเซิร์ฟเวอร์นี้
    const commands = await guild.commands.fetch();
    console.log(`[PermissionSync] Found ${commands.size} guild commands.`);

    // 2. ดึงรายการ Roles ใหม่ล่าสุด (ไม่ใช้ Cache) เมี๊ยว🐾
    await guild.roles.fetch();
    const modRoleRefs = perms.mod_roles || [];
    const modRoles = guild.roles.cache.filter(r => 
        modRoleRefs.includes(r.id) || modRoleRefs.includes(r.name)
    );
    const modRoleIds = modRoles.map(r => r.id);
    console.log(`[PermissionSync] Active Mod Roles found: ${modRoles.map(r => r.name).join(', ') || 'None'}`);

    const fullPermissions = [];

    for (const [cmdId, cmd] of commands) {
        const cmdName = cmd.name;
        
        const relatedKeys = Object.keys(perms.commands || {}).filter(k => 
            k === cmdName || k.startsWith(`${cmdName}:`)
        );

        if (relatedKeys.length === 0) continue;

        const allowedRoleIds = new Set();
        let isEveryone = false;

        for (const key of relatedKeys) {
            const level = perms.commands[key];
            if (level === 'everyone') {
                isEveryone = true;
                break;
            } else if (level === 'mod') {
                modRoleIds.forEach(id => allowedRoleIds.add(id));
            } else if (Array.isArray(level)) {
                const specificRoles = guild.roles.cache.filter(r => 
                    level.includes(r.id) || level.includes(r.name)
                );
                specificRoles.forEach(r => allowedRoleIds.add(r.id));
            }
        }

        const rolePermissions = [];
        if (isEveryone) {
            rolePermissions.push({ id: everyoneRoleId, type: 1, permission: true });
        } else if (allowedRoleIds.size > 0) {
            allowedRoleIds.forEach(id => {
                rolePermissions.push({ id, type: 1, permission: true });
            });
        }

        if (rolePermissions.length > 0) {
            console.log(`[PermissionSync] Setting perms for /${cmdName}: ${rolePermissions.length} rules.`);
            fullPermissions.push({ id: cmdId, permissions: rolePermissions });
        }
    }

    if (fullPermissions.length > 0) {
        try {
            await guild.commands.permissions.set({ fullPermissions });
            console.log(`[PermissionSync] Successfully updated ${fullPermissions.length} commands.`);
        } catch (e) {
            console.error(`[PermissionSync] Error:`, e.message);
        }
    } else {
        console.log(`[PermissionSync] No custom permissions to sync.`);
    }
}




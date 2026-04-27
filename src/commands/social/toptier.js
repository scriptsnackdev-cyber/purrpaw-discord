const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { drawBackground } = require('../../utils/canvasHelper');
const { fontStack, fontStackBold } = require('../../utils/fontHelper');

// 🎨 ฟังก์ชันช่วยวาดสี่เหลี่ยมมุมมนเมี๊ยว🐾
function drawRoundedRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toptier')
        .setDescription('🏆 ดูอันดับสุดยอดผู้ใช้งาน (Top Tier) ของเซิร์ฟเวอร์เมี๊ยว🐾')
        .addSubcommand(subcommand =>
            subcommand.setName('view')
                .setDescription('ดูอันดับสุดยอดผู้ใช้งานเมี๊ยว🐾')
                .addStringOption(option => 
                    option.setName('mode')
                        .setDescription('โหมดที่ต้องการดูอันดับ')
                        .setRequired(true)
                        .addChoices(
                            { name: '💬 แชท (Chat)', value: 'chat' },
                            { name: '🎙️ ห้องพูดคุย (Speaker)', value: 'speaker' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-text')
                .setDescription('⚙️ ตั้งค่าข้อความหัวตารางเมี๊ยว🐾 (สำหรับแอดมิน)')
                .addStringOption(option => 
                    option.setName('mode')
                        .setDescription('โหมดที่ต้องการตั้งค่า')
                        .setRequired(true)
                        .addChoices(
                            { name: '💬 แชท (Chat)', value: 'chat' },
                            { name: '🎙️ ห้องพูดคุย (Speaker)', value: 'speaker' }
                        )
                )
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('ข้อความที่ต้องการแสดง (ใส่ $text เพื่อคืนค่าเริ่มต้น)')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // --- SUBCOMMAND: SET-TEXT ---
        if (subcommand === 'set-text') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'งื้อออ เฉพาะแอดมินเท่านั้นที่ตั้งค่าได้นะเมี๊ยว🐾', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            const mode = interaction.options.getString('mode');
            const text = interaction.options.getString('text');

            // ดึง Settings เดิมมาเมี๊ยว🐾
            const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            const settingKey = mode === 'chat' ? 'toptier_title_chat' : 'toptier_title_speaker';
            
            if (text === '$text') {
                delete settings[settingKey];
            } else {
                settings[settingKey] = text;
            }

            const { error } = await supabase.from('guilds').update({ settings }).eq('id', guildId);
            
            if (error) {
                console.error('Update Settings Error:', error);
                return interaction.editReply({ content: 'งื้อออ เก็บข้อมูลลงฐานข้อมูลไม่สำเร็จเมี๊ยว🐾' });
            }

            return interaction.editReply({ content: `✅ ตั้งค่าหัวตาราง **${mode}** เป็น: **${text === '$text' ? 'ค่าเริ่มต้น' : text}** เรียบร้อยแล้วเมี๊ยว🐾` });
        }

        // --- SUBCOMMAND: VIEW ---
        await interaction.deferReply();
        const mode = interaction.options.getString('mode');

        // ดึง Settings สำหรับพื้นหลังและหัวข้อเมี๊ยว🐾
        const { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
        const settings = guildData?.settings || {};
        const customBgURL = settings.rank_background_url || null;

        let topData = [];
        let titleText = '';
        let colorTheme = ''; // แชทสีชมพู พูดคุยสีฟ้า

        if (mode === 'chat') {
            const { data } = await supabase.from('member_levels')
                .select('*')
                .eq('guild_id', guildId)
                .order('total_chars', { ascending: false })
                .limit(10);
            topData = data || [];
            titleText = settings.toptier_title_chat || '🏆 Top Tier Leaderboard - Chat 💬';
            colorTheme = '#FFB6C1'; // Pink
        } else {
            const { data } = await supabase.from('member_voice_levels')
                .select('*')
                .eq('guild_id', guildId)
                .order('total_seconds', { ascending: false })
                .limit(10);
            topData = data || [];
            titleText = settings.toptier_title_speaker || '🏆 Top Tier Leaderboard - Speaker 🎙️';
            colorTheme = '#A0C4FF'; // Blue
        }

        if (topData.length === 0) {
            return interaction.editReply({ content: 'ยังไม่มีข้อมูลสำหรับโหมดนี้เลยเมี๊ยว🐾 พิมพ์คุยกันก่อนน้าา~' });
        }

        // เตรียมข้อมูล User
        const rowHeight = 80;
        const startY = 140;
        const canvasHeight = startY + (topData.length * rowHeight) + 40;
        const canvas = createCanvas(800, canvasHeight);
        const ctx = canvas.getContext('2d');

        try {
            // วาดพื้นหลัง
            await drawBackground(ctx, canvas.width, canvas.height, customBgURL);

            // Overlay ทับพื้นหลังให้มืดลง เพื่อให้ข้อมูลเด่นขึ้น
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // วาด Title
            ctx.fillStyle = colorTheme;
            ctx.font = `bold 42px ${fontStackBold}`;
            ctx.textAlign = 'center';
            ctx.fillText(titleText, canvas.width / 2, 70);

            // วาดชื่อเซิร์ฟเวอร์
            const cleanGuildName = interaction.guild.name.replace(/[^\u0020-\u007E\u0E00-\u0E7F]/g, '').trim();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = `20px ${fontStack}`;
            ctx.fillText(`Server: ${cleanGuildName}`, canvas.width / 2, 105);

            // วาดทีละอันดับ
            ctx.textAlign = 'left';
            for (let i = 0; i < topData.length; i++) {
                const row = topData[i];
                const yPos = startY + (i * rowHeight);

                // พื้นหลังย่อยของแต่ละ Row
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                if (i === 0) ctx.fillStyle = 'rgba(255, 215, 0, 0.2)'; // ที่ 1 สีทอง
                if (i === 1) ctx.fillStyle = 'rgba(192, 192, 192, 0.2)'; // ที่ 2 สีเงิน
                if (i === 2) ctx.fillStyle = 'rgba(205, 127, 50, 0.2)'; // ที่ 3 สีทองแดง
                
                drawRoundedRect(ctx, 40, yPos, 720, 70, 15);

                // ดึงข้อมูล User
                let member = interaction.guild.members.cache.get(row.user_id);
                if (!member) {
                    try {
                        member = await interaction.guild.members.fetch(row.user_id);
                    } catch (e) {
                        member = null;
                    }
                }

                // Avatar
                const avatarSize = 50;
                const avatarX = 120;
                const avatarY = yPos + 10;
                
                let avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                let displayName = 'Unknown User';

                if (member) {
                    avatarURL = member.displayAvatarURL({ extension: 'png', size: 128 });
                    displayName = member.displayName;
                } else {
                    try {
                        const user = await interaction.client.users.fetch(row.user_id);
                        avatarURL = user.displayAvatarURL({ extension: 'png', size: 128 });
                        displayName = user.username;
                    } catch(e) {}
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();

                try {
                    const avatarImg = await loadImage(avatarURL);
                    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
                } catch(e) {}
                ctx.restore();

                // วาดอันดับ
                ctx.font = `bold 28px ${fontStackBold}`;
                ctx.fillStyle = (i === 0) ? '#FFD700' : (i === 1) ? '#C0C0C0' : (i === 2) ? '#CD7F32' : '#FFFFFF';
                ctx.fillText(`#${i + 1}`, 60, yPos + 45);

                // วาดชื่อ
                ctx.font = `bold 24px ${fontStackBold}`;
                ctx.fillStyle = '#FFFFFF';
                if (displayName.length > 20) displayName = displayName.substring(0, 18) + '...';
                ctx.fillText(displayName, 190, yPos + 43);

                // วาดสถิติ
                ctx.textAlign = 'right';
                ctx.font = `bold 20px ${fontStackBold}`;
                ctx.fillStyle = colorTheme;

                if (mode === 'chat') {
                    const totalChars = row.total_chars || 0;
                    const level = Math.floor(Math.sqrt(totalChars / 100));
                    ctx.fillText(`Lv. ${level}`, 730, yPos + 30);
                    
                    ctx.font = `16px ${fontStack}`;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.fillText(`${totalChars.toLocaleString()} XP`, 730, yPos + 55);
                } else {
                    const totalSeconds = row.total_seconds || 0;
                    const level = Math.floor(Math.sqrt(totalSeconds / 300));
                    const hours = (totalSeconds / 3600).toFixed(1);
                    ctx.fillText(`Lv. ${level}`, 730, yPos + 30);
                    
                    ctx.font = `16px ${fontStack}`;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.fillText(`${hours} Hrs`, 730, yPos + 55);
                }
                ctx.textAlign = 'left';
            }

            // ส่งรูป
            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'toptier.png' });
            return interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('Canvas Draw Error:', error);
            return interaction.editReply({ content: 'งื้อออ บอทสร้างการ์ดผิดพลาดเมี๊ยว🐾' });
        }
    }
};

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purrpaw')
        .setDescription('🐾 คำสั่งรวมพลังของแก๊งเหมียว')
        .addSubcommand(sub => 
            sub.setName('leave')
                .setDescription('⏹️ สั่งหยุดทุกอย่าง รื้อคิวเพลง ปิด TTS และออกจากห้องเมี๊ยว!🐾'))
        .addSubcommand(subcommand => subcommand.setName('help').setDescription('📖 ดูวิธีใช้งานปุ่มและคำสั่งต่างๆ ของบอท')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { guild, client } = interaction;

        if (sub === 'leave') {
            const voice = client.distube.voices.get(guild.id);
            const queue = client.distube.getQueue(guild.id);
            const ttsManager = client.ttsManager;

            // 1. ล้างคิวเพลง (ถ้ามี)
            if (queue) {
                await queue.stop();
            }

            // 2. ปิดโหมด TTS (ถ้าเปิดอยู่)
            if (ttsManager) {
                ttsManager.ttsChannels.delete(guild.id);
                ttsManager.queues.delete(guild.id);
                ttsManager.processing.delete(guild.id);
            }

            // 3. สั่งออกจากห้อง
            if (voice) {
                await voice.leave();
                return interaction.reply('⏹️ **[Magic Command]** หยุดทุกภารกิจ ล้มเลิกทุกคิว และออกจากห้องเมี๊ยว! ไว้พบกันใหม่นะเมี๊ยววว🐾🌸');
            } else {
                return interaction.reply({ content: '❌ บอทไม่ได้อยู่ในห้องเสียงตอนนี้อยู่แล้วนะเมี๊ยว!', ephemeral: true });
            }
        }

        if (sub === 'help') {
            const { EmbedBuilder } = require('discord.js');
            const helpEmbed = new EmbedBuilder()
                .setTitle('🐾 PurrPaw Bot - ศูนย์รวมการช่วยเหลือแบบครบวงจร 📖')
                .setDescription('เนรมิตเซิฟเวอร์ให้ดูดี มีชีวิตชีวาด้วยพลังแมว! นี่คือรายการคำสั่งทั้งหมดที่คุณสามารถใช้ได้เมี๊ยววว!')
                .setThumbnail(client.user.displayAvatarURL())
                .setColor('#FFB6C1')
                .addFields(
                    { 
                        name: '🤖 AI & Architecture (สถาปัตยกรรมแมว)', 
                        value: '• `/initial prompt:` - เนรมิตเซิฟเวอร์ทั้งระบบ พร้อมห้องและยศ!\n• `/aichat message:` - คุยกับน้องแมวที่ฉลาดมากๆ\n• `/summary:` - สรุปความเคลื่อนไหวในห้องนี้ 20 ข้อความล่าสุด!\n• `/rolebuttons add prompt:` - ใช้ AI ออกแบบยศย่อยและปุ่มรับยศ!' 
                    },
                    { 
                        name: '🎵 Music & Voice (ดนตรีและสุนทรียภาพ)', 
                        value: '• `/music play query:` - เปิดเพลงที่ต้องการ (YouTube/Spotify)\n• `/music stop:` - หยุดเพลงและล้างคิวทั้งหมด\n• `/music skip:` - ข้ามไปเพลงถัดไป\n• `/tts message:` - น้องแมวจะพูดข้อความที่คุณส่งให้!' 
                    },
                    { 
                        name: '🔮 Entertainment (ความบันเทิง)', 
                        value: '• `/fortune:` - ดูดวงด้วยไพ่ทาโรต์ 78 ใบแบบจัดเต็ม!\n• `/leveling:` - เช็คเลเวลและค่าประสบการณ์ของคุณเมี๊ยว!' 
                    },
                    { 
                        name: '🔘 Utility & Roles (จัดการยศและปุ่ม)', 
                        value: '• `/speak name: message: avatar:` - ส่งข้อความในนามตัวละคร (Webhook)!\n• `/rolebuttons create:` - สร้างปุ่มกดรับ Role แบบปกติ\n• `/rolebuttons menu:` - สร้างเมนูเลือกได้หลายยศในโพสต์เดียว\n• `/autoroles:` - ตั้งค่ายศที่แจกอัตโนมัติเมื่อสมาชิกเข้าเซิฟ' 
                    },
                    { 
                        name: '📝 Community & Features (ระบบจัดการชุมชน)', 
                        value: '• `/welcome /goodbye:` - ตั้งค่าข้อความต้อนรับและบอกลาเพื่อนๆ\n• `/form create:` - สร้างฟอร์มรับสมัครงานหรือแจ้งเรื่องต่างๆ\n• `/scoreboard:` - ดูอันดับผู้ที่คุยเก่งที่สุดในเซิฟเวอร์เมี๊ยว!' 
                    },
                    { 
                        name: '🚪 System (ระบบอื่นๆ)', 
                        value: '• `/purrpaw help:` - ดูคู่นี้แหละเมี๊ยว!\n• `/purrpaw leave:` - สั่งหยุดทุกอย่างและไล่บอทออกจากห้องเสียง!' 
                    }
                )
                .addFields({
                    name: '💡 เคล็ดลับจากน้องแมว:', 
                    value: 'สำหรับ **"ห้องยืนยันตัวตน"** หรือ **"หน้ารับยศย่อย"** ที่ปุ่มสร้างขึ้นมา คุณสามารถกดเพื่อรับยศ และกดซ้ำอีกครั้งเพื่อคืนยศได้เสมอนะเมี๊ยววนะ! 🐾'
                })
                .setFooter({ text: 'PurrPaw - Your Agentic Coding Assistant 🐈', iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        }
    },
};

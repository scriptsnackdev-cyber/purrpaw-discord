const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('form')
        .setDescription('📝 สร้างแบบฟอร์มยืนยันตัวตนหรือแบบสอบถามเมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('list').setDescription('📋 ดูรายชื่อแบบฟอร์มทั้งหมดในเซิร์ฟเวอร์เมี๊ยว'))
        .addSubcommand(sub => 
            sub.setName('edit')
                .setDescription('✏️ แก้ไขการตั้งค่าแบบฟอร์มที่มีอยู่เมี๊ยว')
                .addStringOption(o => o.setName('id').setDescription('ไอดีของแบบฟอร์ม (ดูจาก /form list)เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('title').setDescription('หัวข้อใหม่ของ Embed เมี๊ยว'))
                .addStringOption(o => o.setName('message').setDescription('เนื้อหาใหม่ของ Embed เมี๊ยว'))
                .addStringOption(o => o.setName('button').setDescription('ข้อความบนปุ่มใหม่เมี๊ยว'))
                .addStringOption(o => o.setName('popup_title').setDescription('หัวข้อใหม่ของหน้าต่างป๊อปอัพเมี๊ยว'))
                .addStringOption(o => o.setName('q1').setDescription('คำถามที่ 1 ใหม่เมี๊ยว'))
                .addStringOption(o => o.setName('q2').setDescription('คำถามที่ 2 ใหม่เมี๊ยว'))
                .addStringOption(o => o.setName('q3').setDescription('คำถามที่ 3 ใหม่เมี๊ยว'))
                .addStringOption(o => o.setName('q4').setDescription('คำถามที่ 4 ใหม่เมี๊ยว'))
                .addStringOption(o => o.setName('q5').setDescription('คำถามที่ 5 ใหม่เมี๊ยว'))
                .addRoleOption(o => o.setName('role').setDescription('Role ใหม่ที่จะแจกเมี๊ยว'))
                .addRoleOption(o => o.setName('remove-role').setDescription('Role ใหม่ที่จะดึงออกเมี๊ยว'))
                .addStringOption(o => o.setName('mode').setDescription('โหมดการอนุมัติใหม่เมี๊ยว').addChoices({ name: 'อัตโนมัติ (Auto)', value: 'auto' }, { name: 'ตรวจสอบเอง (Manual)', value: 'manual' })))
        .addSubcommand(sub => 
            sub.setName('delete')
                .setDescription('🗑️ ลบแบบฟอร์มด้วยไอดีเมี๊ยว')
                .addStringOption(o => o.setName('id').setDescription('ไอดีของแบบฟอร์ม (ดูจาก /form list)เมี๊ยว').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('create')
                .setDescription('✨ สร้างข้อความแบบฟอร์มใหม่ (ตั้งคำถามได้สูงสุด 5 ข้อเมี๊ยว)')
                .addStringOption(o => o.setName('title').setDescription('หัวข้อของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('message').setDescription('เนื้อหาของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('button').setDescription('ข้อความบนปุ่ม (ใส่โมจิได้นะเมี๊ยว)').setRequired(true))
                .addStringOption(o => o.setName('popup_title').setDescription('หัวข้อของหน้าต่างป๊อปอัพเป้าหมายเมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('q1').setDescription('คำถามที่ 1 (จำเป็นต้องมีเมี๊ยว)').setRequired(true))
                .addStringOption(o => o.setName('mode')
                    .setDescription('โหมดการอนุมัติเมี๊ยว')
                    .setRequired(true)
                    .addChoices(
                        { name: '✅ อนุมัติอัตโนมัติ (รับ Role ทันทีที่ส่ง)', value: 'auto' },
                        { name: '⏳ รอแอดมินตรวจสอบ (ส่งให้แอดมินดูก่อน)', value: 'manual' }
                    ))
                .addStringOption(o => o.setName('q2').setDescription('คำถามที่ 2 (ไม่ใส่ก็ได้เมี๊ยว)'))
                .addStringOption(o => o.setName('q3').setDescription('คำถามที่ 3 (ไม่ใส่ก็ได้เมี๊ยว)'))
                .addStringOption(o => o.setName('q4').setDescription('คำถามที่ 4 (ไม่ใส่ก็ได้เมี๊ยว)'))
                .addStringOption(o => o.setName('q5').setDescription('คำถามที่ 5 (ไม่ใส่ก็ได้เมี๊ยว)'))
                .addRoleOption(o => o.setName('role').setDescription('Role ที่จะแจกหลังจากอนุมัติเมี๊ยว'))
                .addRoleOption(o => o.setName('remove-role').setDescription('Role ที่จะดึงออกหลังจากอนุมัติเมี๊ยว')))
        .addSubcommand(sub => 
            sub.setName('set')
                .setDescription('⚙️ ตั้งค่าระบบแบบฟอร์มเมี๊ยว')
                .addChannelOption(o => 
                    o.setName('approve_channel')
                        .setDescription('ห้องสำหรับให้แอดมินกดอนุมัติเมี๊ยว')
                        .addChannelTypes(ChannelType.GuildText))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'set') {
            const channel = interaction.options.getChannel('approve_channel');
            if (!channel) return;

            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (!settings.form) settings.form = {};
            settings.form.approve_channel_id = channel.id;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);

            return interaction.reply({ content: `✅ ตั้งค่าห้องอนุมัติสำหรับแอดมินเป็นห้อง ${channel} เรียบร้อยแล้วเมี๊ยวว!`, ephemeral: true });
        }

        if (sub === 'list') {
            const { data: forms } = await supabase.from('forms').select('id, title').eq('guild_id', guildId);
            if (!forms || forms.length === 0) return interaction.reply({ content: '❌ ไม่เจอแบบฟอร์มในเซิร์ฟเวอร์นี้เลยเมี๊ยว', ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle('📋 รายชื่อแบบฟอร์มในเซิร์ฟเวอร์เมี๊ยว')
                .setColor(0x3B82F6)
                .setDescription(forms.map(f => `**หัวข้อ:** ${f.title}\n**ID:** \`${f.id}\``).join('\n\n'));

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'edit') {
            const formId = interaction.options.getString('id');
            const { data: existing } = await supabase.from('forms').select('*').eq('id', formId).single();
            if (!existing) return interaction.reply({ content: '❌ หาแบบฟอร์มไม่เจอเมี๊ยว!', ephemeral: true });

            const updates = {};
            if (interaction.options.getString('title')) updates.title = interaction.options.getString('title');
            if (interaction.options.getString('message')) updates.description = interaction.options.getString('message');
            if (interaction.options.getString('button')) updates.button_label = interaction.options.getString('button');
            if (interaction.options.getString('popup_title')) updates.modal_title = interaction.options.getString('popup_title');
            if (interaction.options.getString('mode')) updates.mode = interaction.options.getString('mode');
            if (interaction.options.getRole('role')) updates.role_id = interaction.options.getRole('role').id;
            if (interaction.options.getRole('remove-role')) updates.remove_role_id = interaction.options.getRole('remove-role').id;

            const newQuestions = [...(existing.modal_questions || [])];
            for (let i = 1; i <= 5; i++) {
                const q = interaction.options.getString(`q${i}`);
                if (q) newQuestions[i - 1] = q;
            }
            updates.modal_questions = newQuestions.filter(q => q);

            await supabase.from('forms').update(updates).eq('id', formId);
            return interaction.reply({ content: `✅ แก้ไขแบบฟอร์มไอดี \`${formId}\` เรียบร้อยแล้วเมี๊ยวว!`, ephemeral: true });
        }

        if (sub === 'delete') {
            const formId = interaction.options.getString('id');
            const { error } = await supabase.from('forms').delete().eq('id', formId).eq('guild_id', guildId);

            if (error) return interaction.reply({ content: '❌ ลบแบบฟอร์มไม่ได้เมี๊ยว เช็คไอดีดีๆ นะ!', ephemeral: true });
            return interaction.reply({ content: `✅ ลบแบบฟอร์มไอดี \`${formId}\` เรียบร้อยแล้วเมี๊ยว! (ปุ่มเดิมจะใช้ไม่ได้แล้วนะ🐾)`, ephemeral: true });
        }

        if (sub === 'create') {
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('message');
            const buttonLabel = interaction.options.getString('button');
            const modalTitle = interaction.options.getString('popup_title');
            const mode = interaction.options.getString('mode');
            
            const questions = [
                interaction.options.getString('q1'),
                interaction.options.getString('q2'),
                interaction.options.getString('q3'),
                interaction.options.getString('q4'),
                interaction.options.getString('q5')
            ].filter(q => q);

            const role = interaction.options.getRole('role');
            const removeRole = interaction.options.getRole('remove-role');

            const { data: formData, error } = await supabase.from('forms').insert({
                guild_id: guildId,
                title,
                description,
                button_label: buttonLabel,
                modal_title: modalTitle,
                modal_questions: questions,
                role_id: role?.id || null,
                remove_role_id: removeRole?.id || null,
                mode
            }).select().single();

            if (error) {
                console.error('Supabase error creating form:', error);
                return interaction.reply({ content: '❌ สร้างแบบฟอร์มลง Database ไม่สำเร็จเมี๊ยว!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`ฅ^•ﻌ•^ฅ ${title}`)
                .setDescription(description.replace(/\\n/g, '\n'))
                .setColor(0x3B82F6) 
                .setFooter({ text: 'PurrPaw Verification System 🐾' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`form_open:${formData.id}`)
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ content: '✅ สร้างแบบฟอร์มสำเร็จแล้วเมี๊ยวว!', ephemeral: true });
            return await interaction.channel.send({ embeds: [embed], components: [row] });
        }
    }
};

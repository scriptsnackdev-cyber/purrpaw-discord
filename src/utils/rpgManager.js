const supabase = require('../supabaseClient');
const { getChatAI } = require('./openRouter');
const { generateRPGImage } = require('./rpgImage');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function startRPGGame(interaction, channelId, userId) {
    const { data: session } = await supabase
        .from('rpg_sessions')
        .select('*')
        .eq('channel_id', channelId)
        .eq('status', 'lobby')
        .single();

    if (!session) {
        const msg = '❌ ไม่มีห้องที่กำลังรอเริ่มในห้องนี้เมี๊ยว';
        return interaction.replied || interaction.deferred ? interaction.editReply(msg) : interaction.reply({ content: msg, ephemeral: true });
    }

    if (session.creator_id !== userId) {
        const msg = '❌ เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่เริ่มเกมได้นะเมี๊ยว!';
        return interaction.replied || interaction.deferred ? interaction.editReply(msg) : interaction.reply({ content: msg, ephemeral: true });
    }

    if (interaction.isButton()) {
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription('🎬 **การผจญภัยเริ่มต้นขึ้นแล้ว!** ขอให้เหล่าผู้กล้าโชคดีเมี๊ยว🐾')
            .setImage(null)
            .setFooter({ text: 'สถานะ: กำลังผจญภัย...' });
        
        await interaction.update({ embeds: [updatedEmbed], components: [], files: [] });
    }

    await supabase.from('rpg_sessions').update({ status: 'active' }).eq('id', session.id);

    const playerList = session.players.map(p => p.name).join(', ');
    const systemPrompt = `คุณคือ Game Master (GM) อัจฉริยะ 
นี่คือการผจญภัยสวมบทบาท (RPG) ในธีม: ${session.theme}
รายชื่อผู้เล่น: ${playerList}

คำแนะนำการตอบกลับ (สำคัญมาก):
โปรดตอบกลับในรูปแบบ XML Tags ดังนี้เท่านั้น:
<goal>ระบุเป้าหมายสูงสุดแฝง (เฉพาะรอบแรก)</goal>
<story>บรรยายเนื้อเรื่องสไตล์นิยายไลท์โนเวลญี่ปุ่นที่สละสลวยและละเอียด (600-1000 ตัวอักษร)</story>
<choice_a>ข้อความปุ่ม A (สั้นกระชับ ไม่เกิน 25 ตัวอักษร)</choice_a>
<choice_b>ข้อความปุ่ม B (สั้นกระชับ ไม่เกิน 25 ตัวอักษร)</choice_b>
<choice_c>ข้อความปุ่ม C (สั้นกระชับ ไม่เกิน 25 ตัวอักษร)</choice_c>

กฎเหล็ก:
1. ห้ามบ่นว่าผู้เล่นไม่ได้เลือก หรือบอกว่า GM จะสุ่มให้
2. **ปุ่มตัวเลือก:** ห้ามใส่ชื่อผู้เล่นคนใดคนหนึ่งลงในปุ่ม (choice_a-c) ให้ใช้เป็น "การกระทำกลางๆ" ที่ใครในทีมก็ทำได้
3. ต้องระบุชัดเจนในส่วนของ <story> ว่าผู้เล่นแต่ละคนทำอะไรและเกิดผลอย่างไรตามที่เขาเลือกมา
4. ภาษาไทยที่สุ่มละสลวย มีเสน่ห์แบบนิยายญี่ปุ่นเมี๊ยว!`;

    const aiResponse = await getChatAI([{ role: 'system', content: systemPrompt }, { role: 'user', content: 'เริ่มการผจญภัย!' }]);
    
    const { story, goal, buttons } = parseXMLResponse(aiResponse, session.id);

    const attachment = await generateRPGImage(session.players, interaction, []);

    const embed = new EmbedBuilder()
        .setTitle(`🔮 บทนำ: ${session.theme}`)
        .setDescription(story)
        .setImage('attachment://rpg_status.png')
        .setColor(0x8B5CF6);

    const row = new ActionRowBuilder().addComponents(buttons);

    const initialLog = [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: story }
    ];
    await supabase.from('rpg_sessions').update({ 
        story_log: initialLog,
        goal: goal || 'ออกผจญภัยและค้นหาความลับของโลกใบนี้'
    }).eq('id', session.id);

    return interaction.channel.send({ 
        content: `✨ **ตำนานบทใหม่ได้อุบัติขึ้นแล้ว!** <@${session.creator_id}> นำทีมออกเดินทาง...`, 
        embeds: [embed], 
        components: [row],
        files: attachment ? [attachment] : []
    });
}

async function handleRPGAction(interaction, actionValue, sessionId) {
    const userId = interaction.user.id;

    const { data: session, error: sessionError } = await supabase
        .from('rpg_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session) return interaction.reply({ content: '❌ ไม่พบข้อมูลการผจญภัยนี้เมี๊ยว', ephemeral: true });
    
    if (actionValue === 'STOP') {
        if (session.creator_id !== userId && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ เฉพาะหัวหน้าปาร์ตี้หรือแอดมินเท่านั้นที่สั่งจบได้เมี๊ยว!', ephemeral: true });
        }
        return await endRPGGame(interaction, session);
    }

    if (session.status !== 'active') return interaction.reply({ content: '❌ การผจญภัยนี้จบไปแล้วเมี๊ยว', ephemeral: true });

    const players = session.players || [];
    const currentPlayer = players.find(p => p.id === userId);
    if (!currentPlayer) return interaction.reply({ content: '❌ คุณไม่ได้อยู่ในปาร์ตี้นี้นะเมี๊ยว!', ephemeral: true });

    const { data: existingAction } = await supabase
        .from('rpg_actions')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('round_number', session.current_round)
        .single();

    if (existingAction) return interaction.reply({ content: '❌ คุณเลือกไปแล้วในรอบนี้ รอเพื่อนๆ ก่อนนะเมี๊ยว🐾', ephemeral: true });

    const button = interaction.message.components[0].components.find(c => c.customId === interaction.customId);
    const buttonLabel = button ? button.label : actionValue;

    await supabase.from('rpg_actions').insert({
        session_id: sessionId,
        user_id: userId,
        round_number: session.current_round,
        action_type: 'choice',
        action_value: buttonLabel
    });

    const { data: allActions } = await supabase
        .from('rpg_actions')
        .select('user_id, action_value')
        .eq('session_id', sessionId)
        .eq('round_number', session.current_round);

    const actedUserIds = allActions.map(a => a.user_id);

    if (allActions.length >= players.length) {
        const attachment = await generateRPGImage(players, interaction, actedUserIds);
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setImage('attachment://rpg_status.png');

        await interaction.update({
            embeds: [updatedEmbed],
            components: [],
            files: attachment ? [attachment] : []
        });

        await processNextRound(interaction, session, allActions);
    } else {
        const attachment = await generateRPGImage(players, interaction, actedUserIds);
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setImage('attachment://rpg_status.png');

        await interaction.update({
            embeds: [updatedEmbed],
            files: attachment ? [attachment] : []
        });
    }
}

async function processNextRound(interaction, session, actions) {
    const channel = interaction.channel;
    await channel.sendTyping();

    const playerActionsSummary = actions.map(a => {
        const p = session.players.find(player => player.id === a.user_id);
        return `${p ? p.name : 'ผู้กล้า'} ตัดสินใจเลือกที่จะ: "${a.action_value}"`;
    }).join('\n');

    const nextRound = session.current_round + 1;
    let storyLog = session.story_log || [];

    const goalContext = session.goal ? `\n(ย้ำเป้าหมายแฝง: ${session.goal} - โปรดใบ้ให้เข้าใกล้สิ่งนี้)` : '';

    storyLog.push({ role: 'user', content: `ทุกคนตัดสินใจแล้วในรอบนี้:\n${playerActionsSummary}${goalContext}\n\nจงบรรยายบทถัดไปและให้ทางเลือกใหม่โดยใช้รูปแบบ XML Tags (<story>, <choice_a-c>) เท่านั้นเมี๊ยว!` });

    const aiResponse = await getChatAI(storyLog);
    const { story, buttons } = parseXMLResponse(aiResponse, session.id);

    storyLog.push({ role: 'assistant', content: story });

    await supabase.from('rpg_sessions').update({
        story_log: storyLog,
        current_round: nextRound
    }).eq('id', session.id);

    const attachment = await generateRPGImage(session.players, interaction, []);

    const embed = new EmbedBuilder()
        .setTitle(`🔮 การผจญภัย รอบที่ ${nextRound}`)
        .setDescription(story)
        .setImage('attachment://rpg_status.png')
        .setColor(0x8B5CF6);

    const row = new ActionRowBuilder().addComponents(buttons);

    await channel.send({ 
        content: `✨ **ทุกคนเลือกครบแล้ว!** มาดูผลลัพธ์กันเมี๊ยว...`, 
        embeds: [embed], 
        components: [row],
        files: attachment ? [attachment] : []
    });
}

async function endRPGGame(interaction, session) {
    await interaction.deferReply();
    const storyLog = session.story_log || [];
    
    const summaryPrompt = [
        ...storyLog,
        { role: 'user', content: 'การผจญภัยต้องจบลงเพียงเท่านี้ จงสรุปเหตุการณ์ทั้งหมดที่เกิดขึ้นมาอย่างน่าประทับใจและปิดตำนานนี้ในแท็ก <story> เท่านั้นเมี๊ยว!' }
    ];
    
    const aiResponse = await getChatAI(summaryPrompt);
    const { story } = parseXMLResponse(aiResponse, session.id);
    
    await supabase.from('rpg_sessions').update({ status: 'ended' }).eq('id', session.id);
    
    const embed = new EmbedBuilder()
        .setTitle('📜 บทสรุปแห่งตำนาน')
        .setDescription(story)
        .setColor(0xFF0000)
        .setFooter({ text: 'ขอบคุณเหล่าผู้กล้าทุกท่านที่ร่วมเดินทางเมี๊ยว🐾' });
        
    return interaction.editReply({ embeds: [embed], components: [] });
}

function parseXMLResponse(text, sessionId) {
    const story = text.match(/<story>([\s\S]*?)<\/story>/i)?.[1] || text;
    const goal = text.match(/<goal>([\s\S]*?)<\/goal>/i)?.[1] || null;
    const labelA = text.match(/<choice_a>([\s\S]*?)<\/choice_a>/i)?.[1] || 'เลือกข้อ A';
    const labelB = text.match(/<choice_b>([\s\S]*?)<\/choice_b>/i)?.[1] || 'เลือกข้อ B';
    const labelC = text.match(/<choice_c>([\s\S]*?)<\/choice_c>/i)?.[1] || 'เลือกข้อ C';

    const buttons = [
        new ButtonBuilder().setCustomId(`rpg_action:A:${sessionId}`).setLabel(labelA.trim().substring(0, 40)).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rpg_action:B:${sessionId}`).setLabel(labelB.trim().substring(0, 40)).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rpg_action:C:${sessionId}`).setLabel(labelC.trim().substring(0, 40)).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rpg_action:STOP:${sessionId}`).setLabel('🛑 จบการผจญภัย').setStyle(ButtonStyle.Danger)
    ];

    return { story: story.trim(), goal: goal ? goal.trim() : null, buttons };
}

module.exports = { handleRPGAction, startRPGGame };

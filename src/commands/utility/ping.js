const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('เช็คความไวในการตอบรับของเจ้าเหมียว (Ping!)'),
    async execute(interaction) {
        await interaction.reply('เมี้ยว! ป๋อง! (Pong!) ทุกอย่างปกติดีนะเมี๊ยว~ 🐾');
    },
};

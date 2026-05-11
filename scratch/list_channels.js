const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = '1468286433495355462';
const EXCLUDE_CATEGORIES = ['ADMIN', '𓊆 ✦•──๑ 🔒| โกดังเก็บเหมียว ๑──•✦ 𓊇'];

client.once('ready', async () => {
    try {
        console.log(`Logged in as ${client.user.tag}`);
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            console.error('Guild not found');
            process.exit(1);
        }

        const channels = await guild.channels.fetch();
        
        // Sort channels by position
        const sortedChannels = Array.from(channels.values()).sort((a, b) => a.position - b.position);

        let output = `🐾 Discord Room List: ${guild.name}\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        const categories = sortedChannels.filter(c => c.type === 4); // 4 is GuildCategory
        const uncategorized = sortedChannels.filter(c => !c.parentId && c.type !== 4);

        // Filter out excluded categories
        const filteredCategories = categories.filter(cat => !EXCLUDE_CATEGORIES.includes(cat.name.trim()));

        if (uncategorized.length > 0) {
            output += `📁 [ไม่มีหมวดหมู่]\n`;
            uncategorized.forEach(channel => {
                output += `   ├─ ${channel.name}\n`;
            });
            output += `\n`;
        }

        filteredCategories.forEach((category, index) => {
            output += `📂 ${category.name}\n`;
            const categoryChannels = sortedChannels.filter(c => c.parentId === category.id);
            categoryChannels.forEach((channel, cIndex) => {
                const isLast = cIndex === categoryChannels.length - 1;
                output += `   ${isLast ? '└─' : '├─'} ${channel.name}\n`;
            });
            output += `\n`;
        });

        fs.writeFileSync('room_list.txt', output);
        console.log('Successfully updated room_list.txt (filtered)');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);

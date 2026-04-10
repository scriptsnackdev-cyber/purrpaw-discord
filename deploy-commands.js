require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        }
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // 🚀 ระบบตรวจจับการลงทะเบียน:
        // ถ้าใส่ GUILD_ID ใน .env -> ลงทะเบียนระดับ Guild (เร็วมาก)
        // ถ้าไม่ใส่ -> ลงทะเบียนระดับ Global (รออัปเดต ~1 ชั่วโมง)
        const data = process.env.GUILD_ID 
            ? await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
              )
            : await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
              );

        console.log(`Successfully reloaded ${data.length} commands ${process.env.GUILD_ID ? '(GUILD MODE)' : '(GLOBAL MODE)'}.`);
    } catch (error) {
        console.error(error);
    }
})();

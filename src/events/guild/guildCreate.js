const { Events } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        console.log(`Bot joined new guild: ${guild.name} (ID: ${guild.id})`);

        // บันทึกข้อมูลลง Supabase (Upsert ในกรณีที่เคยอยู่แล้วกลับมาใหม่)
        const { data, error } = await supabase
            .from('guilds')
            .upsert({
                id: guild.id,
                name: guild.name,
                owner_id: guild.ownerId,
                features: { role_button: true, auto_role: false, music: true },
                settings: {
                    bot_name: "", 
                    bot_avatar: "", 
                    music: { volume: 50, autoplay: false }
                }
            }, { onConflict: 'id' });

        if (error) {
            console.error('Error auto-registering guild to Supabase:', error.message);
        } else {
            console.log(`Successfully registered guild ${guild.name} to Supabase.`);
        }
    },
};

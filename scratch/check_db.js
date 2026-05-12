require('dotenv').config();
const supabase = require('../src/supabaseClient');

async function checkDB() {
    console.log('--- Checking Guilds ---');
    const { data: guilds, error: gError } = await supabase
        .from('guilds')
        .select('id, settings')
        .order('id', { ascending: false });
    
    if (gError) console.error('Guilds Error:', gError);
    else {
        guilds.forEach(g => {
            console.log(`Guild ID: ${g.id}`);
            console.log(`Settings: ${JSON.stringify(g.settings, null, 2)}`);
        });
    }

    console.log('\n--- Checking Forms ---');
    const { data: forms, error: fError } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

    if (fError) console.error('Forms Error:', fError);
    else {
        forms.forEach(f => {
            console.log(`Form ID: ${f.id}`);
            console.log(`Guild ID: ${f.guild_id}`);
            console.log(`Title: ${f.title}`);
            console.log(`Log Channel ID: ${f.log_channel_id}`);
            console.log(`Mode: ${f.mode}`);
            console.log(`Created At: ${f.created_at}`);
        });
    }
}

checkDB();

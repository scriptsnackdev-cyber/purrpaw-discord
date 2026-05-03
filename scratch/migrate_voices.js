require('dotenv').config();
const supabase = require('../src/supabaseClient');
const voiceDetails = require('../src/utils/voice_details.json');
const voiceRecommend = require('../src/utils/voice_recommend.json');

async function migrate() {
    console.log('Starting migration...');

    const recommendedIds = new Set(voiceRecommend.map(v => v.id));

    const rows = Object.entries(voiceDetails).map(([id, details]) => ({
        voice_id: id,
        name: details.name,
        gender: details.gender,
        description: details.desc,
        is_recommended: recommendedIds.has(id)
    }));

    const { data, error } = await supabase
        .from('tts_voices')
        .upsert(rows, { onConflict: 'voice_id' });

    if (error) {
        console.error('Migration failed:', error);
    } else {
        console.log('Migration successful!', data);
    }
}

migrate();

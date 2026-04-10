const axios = require('axios');

/**
 * ค้นหา GIF จาก Tenor
 * @param {string} query - คำค้นหา (เช่น "cat happy", "cute cat")
 * @returns {Promise<string|null>} - ลิงก์ GIF หรือ null
 */
async function searchGif(query) {
    const apiKey = process.env.TENOR_API_KEY;
    if (!apiKey || apiKey === 'your_tenor_api_key') return null;

    try {
        const response = await axios.get('https://tenor.googleapis.com/v2/search', {
            params: {
                q: query,
                key: apiKey,
                client_key: 'purrpaw_bot', // ชื่อแอป
                limit: 1, // เอาแค่อันเดียวที่ตรงที่สุด
                media_filter: 'gif'
            }
        });

        const results = response.data.results;
        if (results && results.length > 0) {
            return results[0].media_formats.gif.url;
        }
        return null;
    } catch (error) {
        console.error('Tenor API Error:', error.message);
        return null;
    }
}

module.exports = { searchGif };

const { RankCardBuilder, Fonts } = require('canvacord');
const fs = require('fs');

async function test() {
    try {
        await Fonts.loadDefault(); // ต้องโหลดฟอนต์ก่อนเมี๊ยว! 🐾
        const rank = new RankCardBuilder()
            .setAvatar("https://cdn.discordapp.com/embed/avatars/0.png")
            .setCurrentXP(100)
            .setRequiredXP(1000)
            .setLevel(1)
            .setUsername("PurrPaw")
            .setDisplayName("Test Display");

        const image = await rank.build();
        fs.writeFileSync('test-rank.png', image);
        console.log('Success!');
    } catch (e) {
        console.error(e);
    }
}
test();

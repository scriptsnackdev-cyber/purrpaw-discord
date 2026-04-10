-- ตารางสะสมคะแนนเลเวลห้องพูดคุย (Voice Leveling) เมี๊ยว🐾
CREATE TABLE IF NOT EXISTS member_voice_levels (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    user_id TEXT,
    total_seconds BIGINT DEFAULT 0,
    current_level INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
);

-- ตารางรางวัลยศตามเลเวลห้องพูดคุย (Voice Level Rewards)
CREATE TABLE IF NOT EXISTS voice_level_rewards (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    level INTEGER,
    role_id TEXT,
    PRIMARY KEY (guild_id, level)
);

-- เปิด RLS สำหรับบอท
ALTER TABLE member_voice_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_level_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to member_voice_levels" ON member_voice_levels FOR ALL TO service_role USING (true);
CREATE POLICY "Service role has full access to voice_level_rewards" ON voice_level_rewards FOR ALL TO service_role USING (true);

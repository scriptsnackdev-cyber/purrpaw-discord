-- ตารางสะสมคะแนนการแชท (Chat Leveling) เมี๊ยว🐾
CREATE TABLE IF NOT EXISTS member_levels (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    user_id TEXT,
    total_chars BIGINT DEFAULT 0,
    current_level INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
);

-- ตารางรางวัลยศตามเลเวล (Level Rewards)
CREATE TABLE IF NOT EXISTS level_rewards (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    level INTEGER,
    role_id TEXT,
    PRIMARY KEY (guild_id, level)
);

-- เปิด RLS (Row Level Security)
ALTER TABLE member_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_rewards ENABLE ROW LEVEL SECURITY;

-- นโยบายการเข้าถึง (Policies) สำหรับบอท
CREATE POLICY "Service role has full access to member_levels" ON member_levels FOR ALL TO service_role USING (true);
CREATE POLICY "Service role has full access to level_rewards" ON level_rewards FOR ALL TO service_role USING (true);

-- 1. ตารางเก็บโปรไฟล์ตัวละคร AI
CREATE TABLE IF NOT EXISTS ai_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT,
    persona TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ตารางเก็บสถานะการ Summon (AI ตัวไหน สิงห้องไหน)
CREATE TABLE IF NOT EXISTS active_ai_chats (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    character_id UUID REFERENCES ai_characters(id) ON DELETE CASCADE,
    memory_limit INTEGER DEFAULT 10,       -- จำนวนข้อความย้อนหลังที่จำได้
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. เปิด RLS
ALTER TABLE ai_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_ai_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access to ai_characters" ON ai_characters FOR ALL TO service_role USING (true);
CREATE POLICY "Full access to active_ai_chats" ON active_ai_chats FOR ALL TO service_role USING (true);

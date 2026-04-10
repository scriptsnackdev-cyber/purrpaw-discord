-- ปรับปรุงตาราง active_ai_chats ให้รองรับ AI หลายตัวต่อ 1 ห้อง
DROP TABLE IF EXISTS active_ai_chats;

CREATE TABLE IF NOT EXISTS active_ai_chats (
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    character_id UUID REFERENCES ai_characters(id) ON DELETE CASCADE,
    memory_limit INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (channel_id, character_id) -- ทำงานร่วมกันทั้ง ID ห้อง และ ID ตัวละคร
);

ALTER TABLE active_ai_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access to active_ai_chats" ON active_ai_chats FOR ALL TO service_role USING (true);

-- (Optional) ลบคอลัมน์เดิมออกถ้าเคยรันไปแล้วเมี๊ยว🐾
ALTER TABLE guilds DROP COLUMN IF EXISTS tts_premium_enabled;
ALTER TABLE guilds DROP COLUMN IF EXISTS tts_premium_limit_thb;

ALTER TABLE guilds 
ADD COLUMN IF NOT EXISTS balance_thb NUMERIC(10, 2) DEFAULT 0.00;

-- สำหรับเก็บสถิติการใช้งาน TTS รายวัน เพื่อตรวจสอบ Limit (ยังคงแยกตารางไว้เพื่อความรวดเร็วในการ Query)
CREATE TABLE IF NOT EXISTS tts_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    characters_count INTEGER DEFAULT 0,
    cost_thb NUMERIC(10, 4) DEFAULT 0.0000
);

COMMENT ON TABLE tts_usage_logs IS 'ตารางเก็บประวัติการใช้งาน TTS เพื่อคำนวณงบประมาณรายวัน';

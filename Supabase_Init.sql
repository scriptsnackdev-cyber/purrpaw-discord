-- 1. สร้างตาราง guilds เพื่อเก็บสถานะหลักและ "การเปิด/ปิดฟีเจอร์" ไว้ใน JSONB
CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,                       -- Discord Guild ID
    name TEXT,                                  -- ชื่อเซิร์ฟเวอร์
    owner_id TEXT,                              -- ID ของเจ้าของเซิร์ฟ
    
    -- รวมสถานะเปิด/ปิดทุกอย่างไว้ที่นี่ เช่น {"role_button": true, "music": true}
    features JSONB DEFAULT '{"role_button": true, "auto_role": false, "music": true}'::jsonb,
    
    -- เก็บ Metadata บอทและเซ็ตติ้งเพลง (ใช้สำหรับ Dashboard)
    settings JSONB DEFAULT '{
        "bot_name": "", 
        "bot_avatar": "", 
        "music": {"volume": 50, "autoplay": false}
    }'::jsonb,

    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. สร้างตาราง auto_roles (เก็บเฉพาะข้อมูลยศที่จะแจก)
CREATE TABLE IF NOT EXISTS auto_roles (
    guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    role_id TEXT                               -- ID ของยศที่จะมอบให้อัตโนมัติ
);

-- 3. สร้างตาราง role_buttons เพื่อเก็บข้อมูลปุ่มที่เราสร้าง
CREATE TABLE IF NOT EXISTS role_buttons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id TEXT,
    message_id TEXT,
    role_id TEXT,
    title TEXT,
    description TEXT,
    button_label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 🔒 ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- 1. เปิด RLS สำหรับทุกตาราง
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_buttons ENABLE ROW LEVEL SECURITY;

-- 2. POLICIES สำหรับตาราง guilds
-- ให้ Service Role เข้าถึงได้ทุกอย่าง (สำหรับ Bot)
CREATE POLICY "Service role has full access to guilds" ON guilds FOR ALL TO service_role USING (true);
-- ให้เจ้าของเซิร์ฟเวอร์ (owner_id) เข้ามาดูและแก้ไขได้ (สำหรับ Web Dashboard)
CREATE POLICY "Guild owners can manage their own guild" ON guilds FOR ALL TO authenticated USING (auth.uid()::text = owner_id);

-- 3. POLICIES สำหรับตาราง auto_roles
CREATE POLICY "Service role has full access to auto_roles" ON auto_roles FOR ALL TO service_role USING (true);
CREATE POLICY "Guild owners can manage their own auto_roles" ON auto_roles FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM guilds WHERE guilds.id = auto_roles.guild_id AND guilds.owner_id = auth.uid()::text));

-- 4. POLICIES สำหรับตาราง role_buttons
CREATE POLICY "Service role has full access to role_buttons" ON role_buttons FOR ALL TO service_role USING (true);
CREATE POLICY "Guild owners can manage their own role_buttons" ON role_buttons FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM guilds WHERE guilds.id = role_buttons.guild_id AND guilds.owner_id = auth.uid()::text));

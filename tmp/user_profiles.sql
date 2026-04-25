-- 🐱 ตารางเก็บข้อมูลโปรไฟล์ผู้ใช้ (Global Profile) เมี๊ยว🐾
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id text PRIMARY KEY,                   -- Discord User ID
    mbti text,                                  -- MBTI Result (e.g. ENFP, INTJ)
    purr_points bigint DEFAULT 0,               -- Global Points (สะสมข้ามเซิร์ฟเวอร์เมี๊ยว)
    bio text,                                   -- Biography / Status
    metadata jsonb DEFAULT '{}'::jsonb,         -- ข้อมูลเสริมอื่นๆ
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ✨ ฟังก์ชันสำหรับอัปเดตเวลาอัตโนมัติเมี๊ยว🐾
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 🚀 สร้าง Trigger ให้อัปเดตเวลาทุกครั้งที่มีการเปลี่ยนข้อมูล
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 🔓 เพิ่มสิทธิ์การเข้าถึงเมี๊ยว🐾 (ถ้ายังไม่ได้ทำ)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service role" ON public.user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

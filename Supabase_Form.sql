-- 1. ปรับปรุงตาราง forms ให้รองรับการถอดยศ (Remove Role)
DROP TABLE IF EXISTS forms CASCADE;
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    button_label TEXT,
    modal_title TEXT,
    modal_questions JSONB,
    role_id TEXT,                         -- ยศที่จะมอบให้
    remove_role_id TEXT,                  -- ยศที่จะถอดออก (เพิ่มใหม่)
    mode TEXT DEFAULT 'auto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to forms" ON forms FOR ALL TO service_role USING (true);
CREATE POLICY "Guild owners can manage their own forms" ON forms FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM guilds WHERE guilds.id = forms.guild_id AND guilds.owner_id = auth.uid()::text));

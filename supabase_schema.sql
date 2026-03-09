-- ==========================================
-- 1. CLEANUP (Full fresh start)
-- ==========================================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chat_group_members CASCADE;
DROP TABLE IF EXISTS public.chat_groups CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop existing trigger & function before recreating
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ==========================================
-- 2. PROFILES TABLE (Must be first — all tables reference it)
-- ==========================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 3. TABLES
-- ==========================================

-- Friends Table
CREATE TABLE public.friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Friend Requests Table
CREATE TABLE public.friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Chat Groups Table
CREATE TABLE public.chat_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Group Members Table
CREATE TABLE public.chat_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, accepted
  role TEXT DEFAULT 'member',    -- member, admin
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Messages Table (content nullable to support file-only messages)
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL for group messages
  group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE, -- NULL for 1-on-1 messages
  content TEXT,        -- nullable: file-only messages won't have text
  file_url TEXT,       -- URL of uploaded file (if any)
  file_name TEXT,      -- original file name
  file_type TEXT,      -- MIME type of the file
  is_seen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT messages_content_or_file CHECK (content IS NOT NULL OR file_url IS NOT NULL)
);

-- ==========================================
-- 4. STORAGE BUCKET FOR FILE SHARING
-- ==========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,       -- public bucket so files can be viewed/downloaded
  52428800,   -- 50MB limit
  NULL        -- allow all file types
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 5. RLS & PERMISSIONS
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ==========================================
-- 6. POLICIES
-- ==========================================

-- Profiles
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Groups: Visible if creator OR if you are in memberships table
CREATE POLICY "groups_select_policy" ON public.chat_groups FOR SELECT 
USING (
  created_by = auth.uid() OR 
  id IN (SELECT group_id FROM public.chat_group_members WHERE user_id = auth.uid())
);
CREATE POLICY "groups_insert_policy" ON public.chat_groups FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Memberships
CREATE POLICY "members_select_policy" ON public.chat_group_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "members_insert_policy" ON public.chat_group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "members_update_policy" ON public.chat_group_members FOR UPDATE USING (user_id = auth.uid());

-- Messages
CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT 
USING (
  sender_id = auth.uid() OR 
  receiver_id = auth.uid() OR 
  group_id IN (SELECT group_id FROM public.chat_group_members WHERE user_id = auth.uid() AND status = 'accepted')
);
CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Friends & Requests
CREATE POLICY "friends_all" ON public.friends FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "requests_all" ON public.friend_requests FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ==========================================
-- 7. STORAGE BUCKET RLS POLICIES
-- ==========================================

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files');

-- Allow anyone to view/download files (public bucket)
DROP POLICY IF EXISTS "Public can view chat files" ON storage.objects;
CREATE POLICY "Public can view chat files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-files');

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==========================================
-- FILE SHARING SETUP FOR UNIQUECHAT
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Add file columns to messages table
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 2. Make content nullable (so we can have file-only messages)
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

-- Add a check so either content or file_url must be present
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_or_file;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_or_file 
  CHECK (content IS NOT NULL OR file_url IS NOT NULL);

-- ==========================================
-- 3. CREATE STORAGE BUCKET (if not already created via dashboard)
-- ==========================================

-- Run this to create the bucket via SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,  -- public bucket so files can be viewed
  52428800,  -- 50MB limit
  NULL   -- allow all file types
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 4. STORAGE BUCKET RLS POLICIES
-- ==========================================

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files');

-- Allow anyone to view/download files (public bucket)
CREATE POLICY "Public can view chat files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-files');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

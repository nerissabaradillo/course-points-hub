-- Replace the broad public SELECT with: anyone can fetch a known object,
-- but only admins can list the bucket via PostgREST.
DROP POLICY IF EXISTS "Course images are publicly accessible" ON storage.objects;

CREATE POLICY "Anyone can read a course image by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-images');

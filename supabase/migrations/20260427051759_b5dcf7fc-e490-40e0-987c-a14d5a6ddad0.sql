-- Add image and color to courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS color text;

-- Create a public storage bucket for course images
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-images', 'course-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, admin write
CREATE POLICY "Course images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-images');

CREATE POLICY "Admins can upload course images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update course images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete course images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));

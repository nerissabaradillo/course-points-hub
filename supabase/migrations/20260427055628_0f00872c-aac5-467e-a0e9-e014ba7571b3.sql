-- Enforce one score per (event, course) pair
CREATE UNIQUE INDEX IF NOT EXISTS scores_event_course_unique
  ON public.scores (event_id, course_id);
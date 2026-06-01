-- Drop the overly permissive anonymous insert policy
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.contact_submissions;

-- Add format and length constraints
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT email_format_check
  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT nome_length_check CHECK (char_length(nome) BETWEEN 1 AND 100),
  ADD CONSTRAINT email_length_check CHECK (char_length(email) BETWEEN 3 AND 255),
  ADD CONSTRAINT telefone_length_check CHECK (char_length(telefone) BETWEEN 5 AND 20);

CREATE TYPE public.appointment_status AS ENUM ('scheduled','confirmed','in_progress','completed','cancelled');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  location text,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes text,
  reminder_minutes int DEFAULT 30,
  reminder_sent boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (true);

CREATE INDEX appointments_start_at_idx ON public.appointments(start_at);
CREATE INDEX appointments_customer_idx ON public.appointments(customer_id);
CREATE INDEX appointments_assigned_idx ON public.appointments(assigned_to);

CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

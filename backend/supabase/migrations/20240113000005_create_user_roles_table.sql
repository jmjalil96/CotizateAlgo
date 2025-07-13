-- Create user_roles junction table
CREATE TABLE public.user_roles (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id),
  PRIMARY KEY (user_id, role_id)
);
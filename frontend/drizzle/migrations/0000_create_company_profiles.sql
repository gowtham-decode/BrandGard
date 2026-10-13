CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 company_name text NOT NULL DEFAULT '' CHECK (char_length(company_name) <= 120),
 instagram text NOT NULL DEFAULT '' CHECK (char_length(instagram) <= 2048 AND (instagram = '' OR instagram ~ '^https?://[^[:space:]]+$')),
 facebook text NOT NULL DEFAULT '' CHECK (char_length(facebook) <= 2048 AND (facebook = '' OR facebook ~ '^https?://[^[:space:]]+$')),
 x text NOT NULL DEFAULT '' CHECK (char_length(x) <= 2048 AND (x = '' OR x ~ '^https?://[^[:space:]]+$')),
 telegram text NOT NULL DEFAULT '' CHECK (char_length(telegram) <= 2048 AND (telegram = '' OR telegram ~ '^https?://[^[:space:]]+$')),
 linkedin text NOT NULL DEFAULT '' CHECK (char_length(linkedin) <= 2048 AND (linkedin = '' OR linkedin ~ '^https?://[^[:space:]]+$')),
 mobile_app text NOT NULL DEFAULT '' CHECK (char_length(mobile_app) <= 2048 AND (mobile_app = '' OR mobile_app ~ '^https?://[^[:space:]]+$')),
 website text NOT NULL DEFAULT '' CHECK (char_length(website) <= 2048 AND (website = '' OR website ~ '^https?://[^[:space:]]+$')),
 completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE FUNCTION public.create_user_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.profiles (id) VALUES (NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();
INSERT INTO public.profiles(id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;
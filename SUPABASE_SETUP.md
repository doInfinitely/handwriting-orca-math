# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Save your **Project URL** and **anon public key**

## 2. Database Schema

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Problem attempts table
CREATE TABLE public.problem_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  problem_id TEXT NOT NULL,
  problem_question TEXT NOT NULL,
  steps JSONB DEFAULT '[]'::jsonb,
  is_solved BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.problem_attempts ENABLE ROW LEVEL SECURITY;

-- Problem attempts policies
CREATE POLICY "Users can view their own attempts"
  ON public.problem_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts"
  ON public.problem_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
  ON public.problem_attempts FOR UPDATE
  USING (auth.uid() = user_id);

-- Activity log table (for the calendar)
CREATE TABLE public.activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL,
  problems_solved INTEGER DEFAULT 0,
  steps_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Activity log policies
CREATE POLICY "Users can view their own activity"
  ON public.activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
  ON public.activity_log FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for performance
CREATE INDEX idx_problem_attempts_user_id ON public.problem_attempts(user_id);
CREATE INDEX idx_problem_attempts_problem_id ON public.problem_attempts(problem_id);
CREATE INDEX idx_problem_attempts_completed ON public.problem_attempts(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_activity_log_user_date ON public.activity_log(user_id, activity_date);
```

## 3. Configure Google OAuth (Optional)

**In Supabase Dashboard:**
1. Go to Authentication → Providers
2. Enable **Google** provider
3. Get your Google OAuth credentials from Google Cloud Console
4. **IMPORTANT**: Add these redirect URIs:
   - `https://rkukjujwpmimamapxhtg.supabase.co/auth/v1/callback`
   - `orcamath://auth/callback` (for mobile)

**In Google Cloud Console:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Go to APIs & Services → Credentials
4. Create OAuth 2.0 Client ID (choose "Web application")
5. Add **Authorized redirect URIs**:
   - `https://rkukjujwpmimamapxhtg.supabase.co/auth/v1/callback`
6. Copy the Client ID and Client Secret
7. Paste them into Supabase Google provider settings

## 4. Add Environment Variables

Add to `app.json`:
```json
"extra": {
  "expoPublic": {
    "SUPABASE_URL": "https://your-project.supabase.co",
    "SUPABASE_ANON_KEY": "your-anon-key-here",
    "MATHPIX_PROXY_URL": "http://192.168.1.112:5056/recognize",
    "LLM_API_URL": "http://192.168.1.112:5056/validate"
  }
}
```


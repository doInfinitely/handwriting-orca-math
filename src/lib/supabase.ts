import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.expoPublic?.SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.expoPublic?.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase URL or Anon Key not configured in app.json');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProblemAttempt {
  id: string;
  user_id: string;
  problem_id: string;
  problem_question: string;
  steps: StepData[];
  is_solved: boolean;
  started_at: string;
  completed_at: string | null;
  last_updated: string;
}

export interface StepData {
  id: string;
  text: string;
  outcome: 'correct' | 'incorrect' | 'neutral';
  feedback?: string;
  imageBase64?: string;
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_date: string;
  problems_solved: number;
  steps_completed: number;
  created_at: string;
}



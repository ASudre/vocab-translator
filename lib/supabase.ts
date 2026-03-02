import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our database tables
export interface VocabularyItem {
  id: number;
  spanish: string;
  french: string;
  english: string;
  category: string;
  class: string;
  created_at: string;
}

export interface UserAnswer {
  id: number;
  user_id: string;
  vocabulary_id: number;
  user_answer: string;
  is_correct: boolean;
  had_accent_issue: boolean;
  answered_at: string;
}

export interface UserStats {
  user_id: string;
  vocabulary_id: number;
  total_attempts: number;
  correct_count: number;
  accent_issues: number;
  success_rate: number;
  last_attempt: string;
  first_attempt: string;
}

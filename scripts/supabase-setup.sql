-- Supabase Database Schema for Vocabulary Translator
-- Run this in Supabase SQL Editor after creating your project

-- 1. Create vocabulary table
CREATE TABLE vocabulary (
  id SERIAL PRIMARY KEY,
  spanish TEXT NOT NULL,
  french TEXT NOT NULL,
  english TEXT NOT NULL,
  category TEXT NOT NULL,
  class TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create user_answers table for tracking progress
CREATE TABLE user_answers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  had_accent_issue BOOLEAN DEFAULT FALSE,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX idx_user_answers_user_id ON user_answers(user_id);
CREATE INDEX idx_user_answers_vocabulary_id ON user_answers(vocabulary_id);
CREATE INDEX idx_user_answers_answered_at ON user_answers(answered_at DESC);
CREATE INDEX idx_vocabulary_category ON vocabulary(category);
CREATE INDEX idx_vocabulary_class ON vocabulary(class);

-- 4. Create a view for user statistics
CREATE VIEW user_stats AS
SELECT 
  user_id,
  vocabulary_id,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
  SUM(CASE WHEN had_accent_issue THEN 1 ELSE 0 END) as accent_issues,
  ROUND(
    100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as success_rate,
  MAX(answered_at) as last_attempt,
  MIN(answered_at) as first_attempt
FROM user_answers
GROUP BY user_id, vocabulary_id;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for vocabulary table (public read access)
CREATE POLICY "Vocabulary is viewable by everyone"
  ON vocabulary FOR SELECT
  USING (true);

-- 7. Create policies for user_answers table (users can only see their own data)
CREATE POLICY "Users can view their own answers"
  ON user_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own answers"
  ON user_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own answers"
  ON user_answers FOR UPDATE
  USING (auth.uid() = user_id);

-- 8. Create a function to get random vocabulary words
CREATE OR REPLACE FUNCTION get_random_vocabulary(word_count INTEGER DEFAULT 10)
RETURNS SETOF vocabulary AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM vocabulary
  ORDER BY RANDOM()
  LIMIT word_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Create a function to get vocabulary by category
CREATE OR REPLACE FUNCTION get_vocabulary_by_category(cat TEXT, word_count INTEGER DEFAULT 10)
RETURNS SETOF vocabulary AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM vocabulary
  WHERE category = cat
  ORDER BY RANDOM()
  LIMIT word_count;
END;
$$ LANGUAGE plpgsql;

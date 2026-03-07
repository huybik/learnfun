-- LearnFun database schema
-- Requires PostgreSQL 15+ with pgvector extension

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_name ON users (name);

-- User profiles (learning preferences + embedding for semantic search)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  voice_preference VARCHAR(20) NOT NULL DEFAULT 'Puck',
  language_code VARCHAR(10) NOT NULL DEFAULT 'en-US',
  show_avatar BOOLEAN NOT NULL DEFAULT TRUE,
  observations TEXT[] NOT NULL DEFAULT '{}',
  difficulty_level VARCHAR(20) NOT NULL DEFAULT 'beginner',
  embedding VECTOR(768),
  profile_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_embedding
  ON user_profiles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Learning progress
CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  highest_streak INTEGER NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  unit_progress JSONB NOT NULL DEFAULT '{}',
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_progress_user ON learning_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_points ON learning_progress (total_points DESC);

-- Session history
CREATE TABLE IF NOT EXISTS session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id VARCHAR(100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  activities JSONB NOT NULL DEFAULT '[]',
  duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_session_history_user ON session_history (user_id);
CREATE INDEX IF NOT EXISTS idx_session_history_started ON session_history (started_at DESC);

-- Game results
CREATE TABLE IF NOT EXISTS game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES session_history(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(50) NOT NULL,
  template_id VARCHAR(100),
  score INTEGER NOT NULL DEFAULT 0,
  accuracy FLOAT,
  duration_seconds INTEGER,
  details JSONB NOT NULL DEFAULT '{}',
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_results_user ON game_results (user_id);
CREATE INDEX IF NOT EXISTS idx_game_results_session ON game_results (session_id);
CREATE INDEX IF NOT EXISTS idx_game_results_played ON game_results (played_at DESC);

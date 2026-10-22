-- Imperfect Breath Database Schema
-- Multichain architecture supporting Flow and Lens

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table - Central identity management
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Multichain addresses
  flow_address TEXT UNIQUE,
  lens_profile_id TEXT,
  
  -- Profile information
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  
  -- Preferences
  preferred_chain TEXT DEFAULT 'flow',
  notification_settings JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_preferred_chain CHECK (preferred_chain IN ('flow', 'lens'))
);

-- Breathing patterns table
CREATE TABLE breathing_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic information
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Pattern data
  phases JSONB NOT NULL, -- Array of phase objects with duration, instruction, etc.
  total_duration INTEGER NOT NULL, -- Total duration in seconds
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  
  -- Media
  audio_url TEXT,
  thumbnail_url TEXT,
  
  -- Blockchain data
  flow_nft_id BIGINT,
  lens_publication_id TEXT,
  
  -- Marketplace
  is_public BOOLEAN DEFAULT true,
  is_for_sale BOOLEAN DEFAULT false,
  price DECIMAL(18, 8), -- Support for crypto decimals
  currency TEXT DEFAULT 'FLOW',
  
  -- Analytics
  usage_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3, 2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_currency CHECK (currency IN ('FLOW', 'ETH', 'MATIC')),
  CONSTRAINT valid_category CHECK (category IN ('general', 'relaxation', 'focus', 'energy', 'sleep', 'anxiety'))
);

-- Breathing sessions table
CREATE TABLE breathing_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Session identification
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES breathing_patterns(id) ON DELETE SET NULL,
  
  -- Session data
  duration INTEGER NOT NULL, -- Duration in seconds
  cycles_completed INTEGER DEFAULT 0,
  
  -- Performance metrics
  bpm DECIMAL(5, 2),
  consistency_score DECIMAL(5, 2) CHECK (consistency_score BETWEEN 0 AND 100),
  restlessness_score DECIMAL(5, 2) CHECK (restlessness_score BETWEEN 0 AND 100),
  breath_hold_time DECIMAL(8, 2), -- In seconds
  
  -- AI analysis
  ai_score DECIMAL(5, 2) CHECK (ai_score BETWEEN 0 AND 100),
  ai_feedback JSONB,
  ai_suggestions TEXT[],
  
  -- Camera tracking data
  pose_data JSONB, -- Pose detection results
  movement_analysis JSONB,
  
  -- Session context
  environment_data JSONB, -- Lighting, noise level, etc.
  device_info JSONB,
  
  -- Blockchain logging
  flow_transaction_id TEXT,
  lens_post_id TEXT,
  
  -- Metadata
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User follows table (for social features)
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Cross-chain follow data
  lens_follow_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent self-follows and duplicate follows
  CONSTRAINT no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

-- Pattern ratings and reviews
CREATE TABLE pattern_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  pattern_id UUID REFERENCES breathing_patterns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  
  -- Blockchain verification
  lens_comment_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One rating per user per pattern
  CONSTRAINT unique_user_pattern_rating UNIQUE (pattern_id, user_id)
);

-- Creator earnings and royalties
CREATE TABLE creator_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES breathing_patterns(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type TEXT NOT NULL, -- 'sale', 'royalty', 'tip'
  amount DECIMAL(18, 8) NOT NULL,
  currency TEXT NOT NULL,
  
  -- Blockchain data
  flow_transaction_id TEXT,
  
  -- Payout status
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'paid'
  paid_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('sale', 'royalty', 'tip', 'subscription')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'paid', 'failed'))
);


-- Community challenges and events
CREATE TABLE community_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Challenge parameters
  pattern_id UUID REFERENCES breathing_patterns(id) ON DELETE SET NULL,
  target_sessions INTEGER,
  target_duration INTEGER, -- Total minutes
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  
  -- Timeline
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Rewards
  reward_type TEXT DEFAULT 'badge', -- 'badge', 'nft', 'token'
  reward_data JSONB,
  
  -- Social features
  lens_publication_id TEXT,
  participant_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_timeline CHECK (ends_at > starts_at),
  CONSTRAINT valid_reward_type CHECK (reward_type IN ('badge', 'nft', 'token', 'discount'))
);

-- Challenge participations
CREATE TABLE challenge_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  challenge_id UUID REFERENCES community_challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Progress tracking
  sessions_completed INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0, -- In minutes
  progress_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  reward_claimed BOOLEAN DEFAULT false,
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_challenge_participation UNIQUE (challenge_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_users_flow_address ON users(flow_address);
CREATE INDEX idx_users_lens_profile ON users(lens_profile_id);
-- Ethereum addresses are not stored on this table (see the later
-- wallet_address migration), so there is no ethereum_address index here.

CREATE INDEX idx_patterns_creator ON breathing_patterns(creator_id);
CREATE INDEX idx_patterns_category ON breathing_patterns(category);
CREATE INDEX idx_patterns_public_sale ON breathing_patterns(is_public, is_for_sale);
CREATE INDEX idx_patterns_flow_nft ON breathing_patterns(flow_nft_id);

CREATE INDEX idx_sessions_user ON breathing_sessions(user_id);
CREATE INDEX idx_sessions_pattern ON breathing_sessions(pattern_id);
CREATE INDEX idx_sessions_date ON breathing_sessions(started_at);

CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);

CREATE INDEX idx_ratings_pattern ON pattern_ratings(pattern_id);
CREATE INDEX idx_ratings_user ON pattern_ratings(user_id);

CREATE INDEX idx_earnings_creator ON creator_earnings(creator_id);
CREATE INDEX idx_earnings_pattern ON creator_earnings(pattern_id);
CREATE INDEX idx_earnings_status ON creator_earnings(status);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON breathing_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON pattern_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ip_licenses is not part of this schema, so it gets no updated_at trigger.

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE breathing_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE breathing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be expanded based on requirements)
CREATE POLICY "Users can view public profiles" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Anyone can view public patterns" ON breathing_patterns
  FOR SELECT USING (is_public = true);

CREATE POLICY "Creators can manage own patterns" ON breathing_patterns
  FOR ALL USING (auth.uid()::text = creator_id::text);

CREATE POLICY "Users can view own sessions" ON breathing_sessions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own sessions" ON breathing_sessions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

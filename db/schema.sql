-- LoseIt Health Data Schema
-- PostgreSQL version

-- Markers table (weight and body fat)
CREATE TABLE IF NOT EXISTS markers (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  body_fat NUMERIC(5,2),
  weight NUMERIC(6,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_markers_date ON markers(date);

-- Activity table (steps, sleep, exercise)
CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  steps INTEGER,
  sleep_hours NUMERIC(4,2),
  exercise_minutes NUMERIC(6,2),
  exercise_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_date ON activity(date);

-- Calories table
CREATE TABLE IF NOT EXISTS calories (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  food_calories NUMERIC(7,2),
  exercise_calories NUMERIC(7,2),
  calorie_budget NUMERIC(7,2),
  tdee NUMERIC(7,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calories_date ON calories(date);

-- Macros table
CREATE TABLE IF NOT EXISTS macros (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  protein_grams NUMERIC(6,2),
  carbs_grams NUMERIC(6,2),
  fiber_grams NUMERIC(6,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_macros_date ON macros(date);

-- Food table
CREATE TABLE IF NOT EXISTS food (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  food_name TEXT,
  meal TEXT,
  quantity NUMERIC(10,2),
  units TEXT,
  calories NUMERIC(7,2),
  nutrients JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_date ON food(date);
CREATE INDEX IF NOT EXISTS idx_food_meal ON food(meal);

# Obsidian Weightlifting Notes Processor

Scripts to parse and analyze freeform weightlifting notes from Obsidian, tracking lifting progress over time.

## Overview

This module processes your weightlifting notes from Obsidian to extract structured workout data, enabling:
- Progress tracking (strength gains over time)
- Volume analysis (total weight lifted)
- Frequency tracking (workouts per muscle group)
- Personal records (PRs) detection
- Plateau identification

## Data Flow

```
Obsidian Notes (Markdown)
    ↓
Parse & Extract Workout Data
    ↓
Normalize & Validate
    ↓
PostgreSQL Database
    ↓
MCP Server / Analytics
```

## Note Format Examples

The parser supports various freeform note formats:

### Format 1: Simple List
```markdown
# Workout - 2025-11-30

**Bench Press**
- 135 x 10
- 185 x 8
- 225 x 5
- 245 x 3 (PR!)

**Squats**
- 225 x 10
- 275 x 8
- 315 x 5

Notes: Felt strong today, hit new PR on bench!
```

### Format 2: Table Format
```markdown
## Back Day - 2025-11-30

| Exercise | Sets | Reps | Weight |
|----------|------|------|--------|
| Deadlift | 3 | 5 | 405 |
| Pull-ups | 4 | 10 | BW+25 |
| Rows | 3 | 12 | 185 |

Energy: 8/10
```

### Format 3: Compact
```markdown
2025-11-30 Push Day
- Bench: 225x5, 245x3, 255x1
- OHP: 135x8, 155x5
- Dips: BWx12, BW+45x8
```

### Format 4: Tagged
```markdown
---
date: 2025-11-30
workout: legs
duration: 75min
---

#workout #legs

Squats: 315x5x3 (working weight)
RDL: 225x10x3
Leg Press: 450x15x4
```

## Planned Scripts

### 1. `parse-notes.ts`
Extract workout data from Obsidian markdown files.

**Features:**
- Detect multiple note formats
- Extract exercises, sets, reps, weight
- Parse metadata (date, workout type, duration)
- Identify PRs and notable achievements
- Handle various weight notations (lbs, kg, BW+weight)

### 2. `normalize.ts`
Standardize exercise names and data.

**Normalization:**
- Map exercise variations to canonical names
  - "Bench Press", "BP", "Bench" → "Bench Press"
  - "Squat", "Back Squat", "BS" → "Back Squat"
- Convert units (all to lbs or all to kg)
- Calculate total volume per exercise
- Categorize by muscle group
- Detect compound vs isolation movements

### 3. `analyze.ts`
Generate insights and progress metrics.

**Analytics:**
- Calculate 1RM estimates (using Epley formula)
- Track strength progression over time
- Identify PRs and milestones
- Calculate training volume trends
- Detect deload weeks and plateaus
- Generate workout frequency heatmap

### 4. `load-db.ts`
Store structured data in PostgreSQL.

## Database Schema

### `lifting_workouts` table:
```sql
CREATE TABLE lifting_workouts (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  workout_type TEXT,
  duration_minutes INTEGER,
  notes TEXT,
  energy_level INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lifting_workouts_date ON lifting_workouts(date);
```

### `lifting_exercises` table:
```sql
CREATE TABLE lifting_exercises (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER REFERENCES lifting_workouts(id),
  exercise_name TEXT NOT NULL,
  exercise_canonical TEXT,
  muscle_group TEXT,
  sets INTEGER,
  reps INTEGER,
  weight NUMERIC(6,2),
  weight_unit TEXT,
  is_pr BOOLEAN DEFAULT FALSE,
  one_rm_estimate NUMERIC(6,2),
  total_volume NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lifting_exercises_workout ON lifting_exercises(workout_id);
CREATE INDEX idx_lifting_exercises_name ON lifting_exercises(exercise_canonical);
CREATE INDEX idx_lifting_exercises_date ON lifting_exercises(workout_id);
```

### `exercise_dictionary` table:
```sql
CREATE TABLE exercise_dictionary (
  id SERIAL PRIMARY KEY,
  canonical_name TEXT UNIQUE NOT NULL,
  aliases TEXT[], -- Array of alternative names
  muscle_group TEXT,
  movement_type TEXT, -- compound, isolation, accessory
  equipment TEXT, -- barbell, dumbbell, bodyweight, machine
  description TEXT
);
```

## Usage

### 1. Export Notes from Obsidian

Your Obsidian vault structure:
```
Vault/
├── Workouts/
│   ├── 2025-11-30-push-day.md
│   ├── 2025-11-28-legs.md
│   └── 2025-11-26-pull-day.md
└── Templates/
    └── workout-template.md
```

### 2. Process Notes

```bash
# Parse all workout notes
npm run obsidian:parse -- --vault ~/Documents/ObsidianVault

# Analyze a specific date range
npm run obsidian:parse -- --from 2025-01-01 --to 2025-12-31

# Load into database
npm run obsidian:load

# Generate progress report
npm run obsidian:analyze
```

## Configuration

Create `obsidian/config.json`:

```json
{
  "vaultPath": "~/Documents/ObsidianVault",
  "notesFolder": "Workouts",
  "dateFormats": [
    "YYYY-MM-DD",
    "MM/DD/YYYY",
    "DD-MM-YYYY"
  ],
  "weightUnit": "lbs",
  "exerciseDictionary": {
    "Bench Press": ["BP", "Bench", "Flat Bench"],
    "Squat": ["Back Squat", "BS", "ATG Squat"],
    "Deadlift": ["DL", "Conventional Deadlift"]
  },
  "muscleGroups": {
    "Bench Press": "Chest",
    "Squat": "Legs",
    "Deadlift": "Back"
  }
}
```

## MCP Tools

Add new tools to query lifting data:

### `get_lifting_progress`
```typescript
{
  exercise: "Bench Press",
  start_date: "01/01/2025",
  end_date: "12/31/2025"
}
// Returns: progression chart, PRs, volume trends
```

### `get_workout_summary`
```typescript
{
  date: "11/30/2025"
}
// Returns: all exercises, sets, reps, total volume
```

### `get_personal_records`
```typescript
{
  exercise: "Bench Press" // optional
}
// Returns: all-time PRs for each exercise
```

### `get_strength_trends`
```typescript
{
  start_date: "01/01/2025",
  end_date: "12/31/2025",
  exercises: ["Bench Press", "Squat", "Deadlift"]
}
// Returns: 1RM estimates over time, trend analysis
```

## Example Analysis Output

```json
{
  "exercise": "Bench Press",
  "dateRange": {
    "start": "01/01/2025",
    "end": "11/30/2025"
  },
  "progression": [
    { "date": "01/05/2025", "weight": 225, "reps": 5, "estimatedMax": 253 },
    { "date": "02/10/2025", "weight": 235, "reps": 5, "estimatedMax": 264 },
    { "date": "11/30/2025", "weight": 255, "reps": 3, "estimatedMax": 272 }
  ],
  "personalRecords": [
    { "date": "11/30/2025", "weight": 255, "reps": 3, "type": "3RM" }
  ],
  "stats": {
    "totalWorkouts": 42,
    "totalSets": 126,
    "totalReps": 630,
    "totalVolume": 142650,
    "avgVolumePerWorkout": 3396,
    "strengthGain": "+7.5%"
  },
  "insights": [
    "New 3RM PR on 11/30/2025",
    "Consistent weekly training (1.2x per week)",
    "Volume increased 15% over period",
    "Estimated 1RM improved from 253 to 272 lbs (+7.5%)"
  ]
}
```

## Advanced Features

### Natural Language Parsing
Handle variations like:
- "failed at 3rd rep" → reps = 2, notes = "failed"
- "AMRAP" → as many reps as possible
- "dropset" → identify and track dropsets
- "rest-pause" → special set notation

### Progressive Overload Tracking
```typescript
// Detect if workout followed progressive overload
{
  "status": "progressing",
  "method": "weight_increase",
  "change": "+5 lbs from last workout",
  "recommendation": "Good progression, continue"
}
```

### Workout Templates
Generate suggested workouts based on:
- Past performance
- Frequency patterns
- Volume fatigue
- Deload scheduling

## Data Privacy

- Workout notes stay on your machine
- Only structured data goes to database
- No personally identifiable information
- Notes and comments are optional

## Integration with Apple Health

Combine with Apple Health data:
- Correlate lifting with heart rate data
- Track recovery (HRV, sleep quality)
- Monitor fatigue and readiness
- Identify optimal training times

## Future Enhancements

- [ ] Image recognition for workout photos
- [ ] Video form check integration
- [ ] Plate calculator (what plates to load)
- [ ] Workout playlist generation based on lift intensity
- [ ] Social sharing of PRs
- [ ] Training program templates
- [ ] AI coaching suggestions

## References

- [One-Rep Max Calculators](https://en.wikipedia.org/wiki/One-repetition_maximum)
- [Progressive Overload Principles](https://www.strongerbyscience.com/progressive-overload/)
- [Exercise Database](https://exrx.net/Lists/Directory)

## Contributing

When adding exercise parsing rules:
1. Add to exercise dictionary
2. Include aliases and variations
3. Test with various note formats
4. Update muscle group mappings
5. Document in this README

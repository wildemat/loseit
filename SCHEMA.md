# Database Schema

This document outlines the PostgreSQL/MySQL tables that store LoseIt health data.

## Database: `loseit`

### Overview

The database consists of 5 main tables, each combining related CSV files grouped by date:

1. **MARKERS** - Body measurements
2. **ACTIVITY** - Physical activity metrics
3. **CALORIES** - Daily calorie tracking
4. **MACROS** - Macronutrient intake
5. **FOOD** - Detailed food consumption logs

---

## Table Schemas

### 1. MARKERS

**Purpose:** Track body measurements over time

**Source Files:**
- `body-fat.csv`
- `weights.csv`

**Aggregation:** Group by `date`, one row per date

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS markers (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  body_fat NUMERIC(5,2),
  weight NUMERIC(6,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_markers_date ON markers(date);
```

**Column Mappings:**

| Source File    | Source Column | Target Column | Type | Notes                    |
|----------------|---------------|---------------|------|--------------------------|
| body-fat.csv   | Date          | date          | TEXT | Primary key              |
| body-fat.csv   | Value         | body_fat      | NUMERIC | Body fat percentage      |
| weights.csv    | Date          | date          | TEXT | Join key                 |
| weights.csv    | Weight        | weight        | NUMERIC | Weight measurement       |

**Excluded Columns:**
- `Secondary Value` (from both files)
- `Last Updated` (from both files)
- `Deleted` (from weights.csv)

**Sample Row:**
```
date: "11/28/2025"
body_fat: 18.5
weight: 185.2
```

---

### 2. ACTIVITY

**Purpose:** Track daily physical activity and sleep

**Source Files:**
- `steps.csv`
- `sleep.csv`
- `exercise-logs.csv`

**Aggregation:** Group by `date`, one row per date

**Schema:**

```sql
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
```

**Column Mappings:**

| Source File       | Source Column | Target Column     | Type    | Aggregation | Notes                           |
|-------------------|---------------|-------------------|---------|-------------|---------------------------------|
| steps.csv         | Date          | date              | TEXT    | -           | Primary key                     |
| steps.csv         | Value         | steps             | INTEGER | -           | Daily step count                |
| sleep.csv         | Date          | date              | TEXT    | -           | Join key                        |
| sleep.csv         | Value         | sleep_hours       | NUMERIC | -           | Hours of sleep                  |
| exercise-logs.csv | Date          | date              | TEXT    | Group       | Join key                        |
| exercise-logs.csv | Quantity      | exercise_minutes  | NUMERIC | SUM         | Total exercise duration per day |
| exercise-logs.csv | -             | exercise_count    | INTEGER | COUNT       | Number of exercise sessions     |

**Excluded Columns:**
- `Secondary Value` (from steps.csv, sleep.csv)
- `Last Updated` (from steps.csv, sleep.csv)
- `Name`, `Icon`, `Type`, `Units`, `Calories`, `Deleted` (from exercise-logs.csv)

**Processing Notes:**
- `exercise-logs.csv` has multiple records per date (one per exercise)
- Aggregate by SUM(Quantity) for `exercise_minutes`
- Aggregate by COUNT(*) for `exercise_count`

**Sample Row:**
```
date: "11/28/2025"
steps: 10523
sleep_hours: 7.5
exercise_minutes: 45.0
exercise_count: 2
```

---

### 3. CALORIES

**Purpose:** Track daily calorie intake and expenditure

**Source Files:**
- `daily-calorie-summary.csv`

**Aggregation:** One-to-one mapping, one row per date

**Schema:**

```sql
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
```

**Column Mappings:**

| Source File              | Source Column  | Target Column      | Type | Notes                              |
|--------------------------|----------------|--------------------|------|------------------------------------|
| daily-calorie-summary.csv | Date           | date               | TEXT | Primary key                        |
| daily-calorie-summary.csv | Food cals      | food_calories      | NUMERIC | Calories consumed from food        |
| daily-calorie-summary.csv | Exercise cals  | exercise_calories  | NUMERIC | Calories burned from exercise      |
| daily-calorie-summary.csv | Budget cals    | calorie_budget     | NUMERIC | Remaining calorie budget           |
| daily-calorie-summary.csv | EER            | tdee               | NUMERIC | Total Daily Energy Expenditure     |

**Sample Row:**
```
date: "11/28/2025"
food_calories: 1850.0
exercise_calories: 350.0
calorie_budget: 1500.0
tdee: 2200.0
```

---

### 4. MACROS

**Purpose:** Track daily macronutrient intake

**Source Files:**
- `protein.csv`
- `carbohydrates.csv`
- `fiber.csv`

**Aggregation:** Group by `date`, one row per date

**Schema:**

```sql
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
```

**Column Mappings:**

| Source File       | Source Column | Target Column  | Type | Notes                    |
|-------------------|---------------|----------------|------|--------------------------|
| protein.csv       | Date          | date           | TEXT | Primary key              |
| protein.csv       | Value         | protein_grams  | NUMERIC | Protein intake in grams  |
| carbohydrates.csv | Date          | date           | TEXT | Join key                 |
| carbohydrates.csv | Value         | carbs_grams    | NUMERIC | Carb intake in grams     |
| fiber.csv         | Date          | date           | TEXT | Join key                 |
| fiber.csv         | Value         | fiber_grams    | NUMERIC | Fiber intake in grams    |

**Excluded Columns:**
- `Secondary Value` (from all files)
- `Last Updated` (from all files)

**Sample Row:**
```
date: "11/28/2025"
protein_grams: 125.5
carbs_grams: 180.0
fiber_grams: 28.3
```

---

### 5. FOOD

**Purpose:** Detailed food consumption logs (detail table, not aggregated)

**Source Files:**
- `food-logs.csv`

**Aggregation:** None - preserves individual food log entries

**Schema:**

```sql
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
```

**Column Mappings:**

| Source File  | Source Column      | Target Column | Type | Notes                                    |
|--------------|--------------------|---------------|------|------------------------------------------|
| food-logs.csv | Date               | date          | TEXT | Foreign key to other tables              |
| food-logs.csv | Name               | food_name     | TEXT | Name of food item                        |
| food-logs.csv | Meal               | meal          | TEXT | Meal type (Breakfast, Lunch, Dinner, etc) |
| food-logs.csv | Quantity           | quantity      | NUMERIC | Amount consumed                          |
| food-logs.csv | Units              | units         | TEXT | Unit of measurement (cups, oz, etc)      |
| food-logs.csv | Calories           | calories      | NUMERIC | Calorie content                          |
| food-logs.csv | Multiple nutrients | nutrients     | JSONB | JSON with nutritional breakdown   |

**Nutrients JSON Structure:**

The `nutrients` column stores a JSON object with the following fields:

```json
{
  "fat": 12.5,
  "protein": 25.0,
  "carbs": 45.0,
  "sat_fat": 3.2,
  "sugar": 8.0,
  "fiber": 6.5,
  "cholesterol": 55,
  "sodium": 320
}
```

**Nutrients Column Mappings:**

| Source Column        | JSON Key     | Type | Unit |
|----------------------|--------------|------|------|
| Fat (g)              | fat          | NUMERIC | g    |
| Protein (g)          | protein      | NUMERIC | g    |
| Carbohydrates (g)    | carbs        | NUMERIC | g    |
| Saturated Fat (g)    | sat_fat      | NUMERIC | g    |
| Sugars (g)           | sugar        | NUMERIC | g    |
| Fiber (g)            | fiber        | NUMERIC | g    |
| Cholesterol (mg)     | cholesterol  | NUMERIC | mg   |
| Sodium (mg)          | sodium       | NUMERIC | mg   |

**Excluded Columns:**
- `Icon` (not needed for analysis)
- `Deleted` (can filter if needed, but typically ignore deleted records)

**Sample Rows:**
```
id: 1
date: "11/28/2025"
food_name: "Chicken Breast"
meal: "Lunch"
quantity: 6.0
units: "oz"
calories: 280.0
nutrients: {"fat":6.0,"protein":53.0,"carbs":0.0,"sat_fat":1.5,"sugar":0.0,"fiber":0.0,"cholesterol":145,"sodium":134}
```

---

## Excluded Files

The following CSV files are **excluded** from processing:

1. **`waist-size.csv`** - Marked as Exclude in DATATYPES.md
2. **`daily-values.csv`** - Marked as Exclude in DATATYPES.md
3. **`calorie-bonus.csv`** - Marked as Exclude in DATATYPES.md

Additional files not processed (no processing schema defined):
- `notes.csv`
- `course-progress.csv`
- Reference/configuration files (custom-foods, recipes, etc.)
- Achievement files
- Fasting files
- Profile files

---

## Data Processing Flow

### 1. Extract CSVs from ZIP
- Unzip export file to temporary directory
- Identify relevant CSV files

### 2. Read and Parse CSVs
- Parse each CSV with proper encoding
- Handle malformed rows gracefully
- Normalize date formats to MM/DD/YYYY

### 3. Transform Data
- Apply column mappings
- Convert data types
- Create JSON for nutrients field
- Aggregate where specified (GROUP BY date)

### 4. Load into PostgreSQL
- Create tables if not exist
- Insert/update records
- Handle conflicts (UPSERT on date for aggregated tables)

### 5. Create Indexes
- Primary keys on `date` for all aggregated tables
- Indexes on FOOD.date and FOOD.meal for query performance

---

## Table Relationships

```
markers (date) ←──┐
                   │
activity (date) ←──┤
                   │
calories (date) ←──┼── All share common date key
                   │
macros (date) ←────┤
                   │
food (date) ───────┘  (Many-to-one relationship)
```

**Relationship Notes:**
- `markers`, `activity`, `calories`, and `macros` are all **dimension tables** with one row per date
- `food` is a **fact table** with multiple rows per date (one per food item consumed)
- All tables can be joined on the `date` column
- Not all dates will have entries in all tables (user may not log all metrics daily)

---

## Querying Examples

### Get complete daily summary for a date:
```sql
SELECT
    m.date,
    m.weight,
    m.body_fat,
    a.steps,
    a.sleep_hours,
    a.exercise_minutes,
    c.food_calories,
    c.tdee,
    mac.protein_grams,
    mac.carbs_grams
FROM markers m
LEFT JOIN activity a ON m.date = a.date
LEFT JOIN calories c ON m.date = c.date
LEFT JOIN macros mac ON m.date = mac.date
WHERE m.date = '11/28/2025';
```

### Get all food consumed on a date:
```sql
SELECT
    food_name,
    meal,
    quantity,
    units,
    calories,
    nutrients->>'protein' as protein,
    nutrients->>'carbs' as carbs
FROM food
WHERE date = '11/28/2025'
ORDER BY meal, id;
```

### Calculate weekly averages:
```sql
SELECT
    date_trunc('week', to_date(date, 'MM/DD/YYYY')) as week,
    AVG(weight) as avg_weight,
    AVG(steps) as avg_steps,
    SUM(exercise_minutes) as total_exercise
FROM markers
LEFT JOIN activity USING (date)
GROUP BY week
ORDER BY week DESC;
```

---

## Notes

- **Auto-Increment IDs:** All tables use `id SERIAL PRIMARY KEY` for auto-incrementing IDs
- **Date Format:** All dates stored as TEXT in `MM/DD/YYYY` format (as exported from LoseIt)
- **Timestamps:** `created_at` and `updated_at` are set automatically on insert
- **NULL Values:** Data columns (not id, date, created_at, updated_at) may be NULL if data not available
- **JSON in PostgreSQL:** PostgreSQL supports JSONB type and operators (`->`, `->>`) for querying nutrients
- **UPSERT Strategy:** For aggregated tables (MARKERS, ACTIVITY, CALORIES, MACROS), use ON CONFLICT for re-imports
- **Date Uniqueness:** Aggregated tables have UNIQUE constraint on `date`; FOOD table allows multiple rows per date

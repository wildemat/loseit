# SQL Query Examples

This document provides examples of useful SQL queries to analyze your LoseIt data.

## Starting the Database Server

Start the interactive SQL shell:

```bash
npm run db:server
```

### Available Commands

Once in the shell:
- `.stats` - Show database statistics
- `.tables` - List all tables
- `.schema [table]` - Show table schema
- `.save` - Manually save database
- `.exit` - Exit the shell

## Example Queries

### Weight Tracking

**Get all weight measurements ordered by date:**
```sql
SELECT date, weight
FROM markers
WHERE weight IS NOT NULL
ORDER BY date DESC;
```

**Calculate weight loss over time:**
```sql
SELECT
  MIN(weight) as lowest_weight,
  MAX(weight) as highest_weight,
  MAX(weight) - MIN(weight) as total_change,
  COUNT(*) as measurements
FROM markers
WHERE weight IS NOT NULL;
```

**Get weekly average weight:**
```sql
SELECT
  strftime('%Y-%W',
    substr(date, 7, 4) || '-' ||
    substr(date, 1, 2) || '-' ||
    substr(date, 4, 2)
  ) as week,
  ROUND(AVG(weight), 1) as avg_weight,
  COUNT(*) as measurements
FROM markers
WHERE weight IS NOT NULL
GROUP BY week
ORDER BY week DESC
LIMIT 12;
```

### Calorie Analysis

**Daily calorie summary:**
```sql
SELECT
  date,
  food_calories,
  exercise_calories,
  calorie_budget,
  food_calories - calorie_budget as over_under,
  tdee
FROM calories
ORDER BY date DESC
LIMIT 30;
```

**Average calories by month:**
```sql
SELECT
  substr(date, 1, 7) as month,
  ROUND(AVG(food_calories), 0) as avg_food_cals,
  ROUND(AVG(exercise_calories), 0) as avg_exercise_cals,
  ROUND(AVG(calorie_budget), 0) as avg_budget,
  COUNT(*) as days_tracked
FROM calories
GROUP BY month
ORDER BY month DESC;
```

**Days over/under calorie budget:**
```sql
SELECT
  SUM(CASE WHEN food_calories > calorie_budget THEN 1 ELSE 0 END) as days_over,
  SUM(CASE WHEN food_calories <= calorie_budget THEN 1 ELSE 0 END) as days_under,
  COUNT(*) as total_days,
  ROUND(100.0 * SUM(CASE WHEN food_calories <= calorie_budget THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM calories
WHERE calorie_budget IS NOT NULL;
```

### Activity Tracking

**Daily step counts:**
```sql
SELECT date, steps
FROM activity
WHERE steps IS NOT NULL
ORDER BY date DESC
LIMIT 30;
```

**Average steps by month:**
```sql
SELECT
  substr(date, 1, 7) as month,
  ROUND(AVG(steps), 0) as avg_steps,
  COUNT(*) as days_tracked
FROM activity
WHERE steps IS NOT NULL
GROUP BY month
ORDER BY month DESC;
```

**Sleep patterns:**
```sql
SELECT
  date,
  sleep_hours,
  CASE
    WHEN sleep_hours >= 7 THEN 'Good'
    WHEN sleep_hours >= 6 THEN 'Fair'
    ELSE 'Poor'
  END as sleep_quality
FROM activity
WHERE sleep_hours IS NOT NULL
ORDER BY date DESC
LIMIT 30;
```

**Exercise statistics:**
```sql
SELECT
  COUNT(DISTINCT date) as days_exercised,
  SUM(exercise_count) as total_workouts,
  ROUND(AVG(exercise_minutes), 1) as avg_minutes_per_day,
  SUM(exercise_minutes) as total_minutes
FROM activity
WHERE exercise_count > 0;
```

### Macronutrient Analysis

**Daily macro breakdown:**
```sql
SELECT
  date,
  protein_grams,
  carbs_grams,
  fiber_grams,
  ROUND(protein_grams * 4, 0) as protein_calories,
  ROUND(carbs_grams * 4, 0) as carb_calories
FROM macros
ORDER BY date DESC
LIMIT 30;
```

**Average macros per month:**
```sql
SELECT
  substr(date, 1, 7) as month,
  ROUND(AVG(protein_grams), 1) as avg_protein,
  ROUND(AVG(carbs_grams), 1) as avg_carbs,
  ROUND(AVG(fiber_grams), 1) as avg_fiber
FROM macros
GROUP BY month
ORDER BY month DESC;
```

### Food Log Analysis

**Most frequently logged foods:**
```sql
SELECT
  food_name,
  COUNT(*) as times_logged,
  ROUND(AVG(calories), 0) as avg_calories
FROM food
GROUP BY food_name
ORDER BY times_logged DESC
LIMIT 20;
```

**Calories by meal:**
```sql
SELECT
  meal,
  COUNT(*) as entries,
  ROUND(AVG(calories), 0) as avg_calories,
  ROUND(SUM(calories), 0) as total_calories
FROM food
GROUP BY meal
ORDER BY total_calories DESC;
```

**Daily food log:**
```sql
SELECT
  date,
  meal,
  food_name,
  quantity,
  units,
  calories
FROM food
WHERE date = '11/28/2025'
ORDER BY
  CASE meal
    WHEN 'Breakfast' THEN 1
    WHEN 'Lunch' THEN 2
    WHEN 'Dinner' THEN 3
    WHEN 'Snacks' THEN 4
    ELSE 5
  END;
```

**Top calorie foods:**
```sql
SELECT
  food_name,
  MAX(calories) as max_calories,
  COUNT(*) as times_logged
FROM food
GROUP BY food_name
ORDER BY max_calories DESC
LIMIT 20;
```

**Extract nutrient data from JSON:**
```sql
SELECT
  food_name,
  calories,
  json_extract(nutrients, '$.protein') as protein_g,
  json_extract(nutrients, '$.carbs') as carbs_g,
  json_extract(nutrients, '$.fat') as fat_g,
  json_extract(nutrients, '$.fiber') as fiber_g
FROM food
WHERE date = '11/28/2025'
ORDER BY calories DESC;
```

### Combined Analysis

**Weight vs Calories correlation:**
```sql
SELECT
  m.date,
  m.weight,
  c.food_calories,
  c.calorie_budget,
  c.food_calories - c.calorie_budget as deficit
FROM markers m
JOIN calories c ON m.date = c.date
WHERE m.weight IS NOT NULL
ORDER BY m.date DESC
LIMIT 30;
```

**Complete daily summary:**
```sql
SELECT
  m.date,
  m.weight,
  a.steps,
  a.sleep_hours,
  c.food_calories,
  c.calorie_budget,
  mac.protein_grams,
  mac.carbs_grams
FROM markers m
LEFT JOIN activity a ON m.date = a.date
LEFT JOIN calories c ON m.date = c.date
LEFT JOIN macros mac ON m.date = mac.date
WHERE m.date LIKE '11/%/2025'
ORDER BY m.date DESC;
```

**Monthly rollup:**
```sql
SELECT
  substr(c.date, 1, 7) as month,
  COUNT(DISTINCT c.date) as days_tracked,
  ROUND(AVG(m.weight), 1) as avg_weight,
  ROUND(AVG(a.steps), 0) as avg_steps,
  ROUND(AVG(c.food_calories), 0) as avg_calories,
  ROUND(AVG(mac.protein_grams), 1) as avg_protein
FROM calories c
LEFT JOIN markers m ON c.date = m.date
LEFT JOIN activity a ON c.date = a.date
LEFT JOIN macros mac ON c.date = mac.date
GROUP BY month
ORDER BY month DESC;
```

## Tips

1. **Date Format**: Dates are stored as MM/DD/YYYY strings. Convert to ISO format for sorting:
   ```sql
   substr(date, 7, 4) || '-' || substr(date, 1, 2) || '-' || substr(date, 4, 2)
   ```

2. **NULL Handling**: Use `IS NOT NULL` to filter out missing data points.

3. **JSON Nutrients**: Access nested data with `json_extract(nutrients, '$.field_name')`.

4. **Auto-save**: The server automatically saves after INSERT/UPDATE/DELETE queries.

5. **Export Results**: You can redirect query output to a file:
   ```sql
   .output results.txt
   SELECT * FROM markers;
   .output
   ```

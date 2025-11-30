# LoseIt Export Data Structure

This document describes the structure and contents of data exported from LoseIt.com.

## File Categories

### 1. Time-Series Health Metrics (15 files with "Date" field)

These files track daily measurements and activities.

Schema settings for all Time-series fields:

- Header Mappings
  - Date: date
- Types
  - date: string

Process each file that doesn't have "Exclude" next to the file name

#### Body Measurements

- Table: MARKERS
- Group By: date

- **`body-fat.csv`**

  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Track body fat percentage over time
    Processing Schema:
  - Header Mappings
    - Value: body_fat
  - Normalized: body_fat
  - Types
    - body_fat: number

- **`weights.csv`**

  - Headers: `Date, Weight, Last Updated, Deleted`
  - Purpose: Track weight measurements over time
    Processing Schema:
  - Header Mappings
    - Weight: weight
  - Normalized: weight
  - Types
    - weight: number

- **`waist-size.csv`** Exclude
  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Track waist circumference measurements

#### Activity Tracking

- Table: ACTIVITY
- Group By: date

- **`steps.csv`**

  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Daily step count
    Processing Schema:
  - Header Mappings
    - Value: steps
  - Normalized: steps
  - Types
    - steps: number

- **`sleep.csv`**

  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Sleep duration tracking
    Processing Schema:
  - Header Mappings
    - Value: sleep_hours
  - Normalized: sleep_hours
  - Types
    - sleep_hours: number

- **`exercise-logs.csv`**
  - Headers: `Date, Name, Icon, Type, Quantity, Units, Calories, Deleted`
  - Purpose: Detailed exercise activity logs
    Processing Schema:
  - Header Mappings
    - Quantity: exercise_minutes
  - Normalized: exercise_minutes
  - Types
    - exercise_minutes: number
  - Group By
    - Fields
      - date
    - Count Field
      - exercise_count

#### Nutrition Tracking

- **`daily-calorie-summary.csv`**

  - Table: CALORIES

  - Headers: `Date, Food cals, Exercise cals, Budget cals, EER`
  - Purpose: Daily calorie intake vs. expenditure summary
    Processing Schema:
  - Header Mappings
    - Food cals: food_calories
    - Exercise cals: exercise_calories
    - Budget cals: calorie_budget
    - EER: tdee
  - Normalized: food_calories, exercise_calories, calorie_budget, tdee
  - Types
    - food_calories: number
    - exercise_calories: number
    - calorie_budget: number
    - tdee: number

- **`daily-values.csv`** Exclude

  - Headers: `Date, Name, Value`
  - Purpose: Various daily nutritional values (vitamins, minerals, etc.)

- **`calorie-bonus.csv`** Exclude
  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Extra calories earned (likely from exercise)

#### Macronutrients

- Table: MACROS
- Group By: date

- **`protein.csv`**

  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Daily protein intake
    Processing Schema:
  - Header Mappings
    - Value: protein_grams
  - Normalized: protein_grams
  - Types
    - protein_grams: number

- **`carbohydrates.csv`**

  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Daily carbohydrate intake
    Processing Schema:
  - Header Mappings
    - Value: carbs_grams
  - Normalized: carbs_grams
  - Types
    - carbs_grams: number

- **`fiber.csv`**
  - Headers: `Date, Value, Secondary Value, Last Updated`
  - Purpose: Daily fiber intake
    Processing Schema:
  - Header Mappings
    - Value: fiber_grams
  - Normalized: fiber_grams
  - Types
    - fiber_grams: number

#### Food Logs

- Table: FOOD

- **`food-logs.csv`**
  - Headers: `Date, Name, Icon, Meal, Quantity, Units, Calories, Deleted, Fat (g), Protein (g), Carbohydrates (g), Saturated Fat (g), Sugars (g), Fiber (g), Cholesterol (mg), Sodium (mg)`
  - Purpose: Detailed food consumption logs
  - Most detailed file with complete nutritional breakdown per food item
    Processing Schema:
  - Header Mappings
    - Name: food_name
    - Meal: meal
    - Quantity: quantity
    - Units: units
    - Calories: calories
  - JSON Field
    - Name: nutrients
      - Fields
        - Fat (g): fat
        - Protein (g): protein
        - Carbohydrates (g): carbs
        - Saturated Fat (g): sat_fat
        - Sugars (g): sugar
        - Fiber (g): fiber
        - Cholesterol (mg): cholesterol
        - Sodium (mg): sodium
  - Normalized: food_name, meal, quantity, units, calories, nutrients
  - Types
    - food_name: string
    - meal: string
    - quantity: number
    - units: string
    - calories: number
    - nutrients: Record<string, number>

#### Notes

- **`notes.csv`**
  - Headers: `Date, Title, Body`
  - Purpose: Daily notes and journal entries

#### Course Progress

- **`course-progress.csv`**
  - Headers: `Course Code, Level Code, Subject Code, Lesson Code, Start Date, Finish Date`
  - Purpose: Track educational/coaching course completion

### 2. Reference/Configuration Data (no Date field)

These files contain user-defined configurations and reference data.

#### User Definitions

- **`custom-foods.csv`**

  - Headers: `Name, UniqueId, Brand, Image, Quantity, Measure, Calories, Fat (g), Protein (g), Carbohydrates (g), Saturated Fat (g), Sugars (g), Fiber (g), Cholesterol (mg), Sodium (mg)`
  - Purpose: User-created custom food items

- **`custom-exercises.csv`**

  - Headers: `Exercise, Image, Mets`
  - Purpose: User-created custom exercises
  - Mets: Metabolic Equivalent of Task (energy expenditure measure)

- **`recipes.csv`**
  - Headers: `Name, UniqueId, Quantity, Measure, Author, Image Name, Calories, Fat (g), Protein (g), Carbohydrates (g), Saturated Fat (g), Sugars (g), Fiber (g), Cholesterol (mg), Sodium (mg)`
  - Purpose: User-created or saved recipes

#### Active Tracking

- **`active-food-servings.csv`**
  - Headers: `FoodUniqueId, Measure, Quantity, BaseMultiplier, Created, LastUpdated, Deleted`
  - Purpose: Currently tracked/favorite food serving sizes

#### Achievements

- **`achievements.csv`**

  - Headers: `Tag, Level, Earned On, Deleted`
  - Purpose: Achievements unlocked by the user

- **`achievement-actions.csv`**
  - Headers: `Tag, Type, Deleted`
  - Purpose: Actions that contribute to achievements

#### Fasting

- **`fasting-schedules.csv`**

  - Headers: `Day, Scheduled start, Duration, Deleted`
  - Purpose: Planned intermittent fasting schedules

- **`fasting-logs.csv`**
  - Headers: `Scheduled start, Scheduled duration, Actual start, Actual end, Deleted`
  - Purpose: Actual fasting session records

#### Profile

- **`profile.csv`**
  - Headers: `Name, Value`
  - Purpose: User profile information and settings
  - Format: Key-value pairs

### 3. Media Folders

- **`food-photos/`** - Photo attachments for food logs
- **`progress-photos/`** - Progress/body photos

## Common Header Patterns

### Most Common Fields

1. **`Date`** - Found in 15 files

   - All time-series data uses this field
   - Primary key for combining time-series data

2. **`Deleted`** - Found in 8 files

   - Soft-delete flag for data retention
   - Allows recovery of accidentally deleted items
   - Preserves historical data integrity

3. **`Value`** - Found in 8 files

   - Standard metric tracking field
   - Used for simple numeric measurements

4. **`Last Updated`** - Found in 9 files
   - Modification timestamp
   - Tracks when data was last changed

### Nutrition Headers Pattern

These 4 files share complete nutritional information:

- `custom-foods.csv`
- `food-logs.csv`
- `recipes.csv`
- `exercise-logs.csv` (Calories only)

**Standard Nutrition Fields:**

- Calories
- Fat (g)
- Protein (g)
- Carbohydrates (g)
- Saturated Fat (g)
- Sugars (g)
- Fiber (g)
- Cholesterol (mg)
- Sodium (mg)

### Standard Metric Pattern

8 files follow this simple pattern:

```
Date, Value, Secondary Value, Last Updated
```

Files using this pattern:

- body-fat.csv
- calorie-bonus.csv
- carbohydrates.csv
- fiber.csv
- protein.csv
- sleep.csv
- steps.csv
- waist-size.csv

## Data Architecture Insights

LoseIt's data structure demonstrates:

1. **Normalized Tables** - Different metric types are stored in separate files
2. **Soft Deletes** - Uses `Deleted` flag to preserve historical data rather than permanent deletion
3. **Consistent Nutrition Schema** - Same nutritional fields across foods, recipes, and logs
4. **Separate Aggregates** - Daily summaries (`daily-calorie-summary.csv`) separate from detailed logs (`food-logs.csv`)
5. **Time-Series Focus** - Majority of data (15/26 files) is time-series with Date as primary key
6. **Flexible Metrics** - "Secondary Value" field allows tracking related metrics (e.g., goal vs. actual)

## File Sizes (Typical User Data)

Based on sample export:

- **Largest**: `food-logs.csv` (~4,299 records) - Most granular detail
- **Medium**: `daily-calorie-summary.csv` (~1,694 records) - One record per day
- **Smaller**: Metric tracking files (100-500 records) - Depends on measurement frequency
- **Reference**: Custom foods, recipes (varies by user)

## Use Cases for Combined Data

The time-series files are ideal for:

- **Trend Analysis** - Weight loss progress, calorie adherence
- **Correlation Studies** - Exercise vs. weight, sleep vs. calories
- **Habit Tracking** - Consistency in logging, meal timing patterns
- **Nutritional Balance** - Macro ratios over time
- **Goal Achievement** - Progress toward fitness targets

Reference files are useful for:

- **Recipe Management** - Export custom recipes
- **Food Database** - Backup of custom food definitions
- **Achievement Tracking** - Gamification progress

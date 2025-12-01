# Apple Health Data Processor

Scripts to process and ingest data from Apple Health app exports into the PostgreSQL database.

## Overview

Apple Health exports data as a large XML file (`export.xml`) containing various health metrics including:
- Workouts
- Heart rate measurements
- Steps and distance
- Active energy burned
- Exercise minutes
- Sleep analysis
- Body measurements (weight, body fat %)
- Nutrition data (if tracked)
- And many more data types

These scripts parse the XML export and integrate the data with your existing LoseIt health tracking database.

## Data Flow

```
Apple Health App
    ↓
Export Health Data (XML)
    ↓
Parse & Transform Scripts
    ↓
PostgreSQL Database
    ↓
MCP Server Queries
```

## Apple Health Export Structure

The export contains:
- `export.xml` - Main data file with all health records
- `export_cda.xml` - Clinical data (if any)
- `workout-routes/` - GPX files for workouts with GPS data

## Planned Scripts

### 1. `parse-export.ts`
Parse the Apple Health XML export and extract relevant data types.

**Key Data Types:**
- `HKQuantityTypeIdentifierStepCount` - Daily steps
- `HKQuantityTypeIdentifierDistanceWalkingRunning` - Walking/running distance
- `HKQuantityTypeIdentifierActiveEnergyBurned` - Active calories
- `HKQuantityTypeIdentifierAppleExerciseTime` - Exercise minutes
- `HKQuantityTypeIdentifierBodyMass` - Weight measurements
- `HKQuantityTypeIdentifierBodyFatPercentage` - Body fat %
- `HKCategoryTypeIdentifierSleepAnalysis` - Sleep tracking
- `HKWorkoutActivityType*` - Workout sessions

### 2. `transform.ts`
Transform parsed Apple Health data to match database schema.

**Transformations:**
- Aggregate daily metrics (steps, calories, exercise minutes)
- Merge with existing LoseIt data (prefer LoseIt for nutrition, Apple Health for activity)
- Resolve conflicts (e.g., both sources have weight data)
- Format dates to MM/DD/YYYY

### 3. `ingest.ts`
Load transformed data into PostgreSQL database.

**Strategy:**
- UPSERT into existing tables (markers, activity, calories)
- Supplement LoseIt data with Apple Health metrics
- Create new tables for Apple Health-specific data (heart rate, workouts)

## Data Integration Strategy

### Primary Source Priority:
1. **Nutrition data**: LoseIt (more detailed food tracking)
2. **Activity data**: Apple Health (more comprehensive, includes heart rate, workouts)
3. **Weight/body fat**: Merge both sources (LoseIt for manual entries, Apple Health for smart scale sync)
4. **Steps/exercise**: Prefer Apple Health (more accurate with iPhone/Apple Watch)

### New Tables for Apple Health Data:

#### `workouts` table:
```sql
CREATE TABLE workouts (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  workout_type TEXT,
  duration_minutes NUMERIC(6,2),
  distance NUMERIC(8,2),
  distance_unit TEXT,
  calories NUMERIC(7,2),
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `heart_rate` table:
```sql
CREATE TABLE heart_rate (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  value INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Usage

### 1. Export Data from Apple Health

On your iPhone:
1. Open Health app
2. Tap your profile picture (top right)
3. Scroll down and tap "Export All Health Data"
4. Save the export.zip file
5. Transfer to your computer

### 2. Process the Export

```bash
# Extract the export
unzip export.zip -d apple_health_export/

# Parse the XML
npm run apple:parse

# Transform the data
npm run apple:transform

# Load into database
npm run apple:load
```

### 3. Query Combined Data

The MCP server will now have access to both LoseIt and Apple Health data, providing a more complete picture of your health metrics.

## Configuration

Create a `config.json` to customize data processing:

```json
{
  "dataTypes": {
    "steps": true,
    "workouts": true,
    "heartRate": true,
    "sleep": true,
    "weight": true,
    "nutrition": false
  },
  "mergeStrategy": {
    "weight": "both",
    "steps": "apple_health",
    "calories": "loseit"
  },
  "dateRange": {
    "start": "2024-01-01",
    "end": "2025-12-31"
  }
}
```

## Data Privacy

**Important Notes:**
- Apple Health exports contain **all** your health data
- Keep exports secure and never commit them to git
- The `.gitignore` excludes `apple_health_export/` and `*.xml` files
- Only aggregated, anonymized data is stored in the database

## Performance Considerations

Apple Health exports can be **very large** (100MB+ XML files with millions of records):
- Use streaming XML parsers (not DOM-based)
- Process data in batches
- Implement progress tracking
- Consider parallel processing for large exports

## Future Enhancements

- [ ] Workout route visualization (GPX parsing)
- [ ] Heart rate zones analysis
- [ ] Sleep quality scoring
- [ ] Trend detection and anomaly alerts
- [ ] Integration with other health apps (Strava, Garmin, etc.)
- [ ] Real-time sync via HealthKit API (iOS app)

## References

- [Apple Health Export Schema](https://developer.apple.com/documentation/healthkit)
- [HKQuantityTypeIdentifier Reference](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier)
- [HKWorkoutActivityType Reference](https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype)

## Contributing

When adding new data type processors:
1. Document the HKQuantityTypeIdentifier
2. Add transformation logic
3. Update database schema if needed
4. Add to MCP server tools if queryable
5. Update this README

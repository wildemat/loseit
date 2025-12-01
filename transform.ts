import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const RAW_EXPORT_DIR = path.join(process.cwd(), 'raw_export');
const OUTPUT_DIR = path.join(process.cwd(), 'transformed');

interface MarkerRecord {
  date: string;
  body_fat?: number;
  weight?: number;
}

interface ActivityRecord {
  date: string;
  steps?: number;
  sleep_hours?: number;
  exercise_minutes?: number;
  exercise_count?: number;
}

interface CalorieRecord {
  date: string;
  food_calories?: number;
  exercise_calories?: number;
  calorie_budget?: number;
  tdee?: number;
}

interface MacroRecord {
  date: string;
  protein_grams?: number;
  carbs_grams?: number;
  fiber_grams?: number;
}

interface FoodRecord {
  date: string;
  food_name: string;
  meal: string;
  quantity?: number;
  units?: string;
  calories?: number;
  nutrients: string; // JSON string
}

async function main() {
  console.log('Starting data transformation...\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  // Check if raw_export directory exists
  if (!fs.existsSync(RAW_EXPORT_DIR)) {
    console.error(`Error: ${RAW_EXPORT_DIR} directory not found.`);
    console.error('Please extract your LoseIt export zip file to this directory first.');
    process.exit(1);
  }

  // Transform each table
  await transformMarkers();
  await transformActivity();
  await transformCalories();
  await transformMacros();
  await transformFood();

  console.log('\n✓ All transformations complete!');
  console.log(`Output files saved to: ${OUTPUT_DIR}/`);
}

async function transformMarkers() {
  console.log('Transforming MARKERS table...');

  const markers = new Map<string, MarkerRecord>();

  // Process body-fat.csv
  const bodyFatPath = path.join(RAW_EXPORT_DIR, 'body-fat.csv');
  if (fs.existsSync(bodyFatPath)) {
    const content = fs.readFileSync(bodyFatPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!markers.has(date)) {
        markers.set(date, { date });
      }

      const marker = markers.get(date)!;
      marker.body_fat = parseFloat(record.Value) || undefined;
    });

    console.log(`  Processed body-fat.csv: ${records.length} records`);
  }

  // Process weights.csv
  const weightsPath = path.join(RAW_EXPORT_DIR, 'weights.csv');
  if (fs.existsSync(weightsPath)) {
    const content = fs.readFileSync(weightsPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!markers.has(date)) {
        markers.set(date, { date });
      }

      const marker = markers.get(date)!;
      marker.weight = parseFloat(record.Weight) || undefined;
    });

    console.log(`  Processed weights.csv: ${records.length} records`);
  }

  // Write to CSV
  const outputPath = path.join(OUTPUT_DIR, 'markers.csv');
  const data = Array.from(markers.values()).sort((a, b) => a.date.localeCompare(b.date));
  const csv = stringify(data, { header: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`  ✓ Created markers.csv: ${data.length} records\n`);
}

async function transformActivity() {
  console.log('Transforming ACTIVITY table...');

  const activity = new Map<string, ActivityRecord>();

  // Process steps.csv
  const stepsPath = path.join(RAW_EXPORT_DIR, 'steps.csv');
  if (fs.existsSync(stepsPath)) {
    const content = fs.readFileSync(stepsPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!activity.has(date)) {
        activity.set(date, { date });
      }

      const act = activity.get(date)!;
      act.steps = parseInt(record.Value) || undefined;
    });

    console.log(`  Processed steps.csv: ${records.length} records`);
  }

  // Process sleep.csv
  const sleepPath = path.join(RAW_EXPORT_DIR, 'sleep.csv');
  if (fs.existsSync(sleepPath)) {
    const content = fs.readFileSync(sleepPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!activity.has(date)) {
        activity.set(date, { date });
      }

      const act = activity.get(date)!;
      act.sleep_hours = parseFloat(record.Value) || undefined;
    });

    console.log(`  Processed sleep.csv: ${records.length} records`);
  }

  // Process exercise-logs.csv (aggregate by date)
  const exercisePath = path.join(RAW_EXPORT_DIR, 'exercise-logs.csv');
  if (fs.existsSync(exercisePath)) {
    const content = fs.readFileSync(exercisePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!activity.has(date)) {
        activity.set(date, { date, exercise_minutes: 0, exercise_count: 0 });
      }

      const act = activity.get(date)!;
      const quantity = parseFloat(record.Quantity) || 0;

      act.exercise_minutes = (act.exercise_minutes || 0) + quantity;
      act.exercise_count = (act.exercise_count || 0) + 1;
    });

    console.log(`  Processed exercise-logs.csv: ${records.length} records`);
  }

  // Write to CSV
  const outputPath = path.join(OUTPUT_DIR, 'activity.csv');
  const data = Array.from(activity.values()).sort((a, b) => a.date.localeCompare(b.date));
  const csv = stringify(data, { header: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`  ✓ Created activity.csv: ${data.length} records\n`);
}

async function transformCalories() {
  console.log('Transforming CALORIES table...');

  const calories: CalorieRecord[] = [];

  const caloriesPath = path.join(RAW_EXPORT_DIR, 'daily-calorie-summary.csv');
  if (fs.existsSync(caloriesPath)) {
    const content = fs.readFileSync(caloriesPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      calories.push({
        date,
        food_calories: parseFloat(record['Food cals']) || undefined,
        exercise_calories: parseFloat(record['Exercise cals']) || undefined,
        calorie_budget: parseFloat(record['Budget cals']) || undefined,
        tdee: parseFloat(record.EER) || undefined
      });
    });

    console.log(`  Processed daily-calorie-summary.csv: ${records.length} records`);
  }

  // Write to CSV
  const outputPath = path.join(OUTPUT_DIR, 'calories.csv');
  const data = calories.sort((a, b) => a.date.localeCompare(b.date));
  const csv = stringify(data, { header: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`  ✓ Created calories.csv: ${data.length} records\n`);
}

async function transformMacros() {
  console.log('Transforming MACROS table...');

  const macros = new Map<string, MacroRecord>();

  // Process protein.csv
  const proteinPath = path.join(RAW_EXPORT_DIR, 'protein.csv');
  if (fs.existsSync(proteinPath)) {
    const content = fs.readFileSync(proteinPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!macros.has(date)) {
        macros.set(date, { date });
      }

      const macro = macros.get(date)!;
      macro.protein_grams = parseFloat(record.Value) || undefined;
    });

    console.log(`  Processed protein.csv: ${records.length} records`);
  }

  // Process carbohydrates.csv
  const carbsPath = path.join(RAW_EXPORT_DIR, 'carbohydrates.csv');
  if (fs.existsSync(carbsPath)) {
    const content = fs.readFileSync(carbsPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!macros.has(date)) {
        macros.set(date, { date });
      }

      const macro = macros.get(date)!;
      macro.carbs_grams = parseFloat(record.Value) || undefined;
    });

    console.log(`  Processed carbohydrates.csv: ${records.length} records`);
  }

  // Process fiber.csv
  const fiberPath = path.join(RAW_EXPORT_DIR, 'fiber.csv');
  if (fs.existsSync(fiberPath)) {
    const content = fs.readFileSync(fiberPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      if (!macros.has(date)) {
        macros.set(date, { date });
      }

      const macro = macros.get(date)!;
      macro.fiber_grams = parseFloat(record.Value) || undefined;
    });

    console.log(`  Processed fiber.csv: ${records.length} records`);
  }

  // Write to CSV
  const outputPath = path.join(OUTPUT_DIR, 'macros.csv');
  const data = Array.from(macros.values()).sort((a, b) => a.date.localeCompare(b.date));
  const csv = stringify(data, { header: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`  ✓ Created macros.csv: ${data.length} records\n`);
}

async function transformFood() {
  console.log('Transforming FOOD table...');

  const food: FoodRecord[] = [];

  const foodPath = path.join(RAW_EXPORT_DIR, 'food-logs.csv');
  if (fs.existsSync(foodPath)) {
    const content = fs.readFileSync(foodPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true
    });

    records.forEach((record: any) => {
      const date = record.Date;
      if (!date) return;

      // Create nutrients JSON
      const nutrients = {
        fat: parseFloat(record['Fat (g)']) || 0,
        protein: parseFloat(record['Protein (g)']) || 0,
        carbs: parseFloat(record['Carbohydrates (g)']) || 0,
        sat_fat: parseFloat(record['Saturated Fat (g)']) || 0,
        sugar: parseFloat(record['Sugars (g)']) || 0,
        fiber: parseFloat(record['Fiber (g)']) || 0,
        cholesterol: parseFloat(record['Cholesterol (mg)']) || 0,
        sodium: parseFloat(record['Sodium (mg)']) || 0
      };

      food.push({
        date,
        food_name: record.Name || '',
        meal: record.Meal || '',
        quantity: parseFloat(record.Quantity) || undefined,
        units: record.Units || '',
        calories: parseFloat(record.Calories) || undefined,
        nutrients: JSON.stringify(nutrients)
      });
    });

    console.log(`  Processed food-logs.csv: ${records.length} records`);
  }

  // Write to CSV
  const outputPath = path.join(OUTPUT_DIR, 'food.csv');
  const data = food.sort((a, b) => a.date.localeCompare(b.date));
  const csv = stringify(data, { header: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`  ✓ Created food.csv: ${data.length} records\n`);
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

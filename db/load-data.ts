#!/usr/bin/env node

/**
 * Load transformed CSV data into PostgreSQL/MySQL database
 * This script loads data from the transformed/ directory into the database
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const DB_URL = process.env.DATABASE_URL || 'postgresql://loseit:password@localhost:5432/loseit';

interface CsvRow {
  [key: string]: string;
}

async function loadCsvToTable(client: Client, csvPath: string, tableName: string) {
  if (!fs.existsSync(csvPath)) {
    console.log(`⚠️  Skipping ${tableName} - ${csvPath} not found`);
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  if (records.length === 0) {
    console.log(`⚠️  No data in ${tableName}`);
    return;
  }

  console.log(`Loading ${records.length} rows into ${tableName}...`);

  // Get column names from first record
  const columns = Object.keys(records[0]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  // Clear existing data
  await client.query(`DELETE FROM ${tableName}`);

  // Insert data in batches
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    for (const record of batch) {
      const values = columns.map(col => {
        const val = record[col];
        // Convert empty strings to null
        if (val === '' || val === null || val === undefined) return null;
        // Try to parse JSON if it looks like JSON
        if (val.startsWith('{') || val.startsWith('[')) {
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
        return val;
      });

      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      await client.query(query, values);
    }

    process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, records.length)}/${records.length}`);
  }

  console.log(`\n✓ Loaded ${records.length} rows into ${tableName}`);
}

async function main() {
  console.log('🔄 Loading LoseIt data into database...\n');

  const client = new Client({ connectionString: DB_URL });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    const transformedDir = path.join(process.cwd(), 'transformed');

    // Load data in order
    await loadCsvToTable(client, path.join(transformedDir, 'markers.csv'), 'markers');
    await loadCsvToTable(client, path.join(transformedDir, 'activity.csv'), 'activity');
    await loadCsvToTable(client, path.join(transformedDir, 'calories.csv'), 'calories');
    await loadCsvToTable(client, path.join(transformedDir, 'macros.csv'), 'macros');
    await loadCsvToTable(client, path.join(transformedDir, 'food.csv'), 'food');

    console.log('\n✅ All data loaded successfully!');

    // Show summary
    console.log('\n📊 Database Summary:');
    const tables = ['markers', 'activity', 'calories', 'macros', 'food'];
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ${table}: ${result.rows[0].count} rows`);
    }

  } catch (error: any) {
    console.error('\n❌ Error loading data:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

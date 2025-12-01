#!/usr/bin/env node

/**
 * Load transformed CSV data into PostgreSQL/MySQL database
 * This script loads data from the transformed/ directory into the database
 *
 * Usage:
 *   npm run db:load           # Incremental load (upsert only)
 *   npm run db:load -- --full # Full reload (delete all, then insert)
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const DB_URL = process.env.DATABASE_URL || 'postgresql://loseit:password@localhost:5432/loseit';

// Check for full reload flag
const FULL_RELOAD = process.argv.includes('--full') || process.argv.includes('--full-reload');

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

  const loadMode = FULL_RELOAD ? 'FULL RELOAD' : 'UPSERT';
  console.log(`Loading ${records.length} rows into ${tableName} (${loadMode})...`);

  // Get column names from first record (exclude auto-generated columns)
  const allColumns = Object.keys(records[0]);
  const columns = allColumns.filter(col => !['created_at', 'updated_at', 'id'].includes(col));
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  // Tables with unique date constraint that support upsert
  const hasDateUniqueConstraint = ['markers', 'activity', 'calories', 'macros'].includes(tableName);

  // Full reload: delete all existing data
  if (FULL_RELOAD) {
    await client.query(`DELETE FROM ${tableName}`);
    console.log(`  Cleared existing data from ${tableName}`);
  } else if (tableName === 'food') {
    // For food table without unique constraint: delete existing records for dates in CSV
    const dates = [...new Set(records.map(r => r.date))];
    if (dates.length > 0) {
      await client.query(`DELETE FROM ${tableName} WHERE date = ANY($1)`, [dates]);
      console.log(`  Cleared existing food logs for ${dates.length} dates`);
    }
  }

  // Insert/upsert data in batches
  const batchSize = 100;
  let insertedCount = 0;
  let updatedCount = 0;

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

      let query: string;
      if (FULL_RELOAD || tableName === 'food') {
        // Simple insert (food table or full reload already cleared data)
        query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        await client.query(query, values);
        insertedCount++;
      } else if (hasDateUniqueConstraint) {
        // Upsert for tables with date unique constraint
        const updateSet = columns
          .filter(col => col !== 'date')
          .map(col => `${col} = EXCLUDED.${col}`)
          .join(', ');

        query = `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (date) DO UPDATE SET
            ${updateSet},
            updated_at = CURRENT_TIMESTAMP
        `;
        const result = await client.query(query, values);
        // Note: PostgreSQL doesn't easily tell us if it was insert or update
        insertedCount++;
      }
    }

    process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, records.length)}/${records.length}`);
  }

  console.log(`\n✓ Loaded ${records.length} rows into ${tableName}`);
}

async function main() {
  const mode = FULL_RELOAD ? '🔄 FULL RELOAD' : '⚡ INCREMENTAL UPDATE';
  console.log(`${mode}: Loading LoseIt data into database...\n`);

  if (FULL_RELOAD) {
    console.log('⚠️  Full reload mode: All existing data will be deleted and reloaded\n');
  } else {
    console.log('✓ Incremental mode: New records will be inserted, existing records updated\n');
  }

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

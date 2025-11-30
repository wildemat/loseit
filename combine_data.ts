import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface CombinedRecord {
  date: string;
  [key: string]: any;
}

async function main() {
  console.log('Starting LoseIt data combination...\n');

  // Get zip file path from command line or find latest
  let zipFilePath: string | null | undefined = process.argv[2];

  if (!zipFilePath) {
    console.log('No zip file specified, searching for latest export...');
    zipFilePath = findLatestExport();
  }

  if (!zipFilePath || !fs.existsSync(zipFilePath)) {
    console.error('Error: Zip file not found');
    console.error('Usage: npm run combine [path/to/export.zip]');
    process.exit(1);
  }

  console.log(`Using zip file: ${zipFilePath}\n`);

  // Create tmp directory
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  fs.mkdirSync(tmpDir);

  console.log('Extracting zip file...');
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(tmpDir, true);

  // Find all CSV files in tmp directory
  const csvFiles = findCsvFiles(tmpDir);
  console.log(`Found ${csvFiles.length} CSV files:\n${csvFiles.map(f => '  - ' + path.basename(f)).join('\n')}\n`);

  if (csvFiles.length === 0) {
    console.error('No CSV files found in zip');
    process.exit(1);
  }

  // Parse all CSV files and combine by date
  console.log('Parsing and combining CSV files...');
  const combinedData = combineCSVsByDate(csvFiles);

  console.log(`Combined ${combinedData.length} total records`);

  // Write to latest_data.csv
  const outputPath = path.join(process.cwd(), 'latest_data.csv');
  const csvOutput = stringify(combinedData, { header: true });
  fs.writeFileSync(outputPath, csvOutput);

  console.log(`\n✓ Success! Combined data written to: latest_data.csv`);
  console.log(`File size: ${(csvOutput.length / 1024).toFixed(2)} KB`);

  // Clean up tmp directory
  console.log('\nCleaning up temporary files...');
  fs.rmSync(tmpDir, { recursive: true });
  console.log('Done!');
}

function findLatestExport(): string | null {
  const files = fs.readdirSync(process.cwd());
  const exportFiles = files
    .filter(f => f.startsWith('loseit-export-') && f.endsWith('.zip'))
    .map(f => ({
      name: f,
      path: path.join(process.cwd(), f),
      mtime: fs.statSync(path.join(process.cwd(), f)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return exportFiles.length > 0 ? exportFiles[0].path : null;
}

function findCsvFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findCsvFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.csv')) {
      files.push(fullPath);
    }
  }

  return files;
}

function combineCSVsByDate(csvFiles: string[]): CombinedRecord[] {
  const recordsByDate = new Map<string, CombinedRecord>();

  for (const csvFile of csvFiles) {
    const fileName = path.basename(csvFile, '.csv');
    const content = fs.readFileSync(csvFile, 'utf-8');

    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
        skip_records_with_error: true
      });

      console.log(`  Processing ${fileName}: ${records.length} records`);

      // Find date field once for the whole file
      const dateField = records.length > 0 ? Object.keys(records[0]).find(key =>
        key.toLowerCase() === 'date' ||
        key.toLowerCase() === 'datetime' ||
        key.toLowerCase() === 'timestamp' ||
        key.toLowerCase() === 'created' ||
        key.toLowerCase() === 'date created' ||
        key.toLowerCase().includes('date')
      ) : null;

      if (!dateField) {
        console.warn(`    Warning: No date field found in ${fileName}, skipping...`);
        continue;
      }

      for (const record of records) {

        const dateValue = record[dateField];
        if (!dateValue) continue;

        // Normalize date to YYYY-MM-DD format if possible
        const normalizedDate = normalizeDateString(dateValue);

        // Get or create record for this date
        if (!recordsByDate.has(normalizedDate)) {
          recordsByDate.set(normalizedDate, { date: normalizedDate });
        }

        const combinedRecord = recordsByDate.get(normalizedDate)!;

        // Add fields from this CSV with prefix
        for (const [key, value] of Object.entries(record)) {
          if (key.toLowerCase() === dateField.toLowerCase()) continue; // Skip date field

          // Prefix field name with CSV file name to avoid collisions
          const prefixedKey = `${fileName}_${key}`;
          combinedRecord[prefixedKey] = value;
        }
      }
    } catch (error) {
      console.error(`    Error parsing ${fileName}:`, error instanceof Error ? error.message : error);
    }
  }

  // Convert map to array and sort by date
  const sortedRecords = Array.from(recordsByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return sortedRecords;
}

function normalizeDateString(dateStr: string): string {
  // Try to parse and normalize date to YYYY-MM-DD format
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // If parsing fails, return original
  }
  return dateStr;
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

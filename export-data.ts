import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import AdmZip from 'adm-zip';

// Load environment variables from .env file
dotenv.config();

const LOSEIT_URL = 'https://www.loseit.com';
const LOGIN_URL = 'https://my.loseit.com/login';
const EXPORT_URL = 'https://www.loseit.com/export/data';

async function main() {
  console.log('Starting LoseIt data export...\n');

  // Get credentials from environment variables
  const email = process.env.LOSEIT_EMAIL;
  const password = process.env.LOSEIT_PASSWORD;

  if (!email || !password) {
    throw new Error('LOSEIT_EMAIL and LOSEIT_PASSWORD environment variables must be set');
  }

  const browser: Browser = await chromium.launch({
    headless: true,
    timeout: 30000
  });

  // Ensure browser closes on unexpected exit
  const cleanup = async () => {
    try {
      await browser.close();
    } catch (e) {
      // Browser might already be closed
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    // Navigate to login page
    console.log('Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    // Fill in login form
    console.log('Filling in login credentials...');

    // Wait for and fill email input (using specific ID from the form)
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.fill('#email', email);

    // Fill password (using specific ID from the form)
    await page.fill('#password', password);

    console.log('Submitting login form...');

    // Click the submit button
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    console.log('Waiting for authentication...');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

    // Verify we're logged in by checking for cookies
    console.log('Verifying authentication...');
    const cookies = await context.cookies();

    if (cookies.length === 0) {
      throw new Error('Login failed. No cookies found after authentication.');
    }

    console.log(`Authentication successful. Found ${cookies.length} cookies.`);

    // Request the export data - handle as download
    console.log('\nRequesting data export from /export/data...');

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Trigger the download by navigating via JavaScript (avoids page.goto error)
    await page.evaluate((url) => {
      window.location.href = url;
    }, EXPORT_URL);

    // Wait for the download to start
    const download = await downloadPromise;

    console.log('Download started...');

    // Save the file with fixed name
    const filename = 'loseit-export-latest.zip';
    const filepath = path.join(process.cwd(), filename);

    // Show progress during download
    const stream = await download.createReadStream();
    const fileStream = fs.createWriteStream(filepath);

    let downloadedBytes = 0;
    const startTime = Date.now();

    stream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const downloadedKB = (downloadedBytes / 1024).toFixed(2);
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r  Downloaded: ${downloadedKB} KB (${elapsedSeconds}s)`);
    });

    // Pipe the stream to file and wait for completion
    stream.pipe(fileStream);

    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', () => {
        resolve();
      });
      stream.on('error', reject);
      fileStream.on('error', reject);
    });

    process.stdout.write('\n');

    // Get file size
    const stats = fs.statSync(filepath);

    console.log(`✓ Download complete: ${filename}`);
    console.log(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);

    // Extract the zip file
    console.log('\nExtracting zip file...');
    const rawExportDir = path.join(process.cwd(), 'raw_export');

    // Remove old raw_export directory if it exists
    if (fs.existsSync(rawExportDir)) {
      fs.rmSync(rawExportDir, { recursive: true, force: true });
    }

    // Extract zip
    const zip = new AdmZip(filepath);
    zip.extractAllTo(rawExportDir, true);

    const extractedFiles = fs.readdirSync(rawExportDir);
    console.log(`✓ Extracted ${extractedFiles.length} files to raw_export/`);

    console.log('\n✓ Success! Export complete and ready for processing.');

  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    console.log('\nClosing browser...');
    await browser.close();
    console.log('Browser closed.');
  }
}

// Run the script
main()
  .then(() => {
    console.log('Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

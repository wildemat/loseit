import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const LOSEIT_URL = 'https://www.loseit.com';
const EXPORT_URL = 'https://www.loseit.com/export/data';

async function main() {
  console.log('Starting LoseIt data export...\n');

  const browser: Browser = await chromium.launch({
    headless: false, // Show browser so user can sign in
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

    // Navigate to LoseIt
    console.log('Opening LoseIt.com...');
    await page.goto(LOSEIT_URL);

    // Wait for user to sign in
    console.log('\n==============================================');
    console.log('Please sign in to your LoseIt account in the browser.');
    console.log('Press Enter in this terminal when you are signed in...');
    console.log('==============================================\n');

    await waitForUserInput();

    // Get cookies from the authenticated session
    console.log('Capturing authentication cookies...');
    const cookies = await context.cookies();

    if (cookies.length === 0) {
      throw new Error('No cookies found. Make sure you are signed in.');
    }

    console.log(`Found ${cookies.length} cookies.`);

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

    // Save the file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `loseit-export-${timestamp}.zip`;
    const filepath = path.join(process.cwd(), filename);

    await download.saveAs(filepath);

    // Get file size
    const stats = fs.statSync(filepath);

    console.log(`\n✓ Success! Data exported to: ${filename}`);
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    console.log('\nClosing browser...');
    await browser.close();
    console.log('Browser closed.');
  }
}

function waitForUserInput(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
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

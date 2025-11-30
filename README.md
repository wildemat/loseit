# TODO

- pull in apple health export from the app

# LoseIt Data Export & Processing Scripts

Node.js/TypeScript scripts for downloading and processing your personal data from LoseIt.com.

## Scripts

### 1. Export Script (`export-data.ts`)

Downloads your LoseIt data using browser authentication.

**How it works:**

1. Opens a Chrome browser window to loseit.com
2. Waits for you to manually sign in
3. Captures your authentication cookies
4. Uses those credentials to download your data export from `/export/data`
5. Saves the zip file as `loseit-export-YYYY-MM-DD.zip`

### 2. Combine Script (`combine_data.ts`)

Processes a downloaded zip file and combines all CSVs into a single file.

**How it works:**

1. Takes a zip file (auto-finds latest if not specified)
2. Extracts all CSV files to a temporary directory
3. Joins all CSVs by their date field
4. Saves combined data to `latest_data.csv` (overwrites existing)
5. Cleans up temporary files

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browsers:

```bash
npx playwright install chromium
```

## Usage

### Exporting Data

Download your data from LoseIt:

```bash
npm run export
```

Steps:

1. Browser window opens to loseit.com
2. Sign in to your account
3. Press Enter in the terminal when signed in
4. Data downloads as `loseit-export-YYYY-MM-DD.zip`

### Combining Data

Process the downloaded zip file and combine all CSVs:

```bash
# Auto-find latest export file
npm run combine

# Or specify a zip file
npm run combine path/to/loseit-export-2025-11-28.zip
```

This will:

- Extract all CSV files from the zip
- Join them by date field
- Save to `latest_data.csv` (overwrites existing)

### Complete Workflow

```bash
# 1. Export data
npm run export

# 2. Combine the data
npm run combine

# Result: latest_data.csv contains all your data in one file
```

## Output Files

- `loseit-export-YYYY-MM-DD.zip` - Raw export from LoseIt containing multiple CSVs
- `latest_data.csv` - Combined data from all CSVs, joined by date

## Troubleshooting

- **No cookies found**: Make sure you're fully signed in before pressing Enter
- **Export request failed**: Check that you can manually access https://www.loseit.com/export/data while logged in
- **Browser doesn't open**: Make sure Playwright browsers are installed with `npx playwright install chromium`

## Technical Details

### Export Script

- Uses Playwright for browser automation
- Runs in non-headless mode for manual sign-in
- Captures session cookies after authentication
- Downloads zip file using Playwright's download event handler
- Properly cleans up browser process on exit

### Combine Script

- Uses `adm-zip` for zip extraction
- Uses `csv-parse` and `csv-stringify` for CSV processing
- Automatically detects date fields (case-insensitive: "date", "datetime", "timestamp")
- Normalizes dates to YYYY-MM-DD format
- Prefixes column names with source CSV filename to avoid collisions
- Sorts final output by date

## License

MIT

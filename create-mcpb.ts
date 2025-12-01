import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

async function createMCPBundle() {
  console.log('Creating MCP bundle...\n');

  const zip = new AdmZip();

  // Create manifest
  const manifest = {
    name: 'loseit',
    displayName: 'LoseIt Health Data',
    version: '1.0.0',
    description: 'Query LoseIt health tracking data including weight, calories, activity, macros, and food logs',
    author: '',
    license: 'MIT',
    type: 'stdio',
    command: 'node',
    args: ['mcp-server.js'],
    env: {},
    tools: [
      {
        name: 'get_weight',
        description: 'Get weight and body fat measurements for a specific date or date range',
      },
      {
        name: 'get_calories',
        description: 'Get calorie intake, expenditure, and budget data',
      },
      {
        name: 'get_activity',
        description: 'Get physical activity data including steps, sleep, and exercise',
      },
      {
        name: 'get_macros',
        description: 'Get macronutrient intake (protein, carbs, fiber)',
      },
      {
        name: 'get_food_logs',
        description: 'Get detailed food log entries with optional filtering',
      },
      {
        name: 'get_daily_summary',
        description: 'Get a comprehensive summary combining all data sources for a specific date',
      },
      {
        name: 'get_trends',
        description: 'Get trend analysis over a date range with aggregation',
      },
    ],
    metadata: {
      category: 'Health & Fitness',
      tags: ['health', 'fitness', 'nutrition', 'tracking', 'weight-loss'],
    },
    requirements: {
      node: '>=18.0.0',
    },
  };

  // Add manifest.json
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  console.log('✓ Added manifest.json');

  // Add the compiled MCP server
  const serverPath = path.join(process.cwd(), 'dist', 'mcp-server.js');
  if (fs.existsSync(serverPath)) {
    zip.addLocalFile(serverPath);
    console.log('✓ Added mcp-server.js');
  } else {
    console.error('Error: dist/mcp-server.js not found. Run "npm run build" first.');
    process.exit(1);
  }

  // Add database initialization files
  const dbFiles = ['init.js', 'reset.js', 'server.js'];
  const distDbPath = path.join(process.cwd(), 'dist', 'db');

  if (fs.existsSync(distDbPath)) {
    dbFiles.forEach(file => {
      const filePath = path.join(distDbPath, file);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath, 'db');
        console.log(`✓ Added db/${file}`);
      }
    });
  }

  // Add README
  const readme = `# LoseIt Health Data MCP Server

This MCP server provides tools to query your LoseIt health tracking data.

## Prerequisites

1. Node.js >= 18.0.0
2. PostgreSQL database running with your LoseIt data

## Available Tools

1. **get_weight** - Get weight and body fat measurements
2. **get_calories** - Get calorie intake and expenditure data
3. **get_activity** - Get steps, sleep, and exercise data
4. **get_macros** - Get macronutrient intake (protein, carbs, fiber)
5. **get_food_logs** - Get detailed food log entries
6. **get_daily_summary** - Get comprehensive daily summary
7. **get_trends** - Get trend analysis with aggregation

## Usage

After installing this extension in Claude Desktop, you can ask natural language questions like:

- "What was my weight on November 15th?"
- "Show me my calorie intake for the past week"
- "What foods did I eat for breakfast yesterday?"
- "How has my weight changed over the past month?"

## Database Location

This extension expects the LoseIt database to be at:
${process.cwd()}/db/loseit.db

Make sure the database exists and is populated before using the tools.
`;

  zip.addFile('README.md', Buffer.from(readme));
  console.log('✓ Added README.md');

  // Write the bundle
  const bundlePath = path.join(process.cwd(), 'loseit.mcpb');
  zip.writeZip(bundlePath);

  console.log(`\n✓ MCP bundle created: ${bundlePath}`);
  console.log('\nYou can now drag this file into Claude Desktop Extensions settings.');
}

createMCPBundle().catch(console.error);

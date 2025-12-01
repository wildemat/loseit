# LoseIt MCP Server

Query your LoseIt health tracking data directly in Claude Desktop using the Model Context Protocol (MCP).

## What This Does

This MCP server lets you ask Claude natural language questions about your LoseIt health data:

- **"What was my weight on November 15th?"**
- **"Show me my calorie intake for the past week"**
- **"How has my weight changed over the past month?"**
- **"What did I eat for breakfast yesterday?"**

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Desktop │ --> │  MCP Server      │ --> │  PostgreSQL DB  │
│                 │     │  (loseit.mcpb)   │     │  (local/remote) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Key Features:**
- ✅ MCP bundle is lightweight and data-free (~2MB vs 16MB)
- ✅ Update your data without touching the MCP bundle
- ✅ Database can be local (Docker) OR remote (cloud)
- ✅ No filesystem dependencies - data lives in PostgreSQL
- ✅ Fast queries with proper database indexing

## Quick Start

### 1. Install Dependencies

```bash
git clone <your-repo>
cd loseit
npm install
```

### 2. Start Database & Load Data

```bash
# Start PostgreSQL in Docker
npm run db:start

# Set up your LoseIt credentials
cp .env.example .env
# Edit .env and add your LoseIt email and password

# Export data from LoseIt.com (automated, headless)
npm run data:export

# Process and load into database
npm run data:process
npm run db:load
```

### 3. Build & Install MCP Bundle

```bash
# Build the MCP bundle
npm run mcp:bundle

# Install loseit.mcpb in Claude Desktop
# Drag into Settings → Extensions
```

### 4. Configure & Use

In Claude Desktop, configure the database URL:
- Default: `postgresql://loseit:password@localhost:5432/loseit`

Restart Claude Desktop and start asking questions!

## Updating Your Data

When you want to refresh your LoseIt data:

```bash
npm run data:update
```

This downloads the latest export, processes it, and loads it into PostgreSQL using **incremental updates** (only new/changed records are updated). **No need to rebuild or reinstall the MCP bundle!**

### Incremental vs Full Reload

By default, `npm run db:load` performs an **incremental update**:
- **Upserts** records for tables with unique date constraints (markers, activity, calories, macros)
- For the food table, deletes existing records for dates in the new export, then inserts fresh data
- Faster and preserves any manual database changes outside the date range

For a complete refresh, use:
```bash
npm run db:load:full
```

This performs a **full reload**:
- Deletes all existing data from all tables
- Inserts all records from the export
- Use this for the initial load or if you want a clean slate

## Available Tools

The MCP server provides 7 core tools:

1. **get_weight** - Weight and body fat measurements
2. **get_calories** - Calorie intake, expenditure, and budget
3. **get_activity** - Steps, sleep, and exercise data
4. **get_macros** - Protein, carbs, fiber intake
5. **get_food_logs** - Detailed food entries with filtering
6. **get_daily_summary** - Comprehensive daily overview
7. **get_trends** - Trend analysis with aggregation (day/week/month)

## Additional Data Sources

### Apple Health Integration
Process Apple Health XML exports to supplement activity data with:
- Detailed workout sessions
- Heart rate monitoring
- Sleep analysis
- Comprehensive activity metrics

See [apple_health/README.md](./apple_health/README.md) for details.

### Obsidian Weightlifting Notes
Parse freeform weightlifting notes from Obsidian to track:
- Strength progression
- Personal records (PRs)
- Training volume
- Workout frequency

See [obsidian/README.md](./obsidian/README.md) for details.

## Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup guide with troubleshooting
- **[EXAMPLES.md](./EXAMPLES.md)** - Example queries and use cases
- **[SCHEMA.md](./SCHEMA.md)** - Database schema documentation

## Configuration

### Environment Variables

Create a `.env` file with your LoseIt credentials:

```bash
LOSEIT_EMAIL=your-email@example.com
LOSEIT_PASSWORD=your-password
```

These are used for automated data export via headless browser automation.

## Package Scripts

### Data Management
- `npm run data:export` - Download data from LoseIt.com (requires .env file)
- `npm run data:process` - Transform CSVs to database format
- `npm run data:update` - Complete data refresh workflow

### Database
- `npm run db:start` - Start PostgreSQL in Docker
- `npm run db:stop` - Stop database server
- `npm run db:load` - Load processed data (incremental upsert)
- `npm run db:load:full` - Full reload (delete all, then insert)
- `npm run db:psql` - Open PostgreSQL shell
- `npm run db:ui` - Start pgAdmin web UI

### MCP Bundle
- `npm run mcp:bundle` - Build the .mcpb bundle
- `npm run mcp:validate` - Validate manifest.json
- `npm run mcp:info` - Show bundle info

### All-in-One
- `npm run setup` - Complete initial setup (db + data + bundle)

## Using a Remote Database

Want to use a cloud database instead of local Docker?

1. Set up PostgreSQL on [Railway](https://railway.app), [Supabase](https://supabase.com), or [Neon](https://neon.tech)
2. Get your connection URL: `postgresql://user:pass@host:port/database`
3. Load your data:
   ```bash
   export DATABASE_URL="your-connection-url"
   npm run db:load
   ```
4. Configure the URL in Claude Desktop settings

See [SETUP.md](./SETUP.md#using-a-remote-database) for details.

## Requirements

- **Node.js** >= 18.0.0
- **Docker** (for local database) OR PostgreSQL server access
- **Claude Desktop**
- **npm** package manager

## Troubleshooting

### Database won't start
```bash
npm run db:stop
npm run db:start
npm run db:logs
```

### MCP server can't connect
1. Verify database is running: `docker ps`
2. Test connection: `npm run db:psql`
3. Check URL in Claude Desktop settings

### Data not showing up
```bash
# Verify data is loaded
npm run db:psql
# Then: SELECT COUNT(*) FROM markers;
```

See [SETUP.md](./SETUP.md#troubleshooting) for more help.

## License

MIT

# LoseIt MCP Server - Complete Setup Guide

This guide walks you through setting up the LoseIt MCP Server with a **server-based architecture** where your data lives in a PostgreSQL database (local or remote), separate from the MCP bundle.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Desktop │ --> │  MCP Server      │ --> │  PostgreSQL DB  │
│                 │     │  (loseit.mcpb)   │     │  (local/remote) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           │
                                                    Your health data
```

**Key Benefits:**
- ✅ MCP bundle is lightweight and data-free
- ✅ Update data without touching the MCP bundle
- ✅ Database can be local OR remote
- ✅ No filesystem dependencies in the bundle

---

## Prerequisites

1. **Node.js** >= 18.0.0
2. **Docker** (for local database) OR access to a remote PostgreSQL server
3. **npm** package manager
4. **Claude Desktop** installed

---

## Initial Setup (One Time)

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd loseit
npm install
```

### Step 2: Start the Database Server

#### Option A: Local PostgreSQL (Recommended for beginners)

```bash
npm run db:start
```

This starts a PostgreSQL server in Docker on `localhost:5432`.

**Database credentials:**
- Host: `localhost`
- Port: `5432`
- Database: `loseit`
- User: `loseit`
- Password: `password`
- Connection URL: `postgresql://loseit:password@localhost:5432/loseit`

#### Option B: Remote PostgreSQL

If you want to use a cloud database (Railway, Supabase, AWS RDS, etc.), skip `db:start` and use your remote connection URL in the manifest configuration.

### Step 3: Download Your LoseIt Data

```bash
npm run data:export
```

This opens a browser where you'll:
1. Log in to LoseIt.com
2. Navigate to Settings → Export Data
3. Download your data
4. The script processes the CSV files automatically

### Step 4: Process and Load Data

```bash
npm run data:process    # Transform CSVs to database format
npm run db:load         # Load data into PostgreSQL
```

### Step 5: Build the MCP Bundle

```bash
npm run mcp:bundle
```

This creates `loseit.mcpb` - a lightweight bundle containing:
- Compiled JavaScript code
- Database connection logic
- MCP tool definitions
- **NO DATA** (data lives in PostgreSQL)

### Step 6: Install in Claude Desktop

1. Open Claude Desktop
2. Go to Settings → Extensions
3. Drag `loseit.mcpb` into the extensions area
4. Configure the database connection URL:
   - Default: `postgresql://loseit:password@localhost:5432/loseit`
   - For remote: Use your cloud database URL

### Step 7: Restart Claude Desktop

Restart Claude Desktop to load the MCP server.

---

## 🎉 You're Done!

Try asking Claude:
- "What was my weight on November 15th?"
- "Show me my calorie intake for the past week"
- "How has my weight changed over the past month?"

---

## Updating Your Data (Ongoing)

When you want to refresh your LoseIt data:

```bash
npm run data:update
```

This will:
1. Download latest export from LoseIt
2. Process the CSV files
3. Load updated data into PostgreSQL

**No need to rebuild or reinstall the MCP bundle!** Claude will automatically query the latest data.

---

## Quick Start (All-in-One)

If you have raw CSV files in `raw_export/` already:

```bash
npm run setup
```

This runs the entire setup flow:
1. Starts database
2. Processes data
3. Loads data
4. Builds MCP bundle

---

## Database Management

### View Logs
```bash
npm run db:logs
```

### Connect to Database
```bash
npm run db:psql
```

### Database UI (Optional)
```bash
npm run db:ui
```
Then visit http://localhost:5050
- Email: `admin@loseit.local`
- Password: `admin`

### Stop Database
```bash
npm run db:stop
```

**Note:** Your data is persisted in a Docker volume, so stopping/starting the database won't lose data.

---

## Using a Remote Database

### 1. Set up remote PostgreSQL

Example providers:
- [Railway](https://railway.app) - Free tier, easy setup
- [Supabase](https://supabase.com) - Free tier, includes UI
- [Neon](https://neon.tech) - Serverless PostgreSQL

### 2. Get your connection URL

Format: `postgresql://username:password@host:port/database`

Example: `postgresql://user:pass@db.railway.app:5432/railway`

### 3. Update manifest.json

Edit the `database_url` default:

```json
{
  "user_config": {
    "properties": {
      "database_url": {
        "default": "postgresql://user:pass@your-host.com:5432/loseit"
      }
    }
  }
}
```

### 4. Load data to remote database

```bash
export DATABASE_URL="postgresql://user:pass@your-host.com:5432/loseit"
npm run db:load
```

### 5. Rebuild and reinstall MCP bundle

```bash
npm run mcp:bundle
```

Then reinstall in Claude Desktop with the new database URL.

---

## Troubleshooting

### Database won't start

```bash
# Check if port 5432 is already in use
lsof -i :5432

# Stop existing PostgreSQL
npm run db:stop

# Restart
npm run db:start
```

### Can't connect to database

```bash
# Verify database is running
docker ps | grep loseit-db

# Check database logs
npm run db:logs
```

### MCP server can't connect

1. Verify database is running: `npm run db:logs`
2. Check connection URL in Claude Desktop settings
3. Test connection manually: `npm run db:psql`

### Data not showing up in Claude

1. Verify data is loaded: `npm run db:psql`, then `SELECT COUNT(*) FROM markers;`
2. Check MCP server logs in Claude Desktop
3. Restart Claude Desktop

---

## Architecture Deep Dive

### Server-Based Database Architecture

This project uses a **server-based architecture** with PostgreSQL or MySQL:

- ✅ Data is separate from MCP bundle
- ✅ Update data without touching the bundle
- ✅ Can be local (Docker) OR remote (cloud)
- ✅ Better performance and scalability
- ✅ Industry-standard tools and workflows

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. User exports data from LoseIt.com               │
│    → CSVs saved to raw_export/                     │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 2. Transform script processes CSVs                  │
│    → Normalized data in transformed/                │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 3. Load script inserts into PostgreSQL             │
│    → Data lives in database server                  │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 4. MCP server queries PostgreSQL                   │
│    → Claude gets latest data on every request       │
└─────────────────────────────────────────────────────┘
```

---

## Security Notes

### Local Database
- Database runs on localhost (not exposed to internet)
- Default credentials are fine for local use
- Firewall blocks external access by default

### Remote Database
- **Use strong passwords**
- **Enable SSL/TLS** for connections
- Store connection URLs in Claude Desktop settings (encrypted)
- Never commit database credentials to git

---

## Next Steps

1. ✅ Set up database
2. ✅ Load your data
3. ✅ Install MCP bundle
4. 🔄 Use Claude to query your health data!
5. 📊 (Optional) Set up automated data syncing

---

## Support

For issues or questions:
- Check [EXAMPLES.md](./EXAMPLES.md) for query examples
- Review [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) for technical details
- Check the logs: `npm run db:logs`

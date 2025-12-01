/**
 * Database connection for MCP server
 * Supports PostgreSQL and MySQL running as server processes (local or remote)
 * Data is kept separate from the MCP bundle in the database server
 */

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://loseit:password@localhost:5432/loseit";

export interface DatabaseConnection {
  connect(): Promise<void>;
  query(sql: string, params?: any[]): Promise<QueryResult>;
  close(): Promise<void>;
}

export interface QueryResult {
  columns: string[];
  values: any[][];
}

/**
 * Detect database type from connection URL
 */
function detectDatabaseType(url: string): "postgresql" | "mysql" {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  } else if (url.startsWith("mysql://")) {
    return "mysql";
  }
  throw new Error(
    `Unsupported database URL: ${url}. Use postgresql:// or mysql://`
  );
}

/**
 * PostgreSQL connection wrapper
 */
class PostgresConnection implements DatabaseConnection {
  private client: any = null;

  async connect(): Promise<void> {
    try {
      const { Client } = require("pg");
      this.client = new Client({ connectionString: DB_URL });
      await this.client.connect();
      console.error("Connected to PostgreSQL database");
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error}`);
    }
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.client) await this.connect();

    const result = await this.client.query(sql, params);

    return {
      columns: result.fields.map((f: any) => f.name),
      values: result.rows.map((row: any) => Object.values(row)),
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }
}

/**
 * MySQL connection wrapper
 */
class MySQLConnection implements DatabaseConnection {
  private connection: any = null;

  async connect(): Promise<void> {
    try {
      const mysql = require("mysql2/promise");
      this.connection = await mysql.createConnection(DB_URL);
      console.error("Connected to MySQL database");
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error}`);
    }
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.connection) await this.connect();

    const [rows, fields] = await this.connection.execute(sql, params);

    return {
      columns: fields.map((f: any) => f.name),
      values: Array.isArray(rows)
        ? rows.map((row: any) => Object.values(row))
        : [],
    };
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}

/**
 * Factory function to create the appropriate database connection
 */
export async function createConnection(): Promise<DatabaseConnection> {
  const dbType = detectDatabaseType(DB_URL);

  let connection: DatabaseConnection;

  switch (dbType) {
    case "postgresql":
      connection = new PostgresConnection();
      break;
    case "mysql":
      connection = new MySQLConnection();
      break;
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }

  await connection.connect();
  return connection;
}

/**
 * Helper function to execute a query and return results
 * Automatically handles connection lifecycle
 */
export async function executeQuery(
  sql: string,
  params?: any[]
): Promise<QueryResult> {
  const conn = await createConnection();
  try {
    return await conn.query(sql, params);
  } finally {
    await conn.close();
  }
}

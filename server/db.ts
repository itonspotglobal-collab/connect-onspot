import { Pool, neonConfig, PoolClient, QueryResult } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Defer DATABASE_URL validation to startup validation instead of throwing on import
// This allows graceful error handling and proper error messages
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

// Initialize database connection (called by validation step)
export function initializeDatabase(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });

    // Handle connection errors
    pool.on('error', (err: Error, client: PoolClient) => {
      console.error('🔥 Unexpected error on idle database client', err);
      process.exit(-1);
    });
  }
}

// Get database connection with lazy initialization for backward compatibility
export function getPool(): Pool {
  if (!pool) {
    initializeDatabase();
  }
  return pool!;
}

export function getDB() {
  if (!db) {
    initializeDatabase();
  }
  return db!;
}

// Export pool and db with lazy initialization for backward compatibility
export { pool, db };

// Helper function to execute queries with error handling (for raw SQL usage)
export const query = async (text: string, params: any[] = []): Promise<QueryResult<any>> => {
  const start = Date.now();
  try {
    const activePool = getPool();
    const res = await activePool.query(text, params);
    const duration = Date.now() - start;
    console.log('🔍 Executed query', { text: text.slice(0, 100) + (text.length > 100 ? '...' : ''), duration, rows: res.rowCount });
    return res;
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error('❌ Database query error', { text: text.slice(0, 100) + (text.length > 100 ? '...' : ''), duration, error: error.message });
    throw error;
  }
};

// Helper function to get a client from the pool
export const getClient = async (): Promise<PoolClient> => {
  const activePool = getPool();
  return await activePool.connect();
};

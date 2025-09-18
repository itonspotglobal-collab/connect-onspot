import { Pool } from 'pg';

// Create a connection pool for PostgreSQL using DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error if connection takes longer than 2 seconds
});

// Handle connection errors
pool.on('error', (err, client) => {
  console.error('🔥 Unexpected error on idle database client', err);
  process.exit(-1);
});

// Test the connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error acquiring client', err.stack);
    process.exit(-1);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// Helper function to execute queries with error handling
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('🔍 Executed query', { text: text.slice(0, 100) + (text.length > 100 ? '...' : ''), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Database query error', { text: text.slice(0, 100) + (text.length > 100 ? '...' : ''), duration, error: error.message });
    throw error;
  }
};

// Helper function to get a client from the pool
const getClient = async () => {
  return await pool.connect();
};

export { pool, query, getClient };
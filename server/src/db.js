const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

async function connectDB() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW()');
    console.log(`PostgreSQL connected — ${res.rows[0].now}`);
  } finally {
    client.release();
  }
}

module.exports = { pool, connectDB };

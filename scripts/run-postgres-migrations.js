const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
  throw new Error('Falta DATABASE_URL. Copiá la connection string de Neon al archivo .env.');
}

const migrationsDir = path.join(__dirname, '..', 'database', 'postgresql', 'migrations');

async function main() {
  const client = new Client({ connectionString: databaseUrl, application_name: 'damecancha-migrations', enableChannelBinding: true });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const result = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(result.rows.map((row) => row.filename));
    const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`↪ ${filename} ya aplicada`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
      console.log(`▶ Aplicando ${filename}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`✓ ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('✅ Migraciones PostgreSQL al día.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('❌ Error de migración:', error.message);
  process.exit(1);
});

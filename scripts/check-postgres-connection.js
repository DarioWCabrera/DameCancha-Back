require('dotenv').config();
const { Client } = require('pg');

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl) throw new Error('Falta DATABASE_URL.');

async function main() {
  const client = new Client({ connectionString: databaseUrl, application_name: 'damecancha-db-check', enableChannelBinding: true });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS usuario,
        version() AS version,
        now() AS hora_servidor
    `);
    const row = result.rows[0];
    console.log('✅ Conexión PostgreSQL OK');
    console.log(`Base: ${row.database}`);
    console.log(`Usuario: ${row.usuario}`);
    console.log(`Servidor: ${row.version.split(',')[0]}`);
    console.log(`Hora: ${row.hora_servidor.toISOString()}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('❌ No se pudo conectar a PostgreSQL:', error.message);
  process.exit(1);
});

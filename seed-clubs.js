/**
 * Seed de desarrollo/staging para PostgreSQL / Neon.
 * Uso: npm run seed
 * Requiere DATABASE_URL y SEED_PASSWORD.
 */
require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

if (process.env.NODE_ENV === 'production') {
  throw new Error('El seed de datos de ejemplo está bloqueado en producción.');
}

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl) throw new Error('Falta DATABASE_URL.');

const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 8 || !/[A-Za-z]/.test(seedPassword) || !/\d/.test(seedPassword)) {
  throw new Error('SEED_PASSWORD debe tener al menos 8 caracteres, una letra y un número.');
}

const clubesData = [
  {
    nombre: 'Club Deportivo 1', email: 'Club1@gmail.com', deportes: ['Fútbol 5', 'Básquet', 'Tenis'],
    canchas: [
      { nombre: 'Cancha 1 - Fútbol 5', deporte: 'Fútbol 5', precio: 20000 },
      { nombre: 'Cancha 2 - Fútbol 5', deporte: 'Fútbol 5', precio: 20000 },
      { nombre: 'Cancha de Básquet', deporte: 'Básquet', precio: 15000 },
      { nombre: 'Cancha de Tenis', deporte: 'Tenis', precio: 12000 },
    ],
  },
  {
    nombre: 'Club Deportivo 2', email: 'Club2@gmail.com', deportes: ['Fútbol 7', 'Vóley', 'Pádel'],
    canchas: [
      { nombre: 'Cancha de Fútbol 7', deporte: 'Fútbol 7', precio: 20000 },
      { nombre: 'Cancha de Vóley', deporte: 'Vóley', precio: 15000 },
      { nombre: 'Cancha de Pádel 1', deporte: 'Pádel', precio: 12000 },
      { nombre: 'Cancha de Pádel 2', deporte: 'Pádel', precio: 12000 },
    ],
  },
  {
    nombre: 'Club Deportivo 3', email: 'Club3@gmail.com', deportes: ['Natación', 'Tenis', 'Fútbol 11'],
    canchas: [
      { nombre: 'Piscina Olímpica', deporte: 'Natación', precio: 5000 },
      { nombre: 'Cancha de Tenis 1', deporte: 'Tenis', precio: 12000 },
      { nombre: 'Cancha de Tenis 2', deporte: 'Tenis', precio: 12000 },
      { nombre: 'Cancha de Fútbol 11', deporte: 'Fútbol 11', precio: 20000 },
    ],
  },
  {
    nombre: 'Club Deportivo 4', email: 'Club4@gmail.com', deportes: ['Golf', 'Pádel', 'Básquet'],
    canchas: [
      { nombre: 'Campo de Golf 18 hoyos', deporte: 'Golf', precio: 12000 },
      { nombre: 'Cancha de Pádel A', deporte: 'Pádel', precio: 12000 },
      { nombre: 'Cancha de Básquet', deporte: 'Básquet', precio: 15000 },
    ],
  },
  {
    nombre: 'Club Deportivo 5', email: 'Club5@gmail.com', deportes: ['Fútbol 5', 'Vóley', 'Natación'],
    canchas: [
      { nombre: 'Cancha de Fútbol 5 Premium', deporte: 'Fútbol 5', precio: 20000 },
      { nombre: 'Cancha de Vóley de Arena', deporte: 'Vóley', precio: 15000 },
      { nombre: 'Cancha de Vóley Techada', deporte: 'Vóley', precio: 15000 },
      { nombre: 'Piscina Semi-Olímpica', deporte: 'Natación', precio: 5000 },
    ],
  },
];

const usuariosComunes = [
  { email: 'User1@gmail.com', nombre: 'Usuario', apellido: 'Uno' },
  { email: 'User2@gmail.com', nombre: 'Usuario', apellido: 'Dos' },
  { email: 'User3@gmail.com', nombre: 'Usuario', apellido: 'Tres' },
];

const administradores = [
  { email: 'Admin1@gmail.com', nombre: 'Administrador', apellido: 'Uno' },
  { email: 'Admin2@gmail.com', nombre: 'Administrador', apellido: 'Dos' },
];

const deportesDisponibles = [
  ['Fútbol 5', 'Fútbol 5 vs 5'], ['Fútbol 7', 'Fútbol 7 vs 7'], ['Fútbol 11', 'Fútbol 11 vs 11'],
  ['Básquet', 'Básquetbol'], ['Tenis', 'Tenis individual'], ['Vóley', 'Voleibol'],
  ['Pádel', 'Pádel tenis'], ['Natación', 'Natación'], ['Golf', 'Golf'],
];

async function ensureUser(client, { nombre, apellido, email, tipo }, hash) {
  const found = await client.query('SELECT id_usuario FROM "user" WHERE LOWER(email_usuario)=LOWER($1)', [email]);
  if (found.rowCount) return found.rows[0].id_usuario;
  const result = await client.query(`
    INSERT INTO "user" (nombre_usuario, apellido_usuario, email_usuario, password_usuario, telefono_usuario, tipo_usuario, estado_usuario)
    VALUES ($1,$2,$3,$4,$5,$6,'activo') RETURNING id_usuario
  `, [nombre, apellido, email, hash, '123456789', tipo]);
  return result.rows[0].id_usuario;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl, application_name: 'damecancha-seed', enableChannelBinding: true });
  await client.connect();
  const hash = await bcrypt.hash(seedPassword, 10);

  try {
    await client.query('BEGIN');
    const deportesMap = {};
    for (const [nombre, descripcion] of deportesDisponibles) {
      let result = await client.query('SELECT id_deporte FROM deporte WHERE nombre_deporte=$1', [nombre]);
      if (!result.rowCount) {
        result = await client.query('INSERT INTO deporte(nombre_deporte, descripcion_deporte) VALUES($1,$2) RETURNING id_deporte', [nombre, descripcion]);
      }
      deportesMap[nombre] = result.rows[0].id_deporte;
    }

    for (const admin of administradores) {
      await ensureUser(client, { ...admin, tipo: 'admin' }, hash);
    }
    for (const usuario of usuariosComunes) {
      await ensureUser(client, { ...usuario, tipo: 'usuario' }, hash);
    }

    for (const club of clubesData) {
      const userId = await ensureUser(client, {
        nombre: club.nombre.split(' ')[0], apellido: 'Dueño', email: club.email, tipo: 'dueno',
      }, hash);

      let clubResult = await client.query('SELECT id_club FROM club WHERE id_dueno=$1 LIMIT 1', [userId]);
      let clubId;
      if (clubResult.rowCount) {
        clubId = clubResult.rows[0].id_club;
      } else {
        clubResult = await client.query(`
          INSERT INTO club (nombre_club, deportes_club, direccion_club, ciudad_club, provincia_club, telefono_club, id_dueno, estado)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'activo') RETURNING id_club
        `, [club.nombre, JSON.stringify(club.deportes), 'Calle Principal 123', 'Buenos Aires', 'Buenos Aires', '123456789', userId]);
        clubId = clubResult.rows[0].id_club;
      }

      const existing = await client.query('SELECT COUNT(*)::int AS cantidad FROM cancha WHERE id_club=$1', [clubId]);
      if (existing.rows[0].cantidad === 0) {
        for (const cancha of club.canchas) {
          await client.query(`
            INSERT INTO cancha (nombre_cancha, descripcion_cancha, precio_por_hora, id_club, id_deporte, activa)
            VALUES ($1,$2,$3,$4,$5,1)
          `, [cancha.nombre, `Cancha de ${cancha.deporte}`, cancha.precio, clubId, deportesMap[cancha.deporte]]);
        }
      }
    }

    await client.query('COMMIT');
    console.log('✅ Seed PostgreSQL completado.');
    console.log('La contraseña de prueba proviene de SEED_PASSWORD.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('❌ Error durante el seed:', error.message);
  process.exit(1);
});

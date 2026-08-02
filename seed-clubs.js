/**
 * Script de seed para generar datos de ejemplo
 * Uso: npm run seed
 * 
 * Genera:
 * - 5 dueños de club: Club1@gmail.com - Club5@gmail.com
 * - 5 clubes con canchas y deportes
 * - 3 usuarios comunes: User1@gmail.com - User3@gmail.com
 * - 2 administradores: Admin1@gmail.com, Admin2@gmail.com
 * - Contraseña definida mediante SEED_PASSWORD (solo desarrollo/staging)
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

if (process.env.NODE_ENV === 'production') {
  throw new Error('El seed de datos de ejemplo está bloqueado en producción.');
}

const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 8 || !/[A-Za-z]/.test(seedPassword) || !/\d/.test(seedPassword)) {
  throw new Error('SEED_PASSWORD debe tener al menos 8 caracteres, una letra y un número.');
}

// Datos de ejemplo para los clubes
const clubesData = [
  {
    nombre: 'Club Deportivo 1',
    email: 'Club1@gmail.com',
    deportes: ['Fútbol 5', 'Básquet', 'Tenis'],
    canchas: [
      { nombre: 'Cancha 1 - Fútbol 5', deporte: 'Fútbol 5', precio: 20000 },
      { nombre: 'Cancha 2 - Fútbol 5', deporte: 'Fútbol 5', precio: 20000 },
      { nombre: 'Cancha de Básquet', deporte: 'Básquet', precio: 15000 },
      { nombre: 'Cancha de Tenis', deporte: 'Tenis', precio: 12000 },
    ]
  },
  {
    nombre: 'Club Deportivo 2',
    email: 'Club2@gmail.com',
    deportes: ['Fútbol 7', 'Vóley', 'Pádel'],
    canchas: [
      { nombre: 'Cancha de Fútbol 7', deporte: 'Fútbol 7', precio: 20000 },
      { nombre: 'Cancha de Vóley', deporte: 'Vóley', precio: 15000 },
      { nombre: 'Cancha de Pádel 1', deporte: 'Pádel', precio: 12000 },
      { nombre: 'Cancha de Pádel 2', deporte: 'Pádel', precio: 12000 },
    ]
  },
  {
    nombre: 'Club Deportivo 3',
    email: 'Club3@gmail.com',
    deportes: ['Natación', 'Tenis', 'Fútbol 11'],
    canchas: [
      { nombre: 'Piscina Olímpica', deporte: 'Natación', precio: 5000 },
      { nombre: 'Cancha de Tenis 1', deporte: 'Tenis', precio: 12000 },
      { nombre: 'Cancha de Tenis 2', deporte: 'Tenis', precio: 12000 },
      { nombre: 'Cancha de Fútbol 11', deporte: 'Fútbol 11', precio: 20000 },
    ]
  },
  {
    nombre: 'Club Deportivo 4',
    email: 'Club4@gmail.com',
    deportes: ['Golf', 'Pádel', 'Básquet'],
    canchas: [
      { nombre: 'Campo de Golf 18 hoyos', deporte: 'Golf', precio: 12000 },
      { nombre: 'Cancha de Pádel A', deporte: 'Pádel', precio: 12000 },
      { nombre: 'Cancha de Básquet', deporte: 'Básquet', precio: 15000 },
    ]
  },
  {
    nombre: 'Club Deportivo 5',
    email: 'Club5@gmail.com',
    deportes: ['Fútbol 5', 'Vóley', 'Natación'],
    canchas: [
      { nombre: 'Cancha de Fútbol 5 Premium', deporte: 'Fútbol 5', precio: 20000 },
      { nombre: 'Cancha de Vóley de Arena', deporte: 'Vóley', precio: 15000 },
      { nombre: 'Cancha de Vóley Techada', deporte: 'Vóley', precio: 15000 },
      { nombre: 'Piscina Semi-Olímpica', deporte: 'Natación', precio: 5000 },
    ]
  }
];

// Usuarios comunes
const usuariosComunes = [
  { email: 'User1@gmail.com', nombre: 'Usuario', apellido: 'Uno' },
  { email: 'User2@gmail.com', nombre: 'Usuario', apellido: 'Dos' },
  { email: 'User3@gmail.com', nombre: 'Usuario', apellido: 'Tres' },
];

// Administradores
const administradores = [
  { email: 'Admin1@gmail.com', nombre: 'Administrador', apellido: 'Uno' },
  { email: 'Admin2@gmail.com', nombre: 'Administrador', apellido: 'Dos' },
];

const deportesDisponibles = [
  { nombre: 'Fútbol 5', descripcion: 'Fútbol 5 vs 5' },
  { nombre: 'Fútbol 7', descripcion: 'Fútbol 7 vs 7' },
  { nombre: 'Fútbol 11', descripcion: 'Fútbol 11 vs 11' },
  { nombre: 'Básquet', descripcion: 'Básquetbol' },
  { nombre: 'Tenis', descripcion: 'Tenis individual' },
  { nombre: 'Vóley', descripcion: 'Voleibol' },
  { nombre: 'Pádel', descripcion: 'Pádel tenis' },
  { nombre: 'Natación', descripcion: 'Natación' },
  { nombre: 'Golf', descripcion: 'Golf' },
];

async function seedDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'damecancha'
  });

  try {
    console.log('🌱 Iniciando seed de datos de desarrollo...\n');
    const seedPasswordHash = await bcrypt.hash(seedPassword, 10);

    // Paso 1: Crear deportes si no existen
    console.log('📚 Creando deportes...');
    const deportesMap = {};
    
    for (const deporte of deportesDisponibles) {
      const query = 'INSERT IGNORE INTO deporte (nombre_deporte, descripcion_deporte) VALUES (?, ?)';
      await connection.execute(query, [deporte.nombre, deporte.descripcion]);
      
      // Obtener el ID del deporte
      const [rows] = await connection.execute('SELECT id_deporte FROM deporte WHERE nombre_deporte = ?', [deporte.nombre]);
      deportesMap[deporte.nombre] = rows[0].id_deporte;
    }
    console.log(`✅ Deportes creados/verificados: ${Object.keys(deportesMap).length}\n`);

    let usuariosCreados = 0;
    let clubesCreados = 0;
    let chanchasCreadas = 0;
    let usuariosComId = 0;
    let administradoresCreados = 0;

    // Paso 2: Crear administradores
    console.log('👨‍💼 Creando administradores...');
    for (const admin of administradores) {
      const userQuery = `
        INSERT IGNORE INTO user 
        (nombre_usuario, apellido_usuario, email_usuario, password_usuario, telefono_usuario, tipo_usuario, estado_usuario)
        VALUES (?, ?, ?, ?, ?, 'admin', 'activo')
      `;
      
      try {
        const [result] = await connection.execute(userQuery, [
          admin.nombre,
          admin.apellido,
          admin.email,
          seedPasswordHash,
          '123456789'
        ]);
        
        administradoresCreados++;
        console.log(`  ✓ Admin: ${admin.email}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`  ⚠️  Admin ${admin.email} ya existe`);
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Administradores: ${administradoresCreados}\n`);

    // Paso 3: Crear usuarios comunes
    console.log('👥 Creando usuarios comunes...');
    for (const usuario of usuariosComunes) {
      const userQuery = `
        INSERT IGNORE INTO user 
        (nombre_usuario, apellido_usuario, email_usuario, password_usuario, telefono_usuario, tipo_usuario, estado_usuario)
        VALUES (?, ?, ?, ?, ?, 'usuario', 'activo')
      `;
      
      try {
        const [result] = await connection.execute(userQuery, [
          usuario.nombre,
          usuario.apellido,
          usuario.email,
          seedPasswordHash,
          '123456789'
        ]);
        
        usuariosComId++;
        console.log(`  ✓ Usuario: ${usuario.email}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`  ⚠️  Usuario ${usuario.email} ya existe`);
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Usuarios comunes: ${usuariosComId}\n`);

    // Paso 4: Crear dueños de club y clubes
    console.log('🏟️  Creando clubes...');
    for (const club of clubesData) {
      // Crear usuario (dueño) - intentar insertar
      const userQuery = `
        INSERT IGNORE INTO user 
        (nombre_usuario, apellido_usuario, email_usuario, password_usuario, telefono_usuario, tipo_usuario, estado_usuario)
        VALUES (?, ?, ?, ?, ?, 'dueno', 'activo')
      `;
      
      try {
        const [result] = await connection.execute(userQuery, [
          club.nombre.split(' ')[0],
          'Dueño',
          club.email,
          seedPasswordHash,
          '123456789'
        ]);
        
        // Si insertId es 0, el usuario ya existía → obtener su ID real
        let userId = result.insertId;
        if (userId === 0) {
          const [existingUser] = await connection.execute(
            'SELECT id_usuario FROM user WHERE email_usuario = ?',
            [club.email]
          );
          if (existingUser.length > 0) {
            userId = existingUser[0].id_usuario;
            console.log(`  ⚠️  Dueño ${club.email} ya existe (ID: ${userId})`);
          } else {
            console.log(`  ❌ No se pudo obtener el ID del dueño ${club.email}, saltando...\n`);
            continue;
          }
        } else {
          usuariosCreados++;
          console.log(`  ✓ Dueño: ${club.email} (ID: ${userId})`);
        }

        // Verificar si el club ya existe para este dueño
        const [existingClub] = await connection.execute(
          'SELECT id_club FROM club WHERE id_dueno = ?',
          [userId]
        );

        let clubId;
        if (existingClub.length > 0) {
          clubId = existingClub[0].id_club;
          console.log(`    ⚠️  Club para dueño ${club.email} ya existe (ID: ${clubId}), saltando club y canchas...\n`);
          continue;
        }

        // Crear club
        const deportesJson = JSON.stringify(club.deportes);
        const clubQuery = `
          INSERT INTO club 
          (nombre_club, deportes_club, direccion_club, ciudad_club, provincia_club, telefono_club, id_dueno, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')
        `;
        
        const [clubResult] = await connection.execute(clubQuery, [
          club.nombre,
          deportesJson,
          'Calle Principal 123',
          'Buenos Aires',
          'Buenos Aires',
          '123456789',
          userId
        ]);
        
        clubId = clubResult.insertId;
        clubesCreados++;
        console.log(`    └─ Club: ${club.nombre} (ID: ${clubId})`);

        // Crear canchas para cada deporte del club
        for (const cancha of club.canchas) {
          const canchaQuery = `
            INSERT INTO cancha 
            (nombre_cancha, descripcion_cancha, precio_por_hora, id_club, id_deporte, activa)
            VALUES (?, ?, ?, ?, ?, 1)
          `;
          
          const deporteId = deportesMap[cancha.deporte];
          if (!deporteId) {
            console.log(`      ⚠️  Deporte "${cancha.deporte}" no encontrado, saltando cancha "${cancha.nombre}"`);
            continue;
          }
          await connection.execute(canchaQuery, [
            cancha.nombre,
            `Cancha de ${cancha.deporte}`,
            cancha.precio,
            clubId,
            deporteId
          ]);
          
          chanchasCreadas++;
        }
        
        console.log(`      └─ ${club.canchas.length} canchas creadas\n`);

      } catch (error) {
        console.log(`  ❌ Error con club ${club.email}: ${error.message}\n`);
      }
    }

    console.log('\n✅ Seed completado exitosamente!\n');
    console.log(`📊 Resumen:`);
    console.log(`  ✓ Administradores: ${administradoresCreados}`);
    console.log(`  ✓ Usuarios comunes: ${usuariosComId}`);
    console.log(`  ✓ Dueños de club: ${usuariosCreados}`);
    console.log(`  ✓ Clubes: ${clubesCreados}`);
    console.log(`  ✓ Canchas: ${chanchasCreadas}`);
    console.log(`  ✓ Deportes: ${Object.keys(deportesMap).length}`);
    console.log('\n🔐 La contraseña de prueba fue tomada de SEED_PASSWORD.\n');
    console.log(`📝 Credenciales:\n`);
    console.log(`  Administradores:`);
    administradores.forEach(a => console.log(`    - ${a.email}`));
    console.log(`\n  Usuarios comunes:`);
    usuariosComunes.forEach(u => console.log(`    - ${u.email}`));
    console.log(`\n  Clubes (dueños):`);
    clubesData.forEach(c => console.log(`    - ${c.email}`));
    console.log();

  } catch (error) {
    console.error('❌ Error durante el seed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Ejecutar seed
seedDatabase();




//npm run seed

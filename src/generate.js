const { execSync } = require('child_process');

const entities = ['admin', 'reserva', 'club', 'pago', 'deporte', 'cancha', 'disponibilidad'];

entities.forEach(entity => {
  console.log(`Generando: ${entity}...`);
  execSync(`nest g resource ${entity} --no-spec`, { stdio: 'inherit' });
});

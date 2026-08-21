const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://stjbtxrrdofuxhigxfcy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0amJ0eHJyZG9mdXhoaWd4ZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTgwNzUsImV4cCI6MjA3NzM5NDA3NX0.vhz6v2pRepUH7g-ucSJKtWonmAeWYqwhrTxG_ypVElo'
);

async function run() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(); fin.setHours(23, 59, 59, 999);
  const hoyDate = hoy.toISOString().split('T')[0];

  console.log('\n=== ZONA HORARIA LOCAL ===', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('HOY_START:', hoy.toISOString());
  console.log('HOY_END  :', fin.toISOString());
  console.log('HOY_DATE :', hoyDate);

  const [salas, todasSesiones, sesionesActivas, ventasHoy, todasVentas, gastos] = await Promise.all([
    sb.from('salas').select('id, nombre, activa, estado'),
    sb.from('sesiones').select('id, sala_id, estado, fecha_inicio, fecha_fin, tiempo_contratado').order('fecha_inicio', { ascending: false }).limit(10),
    sb.from('sesiones').select('id, sala_id, estado, fecha_inicio, fecha_fin, tiempo_contratado').eq('estado', 'activa').is('fecha_fin', null),
    sb.from('ventas').select('id, total, fecha_cierre').gte('fecha_cierre', hoy.toISOString()).lte('fecha_cierre', fin.toISOString()),
    sb.from('ventas').select('id, total, fecha_cierre').order('fecha_cierre', { ascending: false }).limit(5),
    sb.from('gastos').select('id, monto, fecha_gasto').order('fecha_gasto', { ascending: false }).limit(5),
  ]);

  console.log('\n=== SALAS ===', JSON.stringify(salas.data));
  console.log('\n=== TODAS SESIONES (últimas 10) ===', JSON.stringify(todasSesiones.data, null, 2));
  console.log('\n=== SESIONES ACTIVAS (estado=activa + fecha_fin IS NULL) ===', JSON.stringify(sesionesActivas.data));
  console.log('\n=== VENTAS HOY ===', JSON.stringify(ventasHoy.data));
  console.log('\n=== TODAS VENTAS (últimas 5) ===', JSON.stringify(todasVentas.data, null, 2));
  console.log('\n=== GASTOS (últimas 5) ===', JSON.stringify(gastos.data, null, 2));
  console.log('\nErrores:', { salas: salas.error, sesiones: todasSesiones.error, ventasHoy: ventasHoy.error });
}

run().catch(console.error);

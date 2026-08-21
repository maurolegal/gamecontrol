const { createClient } = require('@supabase/supabase-js');
const url = 'https://stjbtxrrdofuxhigxfcy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0amJ0eHJyZG9mdXhoaWd4ZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTgwNzUsImV4cCI6MjA3NzM5NDA3NX0.vhz6v2pRepUH7g-ucSJKtWonmAeWYqwhrTxG_ypVElo';
const sb = createClient(url, key);

(async () => {
  // Todos los movimientos de POSTOBON y DE TODITO (sin filtro de fecha)
  const { data: movsAll } = await sb.from('movimientos_stock')
    .select('id,tipo,cantidad,motivo,referencia,fecha_movimiento,producto_id,sesion_id,stock_anterior,stock_nuevo')
    .in('producto_id', ['1081336a-1f69-4146-9625-b4a63ff987d1', 'ecfac957-e16b-450a-b3f7-b49ebcd0a042'])
    .order('fecha_movimiento', { ascending: false })
    .limit(20);
  console.log('=== TODOS LOS MOVIMIENTOS DE POSTOBON + TODITO ===');
  movsAll?.forEach(m => console.log(
    m.fecha_movimiento?.slice(0,19),
    m.producto_id === '1081336a-1f69-4146-9625-b4a63ff987d1' ? 'DETODITO' : 'POSTOBON',
    m.tipo, 'cant:', m.cantidad,
    'stock:', m.stock_anterior, '->', m.stock_nuevo,
    'sesion_id:', m.sesion_id?.slice(-8)
  ));

  // Movimientos del dia 2026-04-07
  const { data: movsHoy } = await sb.from('movimientos_stock')
    .select('id,tipo,cantidad,motivo,referencia,fecha_movimiento,producto_id,stock_anterior,stock_nuevo')
    .gte('fecha_movimiento', '2026-04-07T00:00:00')
    .order('fecha_movimiento', { ascending: false })
    .limit(30);
  console.log('\n=== TODOS LOS MOVIMIENTOS DEL 07/04 ===');
  movsHoy?.forEach(m => console.log(
    m.fecha_movimiento?.slice(0,19),
    m.producto_id?.slice(-8),
    m.tipo, 'cant:', m.cantidad,
    'stock:', m.stock_anterior, '->', m.stock_nuevo,
    'ref:', m.referencia
  ));
})();

  const { data: movsAll } = await sb.from('movimientos_stock')
    .select('id,tipo,cantidad,motivo,referencia,fecha_movimiento,producto_id,sesion_id,stock_anterior,stock_nuevo')
    .in('producto_id', ['1081336a-1f69-4146-9625-b4a63ff987d1', 'ecfac957-e16b-450a-b3f7-b49ebcd0a042'])
    .order('fecha_movimiento', { ascending: false })
    .limit(20);
  console.log('=== TODOS LOS MOVIMIENTOS DE POSTOBON + TODITO ===');
  movsAll?.forEach(m => console.log(
    m.fecha_movimiento?.slice(0,19),
    m.producto_id === '1081336a-1f69-4146-9625-b4a63ff987d1' ? 'DETODITO' : 'POSTOBON',
    m.tipo, 'cant:', m.cantidad,
    'stock:', m.stock_anterior, '->', m.stock_nuevo,
    'sesion_id:', m.sesion_id?.slice(-8)
  ));

  // Movimientos del dia 2026-04-07
  const { data: movsHoy } = await sb.from('movimientos_stock')
    .select('id,tipo,cantidad,motivo,referencia,fecha_movimiento,producto_id,stock_anterior,stock_nuevo')
    .gte('fecha_movimiento', '2026-04-07T00:00:00')
    .order('fecha_movimiento', { ascending: false })
    .limit(30);
  console.log('\n=== TODOS LOS MOVIMIENTOS DEL 07/04 ===');
  movsHoy?.forEach(m => console.log(
    m.fecha_movimiento?.slice(0,19),
    m.producto_id?.slice(-8),
    m.tipo, 'cant:', m.cantidad,
    'stock:', m.stock_anterior, '->', m.stock_nuevo,
    'ref:', m.referencia
  ));
})();

const url = 'https://stjbtxrrdofuxhigxfcy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0amJ0eHJyZG9mdXhoaWd4ZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTgwNzUsImV4cCI6MjA3NzM5NDA3NX0.vhz6v2pRepUH7g-ucSJKtWonmAeWYqwhrTxG_ypVElo';
const sb = createClient(url, key);

(async () => {
  // 1. Movimientos DE TODITO
  const { data: movsTodito } = await sb.from('movimientos_stock')
    .select('id,tipo,cantidad,motivo,referencia,fecha_movimiento,producto_id,sesion_id')
    .eq('producto_id', '1081336a-1f69-4146-9625-b4a63ff987d1')
    .order('fecha_movimiento', { ascending: false })
    .limit(10);
  console.log('=== MOVIMIENTOS DE TODITO (ultimos 10) ===');
  movsTodito?.forEach(m => console.log(m.fecha_movimiento?.slice(0,19), m.tipo, m.cantidad, 'sesion_id:', m.sesion_id, 'ref:', m.referencia));

  // 2. Movimientos de POSTOBON
  const { data: movsPost } = await sb.from('movimientos_stock')
    .select('id,tipo,cantidad,motivo,referencia,fecha_movimiento,producto_id,sesion_id')
    .eq('producto_id', 'ecfac957-e16b-450a-b3f7-b49ebcd0a042')
    .order('fecha_movimiento', { ascending: false })
    .limit(10);
  console.log('\n=== MOVIMIENTOS POSTOBON (ultimos 10) ===');
  movsPost?.forEach(m => console.log(m.fecha_movimiento?.slice(0,19), m.tipo, m.cantidad, 'sesion_id:', m.sesion_id, 'ref:', m.referencia));

  // 3. Stock actual
  const { data: prods } = await sb.from('productos')
    .select('id,nombre,stock')
    .in('id', ['1081336a-1f69-4146-9625-b4a63ff987d1', 'ecfac957-e16b-450a-b3f7-b49ebcd0a042']);
  console.log('\n=== STOCK ACTUAL ===');
  prods?.forEach(p => console.log(p.nombre, 'stock:', p.stock));

  // 4. La sesion EAA1AF27 completa
  const { data: s } = await sb.from('sesiones')
    .select('id,productos,total_productos,total_general,fecha_inicio,fecha_fin')
    .eq('id', '3bda950b-66ba-48bd-a519-4697eaa1af27')
    .single();
  console.log('\n=== SESION EAA1AF27 PRODUCTOS ARRAY ===');
  console.log(JSON.stringify(s?.productos, null, 2));
  console.log('total_productos:', s?.total_productos, 'total_general:', s?.total_general);
})();


(async () => {
  // 1. Movimientos DE TODITO
  const { data: sesiones } = await sb.from('sesiones')
    .select('id,estacion,cliente,productos,total_productos,total_general,fecha_inicio,fecha_fin,estado')
    .eq('estado','finalizada')
    .order('fecha_fin', { ascending: false })
    .limit(5);
  
  const sesion = sesiones?.find(s => s.id.toUpperCase().includes('EAA1AF27'));
  console.log('=== SESIÓN EAA1AF27 ===');
  console.log(JSON.stringify(sesion, null, 2));

  if (!sesion) { console.log('No encontrada'); process.exit(); }

  // 2. venta_items para esa sesión
  const { data: items, error: itemsErr } = await sb.from('venta_items')
    .select('*')
    .eq('venta_id', sesion.id);
  console.log('\n=== VENTA_ITEMS ===');
  if (itemsErr) console.log('Error:', itemsErr.message);
  else console.log(JSON.stringify(items, null, 2));

  // 3. movimientos_stock cerca de fecha_fin
  const desde = new Date(new Date(sesion.fecha_fin).getTime() - 5*60*1000).toISOString();
  const hasta = new Date(new Date(sesion.fecha_fin).getTime() + 2*60*1000).toISOString();
  const { data: movs, error: movsErr } = await sb.from('movimientos_stock')
    .select('id,tipo,cantidad,motivo,referencia,fecha_movimiento,producto_id')
    .eq('tipo','venta')
    .gte('fecha_movimiento', desde)
    .lte('fecha_movimiento', hasta);
  console.log('\n=== MOVIMIENTOS_STOCK (rango sesión) ===');
  if (movsErr) console.log('Error:', movsErr.message);
  else console.log(JSON.stringify(movs, null, 2));

  // 4. Buscar TODITO en productos
  const { data: todito } = await sb.from('productos')
    .select('id,nombre,stock')
    .ilike('nombre', '%TODITO%')
    .limit(5);
  console.log('\n=== PRODUCTO TODITO ===');
  console.log(JSON.stringify(todito, null, 2));
})();

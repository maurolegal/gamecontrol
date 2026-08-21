// ===================================================================
// AUDITORÍA READ-ONLY: Ventas de hoy 2026-08-20
// Fase 1 — Solo consulta, NO ejecuta DELETE
// ===================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env.test');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^VITE_SUPABASE_(\w+)=(.+)$/);
  if (match) env[`SUPABASE_${match[1]}`] = match[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// Autenticar como admin para tener permisos de lectura
const ADMIN_EMAIL = 'admin@sonixtec.co';
const ADMIN_PASSWORD = 'admin1234';

async function main() {
  console.log('='.repeat(70));
  console.log('AUDITORÍA READ-ONLY — Ventas de hoy 2026-08-20');
  console.log('='.repeat(70));

  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (authError) {
    console.error('❌ Error de auth:', authError.message);
    process.exit(1);
  }
  console.log('✅ Autenticado como:', authData.user.email);

  // ── FASE 1: Consultar ventas de hoy ──────────────────────────────
  console.log('\n' + '─'.repeat(70));
  console.log('FASE 1: Ventas creadas el 2026-08-20');
  console.log('─'.repeat(70));

  const { data: ventas, error: errVentas } = await supabase
    .from('ventas')
    .select('*')
    .gte('created_at', '2026-08-20T00:00:00-05')
    .lt('created_at', '2026-08-21T00:00:00-05')
    .order('created_at', { ascending: true });

  if (errVentas) {
    console.error('❌ Error consultando ventas:', errVentas.message);
    process.exit(1);
  }

  console.log(`\nTotal ventas de hoy: ${ventas.length}\n`);

  if (ventas.length === 0) {
    console.log('No hay ventas de hoy. Fin.');
    process.exit(0);
  }

  // ── Para cada venta, obtener detalles ────────────────────────────
  const ventasDetalle = [];

  for (const v of ventas) {
    // venta_items
    const { data: items } = await supabase
      .from('venta_items')
      .select('*')
      .eq('venta_id', v.id)
      .order('line_no', { ascending: true });

    // sesión vinculada
    let sesion = null;
    if (v.sesion_id) {
      const { data: s } = await supabase
        .from('sesiones')
        .select('id, estacion, cliente, estado, finalizada, fecha_inicio, fecha_fin, sala_id')
        .eq('id', v.sesion_id)
        .maybeSingle();
      sesion = s;
    }

    // movimientos_stock asociados (por referencia o venta_id)
    const { data: movs } = await supabase
      .from('movimientos_stock')
      .select('*')
      .or(`referencia.eq.${v.sesion_id || ''}`)
      .order('fecha_movimiento', { ascending: true });

    // usuario creador
    let usuario = null;
    if (v.usuario_id) {
      const { data: u } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol')
        .eq('id', v.usuario_id)
        .maybeSingle();
      usuario = u;
    }

    ventasDetalle.push({
      venta: v,
      items: items || [],
      sesion,
      movimientos: movs || [],
      usuario,
    });
  }

  // ── Imprimir detalle de cada venta ───────────────────────────────
  for (const d of ventasDetalle) {
    const v = d.venta;
    console.log('─'.repeat(70));
    console.log(`VENTA #${v.id}`);
    console.log(`  created_at:     ${v.created_at}`);
    console.log(`  fecha_cierre:   ${v.fecha_cierre || 'N/A'}`);
    console.log(`  estado:         ${v.estado}`);
    console.log(`  sesion_id:      ${v.sesion_id || 'NULL (venta directa POS)'}`);
    console.log(`  sala_id:        ${v.sala_id || 'NULL'}`);
    console.log(`  estacion:       ${v.estacion || 'N/A'}`);
    console.log(`  cliente:        ${v.cliente || 'N/A'}`);
    console.log(`  total:          ${v.total}`);
    console.log(`  subtotal_tiempo:    ${v.subtotal_tiempo}`);
    console.log(`  subtotal_productos: ${v.subtotal_productos}`);
    console.log(`  descuento:      ${v.descuento}`);
    console.log(`  metodo_pago:    ${v.metodo_pago}`);
    console.log(`  notas:          ${v.notas || 'NULL'}`);
    console.log(`  idempotency_key: ${v.idempotency_key || 'NULL'}`);
    console.log(`  usuario:        ${d.usuario ? `${d.usuario.email} (${d.usuario.rol})` : 'NULL'}`);

    // Items
    console.log(`  venta_items:    ${d.items.length}`);
    for (const item of d.items) {
      console.log(`    - line ${item.line_no}: ${item.descripcion} ×${item.cantidad} = ${item.subtotal} (${item.tipo})`);
    }

    // Sesión
    if (d.sesion) {
      console.log(`  sesión:         ${d.sesion.estacion} · ${d.sesion.cliente} · estado=${d.sesion.estado} · finalizada=${d.sesion.finalizada}`);
    }

    // Movimientos de stock
    console.log(`  movimientos_stock: ${d.movimientos.length}`);
    for (const m of d.movimientos) {
      console.log(`    - ${m.tipo} producto_id=${m.producto_id} cant=${m.cantidad} stock ${m.stock_anterior}→${m.stock_nuevo} motivo=${m.motivo}`);
    }

    // ── Clasificación ──
    let clasificacion = 'AMBIGUA';
    const razones = [];

    // Criterios DEMO
    if (v.notas && /test|demo|prueba/i.test(v.notas)) {
      clasificacion = 'DEMO_CONFIRMED';
      razones.push('notas contienen "test/demo/prueba"');
    }
    if (v.idempotency_key && /test|demo|prueba/i.test(v.idempotency_key)) {
      clasificacion = 'DEMO_CONFIRMED';
      razones.push('idempotency_key contiene "test/demo/prueba"');
    }
    if (v.cliente && /test|demo|prueba/i.test(v.cliente)) {
      clasificacion = 'DEMO_CONFIRMED';
      razones.push('cliente contiene "test/demo/prueba"');
    }
    if (v.estacion === 'Tienda' && v.total <= 0 && v.estado === 'cerrada') {
      clasificacion = 'DEMO_CONFIRMED';
      razones.push('venta POS con total 0');
    }
    if (v.notas && /Venta directa POS/i.test(v.notas) && v.total > 0) {
      // Venta POS real — no es demo por este criterio solo
    }

    // Criterios REAL
    if (v.total > 0 && v.estado === 'cerrada' && d.items.length > 0 && !/test|demo|prueba/i.test(v.notas || '')) {
      if (clasificacion !== 'DEMO_CONFIRMED') {
        clasificacion = 'REAL';
        razones.push('venta cerrada con total>0 e items');
      }
    }

    console.log(`  🏷 CLASIFICACIÓN: ${clasificacion}`);
    if (razones.length > 0) {
      console.log(`     Razones: ${razones.join(', ')}`);
    }
    console.log();
  }

  // ── Resumen ──────────────────────────────────────────────────────
  const demo = ventasDetalle.filter(d => {
    const v = d.venta;
    if (v.notas && /test|demo|prueba/i.test(v.notas)) return true;
    if (v.idempotency_key && /test|demo|prueba/i.test(v.idempotency_key)) return true;
    if (v.cliente && /test|demo|prueba/i.test(v.cliente)) return true;
    if (v.estacion === 'Tienda' && v.total <= 0 && v.estado === 'cerrada') return true;
    return false;
  });

  const real = ventasDetalle.filter(d => {
    const v = d.venta;
    if (demo.includes(d)) return false;
    return v.total > 0 && v.estado === 'cerrada' && d.items.length > 0;
  });

  const ambigua = ventasDetalle.filter(d => !demo.includes(d) && !real.includes(d));

  console.log('='.repeat(70));
  console.log('RESUMEN DE CLASIFICACIÓN');
  console.log('='.repeat(70));
  console.log(`DEMO_CONFIRMED:  ${demo.length}`);
  console.log(`REAL:            ${real.length}`);
  console.log(`AMBIGUA:         ${ambigua.length}`);

  if (demo.length > 0) {
    console.log('\n─ DEMO_CONFIRMED IDs:');
    demo.forEach(d => console.log(`  ${d.venta.id} | total=${d.venta.total} | notas=${d.venta.notas || ''} | items=${d.items.length} | movs=${d.movimientos.length}`));
  }
  if (real.length > 0) {
    console.log('\n─ REAL IDs:');
    real.forEach(d => console.log(`  ${d.venta.id} | total=${d.venta.total} | cliente=${d.venta.cliente || ''}`));
  }
  if (ambigua.length > 0) {
    console.log('\n─ AMBIGUA IDs (NO TOCAR):');
    ambigua.forEach(d => console.log(`  ${d.venta.id} | total=${d.venta.total} | estado=${d.venta.estado} | notas=${d.venta.notas || ''}`));
  }

  // ── Impacto en stock ─────────────────────────────────────────────
  console.log('\n' + '─'.repeat(70));
  console.log('IMPACTO EN STOCK (movimientos de ventas demo)');
  console.log('─'.repeat(70));

  const stockImpact = new Map();
  for (const d of demo) {
    for (const m of d.movimientos) {
      if (m.tipo === 'venta') {
        const prev = stockImpact.get(m.producto_id) || { cantidad: 0, movimientos: [] };
        prev.cantidad += m.cantidad;
        prev.movimientos.push(m.id);
        stockImpact.set(m.producto_id, prev);
      }
    }
  }

  if (stockImpact.size > 0) {
    for (const [prodId, info] of stockImpact) {
      // Obtener producto y stock actual
      const { data: prod } = await supabase
        .from('productos')
        .select('id, nombre, stock')
        .eq('id', prodId)
        .maybeSingle();
      console.log(`  ${prod?.nombre || prodId}: stock_actual=${prod?.stock} | descontado_en_demo=${info.cantidad} | stock_restaurado=${(prod?.stock || 0) + info.cantidad} | mov_ids=${info.movimientos.join(',')}`);
    }
  } else {
    console.log('  Sin movimientos de stock en ventas demo.');
  }

  // ── Sesiones demo ────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(70));
  console.log('SESIONES VINCULADAS A VENTAS DEMO');
  console.log('─'.repeat(70));

  const sesionesDemo = new Set();
  for (const d of demo) {
    if (d.venta.sesion_id) sesionesDemo.add(d.venta.sesion_id);
  }

  if (sesionesDemo.size > 0) {
    for (const sid of sesionesDemo) {
      const d = demo.find(x => x.venta.sesion_id === sid);
      if (d?.sesion) {
        console.log(`  ${sid} | ${d.sesion.estacion} | ${d.sesion.cliente} | estado=${d.sesion.estado} | finalizada=${d.sesion.finalizada}`);
      } else {
        console.log(`  ${sid} | (no encontrada en sesiones)`);
      }
    }
  } else {
    console.log('  Sin sesiones vinculadas a ventas demo.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('AUDITORÍA COMPLETADA — No se ejecutó ningún DELETE');
  console.log('='.repeat(70));

  // Logout
  await supabase.auth.signOut();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});

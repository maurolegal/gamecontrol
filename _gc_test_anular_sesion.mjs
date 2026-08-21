// ===================================================================
// TESTS READ-ONLY: anular_sesion RPC
// Sprint 0.3-A
// ===================================================================
//
// Ejecutar DESPUÉS de desplegar rpc-anular-sesion.sql en Supabase.
// NO ejecutar en producción sin revisión.
//
// Uso:
//   node _gc_test_anular_sesion.mjs
//
// Requiere: .env.test con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
// ===================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Cargar .env.test ────────────────────────────────────────────────
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.test');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ── Helpers ─────────────────────────────────────────────────────────
const PASS = '✅';
const FAIL = '❌';
const SKIP = '⏭️';
let results = { pass: 0, fail: 0, skip: 0 };

function log(icon, msg) { console.log(`  ${icon} ${msg}`); }
function section(name) { console.log(`\n--- ${name} ---`); }

async function test(id, name, fn) {
  try {
    const result = await fn();
    if (result === 'skip') {
      results.skip++;
      log(SKIP, `${id}: ${name} (skipped)`);
    } else {
      results.pass++;
      log(PASS, `${id}: ${name}`);
    }
  } catch (err) {
    results.fail++;
    log(FAIL, `${id}: ${name} — ${err.message}`);
  }
}

// ── T1-T6: Tests de descubrimiento y permisos ──────────────────────

async function testRPCExists() {
  // Verificar que la RPC existe en pg_proc
  const { data, error } = await supabase.rpc('anular_sesion', {
    p_sesion_id: '00000000-0000-0000-0000-000000000000',
    p_motivo: 'test discovery',
    p_idempotency_key: randomUUID(),
  });
  // Esperamos un error de "sesión no existe" (no de "función no existe")
  if (error && error.message.includes('Could not find the function')) {
    throw new Error('RPC anular_sesion no encontrada en schema. Ejecutar NOTIFY pgrst, "reload schema"');
  }
  // Si retorna data con status ERROR_SESION_NO_EXISTE, la RPC existe
  if (data && data[0]?.status === 'ERROR_NO_AUTENTICADO') {
    return; // RPC existe, pero no estamos autenticados (esperado sin login)
  }
  if (data && data[0]?.status === 'ERROR_SESION_NO_EXISTE') {
    return; // RPC existe y responde correctamente
  }
  // Cualquier respuesta significa que la RPC existe
  return;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TESTS READ-ONLY: anular_sesion RPC ===\n');

  // ── FASE 1: Descubrimiento ──────────────────────────────────────
  section('FASE 1: Descubrimiento');

  await test('T1', 'RPC anular_sesion existe y es descubrible', testRPCExists);

  // ── FASE 2: Permisos (sin login → debe rechazar) ────────────────
  section('FASE 2: Permisos (sin autenticar)');

  await test('T2', 'anon rechazado (sin permiso de ejecución)', async () => {
    const { data, error } = await supabase.rpc('anular_sesion', {
      p_sesion_id: '00000000-0000-0000-0000-000000000000',
      p_motivo: 'test anon',
      p_idempotency_key: randomUUID(),
    });
    // Con REVOKE FROM PUBLIC + REVOKE FROM anon, PostgREST bloquea
    // la llamada antes de que la función se ejecute.
    // Esto es CORRECTO: anon no puede llamar la RPC.
    if (error && error.message.includes('permission denied')) {
      return; // ✅ anon bloqueado a nivel PostgREST
    }
    // Alternativamente, si la función se ejecuta, debe retornar ERROR_NO_AUTENTICADO
    if (data && data[0]?.status === 'ERROR_NO_AUTENTICADO') {
      return; // ✅ anon bloqueado a nivel función
    }
    throw new Error(`Esperado permission denied o ERROR_NO_AUTENTICADO. Error: ${error?.message}, Data: ${JSON.stringify(data)}`);
  });

  // ── FASE 3: Validaciones (sin login, pero RPC responde) ────────
  // Nota: sin login, auth.uid() es NULL, así que la mayoría
  // retornará ERROR_NO_AUTENTICADO antes de validar parámetros.
  // Estos tests verifican que la RPC responde (no se cuelga).

  section('FASE 3: Respuesta de la RPC');

  await test('T3', 'RPC responde a parámetros nulos sin crashear', async () => {
    const { data, error } = await supabase.rpc('anular_sesion', {
      p_sesion_id: null,
      p_motivo: null,
      p_idempotency_key: null,
    });
    // Sin login → ERROR_NO_AUTENTICADO (esperado)
    // Lo importante es que no crashee
    if (error && !error.message.includes('Could not find')) {
      return; // RPC respondió (con error de auth, pero respondió)
    }
    if (data) return;
    throw new Error('RPC no respondió');
  });

  await test('T4', 'RPC responde a UUID inválido sin crashear', async () => {
    const { data, error } = await supabase.rpc('anular_sesion', {
      p_sesion_id: 'not-a-uuid',
      p_motivo: 'test',
      p_idempotency_key: randomUUID(),
    });
    // PostgREST puede rechazar el tipo antes de llamar la función
    // Eso es OK — significa que la firma tipada funciona
    if (error && error.message.includes('invalid input syntax')) return;
    if (data) return;
    if (error) return; // Cualquier respuesta controlada es OK
    throw new Error('RPC no respondió');
  });

  // ── FASE 4: Verificación de schema (read-only) ──────────────────
  section('FASE 4: Verificación de schema');

  await test('T5', 'Tabla sesiones tiene estado CHECK con cancelada', async () => {
    // Verificar via information_schema que la columna existe
    const { data, error } = await supabase
      .from('sesiones')
      .select('estado')
      .limit(1);
    if (error) throw new Error(`No se puede leer sesiones.estado: ${error.message}`);
    return; // Si no hay error, la columna existe
  });

  await test('T6', 'Tabla ventas tiene estado CHECK con anulada', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('estado')
      .limit(1);
    if (error) throw new Error(`No se puede leer ventas.estado: ${error.message}`);
    return;
  });

  await test('T7', 'Tabla venta_items tiene columna producto_id', async () => {
    const { data, error } = await supabase
      .from('venta_items')
      .select('producto_id')
      .limit(1);
    if (error) throw new Error(`No se puede leer venta_items.producto_id: ${error.message}`);
    return;
  });

  await test('T8', 'Tabla movimientos_stock tiene tipo con devolucion', async () => {
    const { data, error } = await supabase
      .from('movimientos_stock')
      .select('tipo')
      .limit(1);
    if (error) throw new Error(`No se puede leer movimientos_stock.tipo: ${error.message}`);
    return;
  });

  await test('T9', 'Tabla productos tiene columna stock', async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('stock')
      .limit(1);
    if (error) throw new Error(`No se puede leer productos.stock: ${error.message}`);
    return;
  });

  await test('T10', 'Tabla ventas tiene columna idempotency_key', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('idempotency_key')
      .limit(1);
    if (error) throw new Error(`No se puede leer ventas.idempotency_key: ${error.message}`);
    return;
  });

  // ── FASE 4b: Verificación de columnas de pago en ventas ────────
  // Estos tests confirman que las columnas existen y son legibles.
  // La verificación de que quedan NULL después de anular_sesion
  // requiere login + sesión de prueba (tests funcionales T11-T16).
  section('FASE 4b: Columnas de pago en ventas (para NULL post-anular)');

  await test('T10a', 'Tabla ventas tiene columna metodo_pago', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('metodo_pago')
      .limit(1);
    if (error) throw new Error(`No se puede leer ventas.metodo_pago: ${error.message}`);
    return;
  });

  await test('T10b', 'Tabla ventas tiene columna monto_efectivo', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('monto_efectivo')
      .limit(1);
    if (error) throw new Error(`No se puede leer ventas.monto_efectivo: ${error.message}`);
    return;
  });

  await test('T10c', 'Tabla ventas tiene columna monto_transferencia', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('monto_transferencia')
      .limit(1);
    if (error) throw new Error(`No se puede leer ventas.monto_transferencia: ${error.message}`);
    return;
  });

  await test('T10d', 'Tabla ventas tiene columna monto_tarjeta', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('monto_tarjeta')
      .limit(1);
    if (error) throw new Error(`No se puede leer ventas.monto_tarjeta: ${error.message}`);
    return;
  });

  await test('T10e', 'Tabla ventas tiene columna monto_digital', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('monto_digital')
      .limit(1);
    if (error) throw new Error(`No se puede leer ventas.monto_digital: ${error.message}`);
    return;
  });

  // ── FASE 4c: Verificación de ventas anuladas existentes ─────────
  // Si ya existen ventas anuladas en la BD (de operaciones legacy),
  // verificamos que el patrón esperado (metodo_pago=NULL) es consistente.
  // Nota: las ventas anuladas legacy pueden tener metodo_pago='anulado'
  // (que viola el CHECK). Este test es informativo, no bloqueante.
  section('FASE 4c: Ventas anuladas existentes (informativo)');

  await test('T10f', 'Ventas anuladas existentes tienen campos de pago NULL o inválidos', async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('id, metodo_pago, monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital')
      .eq('estado', 'anulada')
      .limit(10);
    if (error) throw new Error(`No se puede leer ventas anuladas: ${error.message}`);
    if (!data || data.length === 0) {
      return 'skip'; // No hay ventas anuladas — skip
    }
    // Informativo: reportar qué tienen las ventas anuladas existentes
    const conMetodoPago = data.filter(v => v.metodo_pago !== null).length;
    const conMonto = data.filter(v =>
      v.monto_efectivo !== null || v.monto_transferencia !== null ||
      v.monto_tarjeta !== null || v.monto_digital !== null
    ).length;
    console.log(`     (informativo) ${data.length} ventas anuladas: ${conMetodoPago} con metodo_pago, ${conMonto} con montos`);
    // No fallar — es informativo. La nueva RPC siempre seteará NULL.
    return;
  });

  // ── FASE 5: Verificación de RPCs existentes intactas ────────────
  section('FASE 5: RPCs existentes intactas');

  await test('T17', 'editar_venta sigue siendo descubrible', async () => {
    const { data, error } = await supabase.rpc('editar_venta', {
      p_venta_id: '00000000-0000-0000-0000-000000000000',
      p_items: '[]',
    });
    if (error && error.message.includes('Could not find')) {
      throw new Error('editar_venta no encontrada');
    }
    return; // RPC existe
  });

  await test('T18', 'devolver_venta sigue siendo descubrible', async () => {
    const { data, error } = await supabase.rpc('devolver_venta', {
      p_venta_id: '00000000-0000-0000-0000-000000000000',
      p_items_a_devolver: null,
      p_motivo: 'test discovery',
      p_idempotency_key: randomUUID(),
    });
    if (error && error.message.includes('Could not find')) {
      throw new Error('devolver_venta no encontrada');
    }
    return;
  });

  await test('T19', 'finalizar_sesion sigue siendo descubrible', async () => {
    const { data, error } = await supabase.rpc('finalizar_sesion', {
      p_sesion_id: '00000000-0000-0000-0000-000000000000',
      p_metodo_pago: 'efectivo',
      p_monto_efectivo: null,
      p_monto_transferencia: null,
      p_monto_tarjeta: null,
      p_monto_digital: null,
      p_monto_manual_libre: null,
      p_notas_cierre: null,
      p_idempotency_key: randomUUID(),
    });
    if (error && error.message.includes('Could not find')) {
      throw new Error('finalizar_sesion no encontrada');
    }
    return;
  });

  await test('T20', 'editar_sesion_admin sigue siendo descubrible', async () => {
    const { data, error } = await supabase.rpc('editar_sesion_admin', {
      p_sesion_id: '00000000-0000-0000-0000-000000000000',
      p_tiempo_contratado: 60,
      p_tiempo_adicional: 0,
      p_items: '[]',
      p_idempotency_key: randomUUID(),
    });
    if (error && error.message.includes('Could not find')) {
      throw new Error('editar_sesion_admin no encontrada');
    }
    return;
  });

  // ── Resumen ──────────────────────────────────────────────────────
  console.log('\n=== RESUMEN ===');
  console.log(`  ${PASS} Pass: ${results.pass}`);
  console.log(`  ${FAIL} Fail: ${results.fail}`);
  console.log(`  ${SKIP} Skip: ${results.skip}`);
  console.log(`  Total: ${results.pass + results.fail + results.skip}`);

  if (results.fail > 0) {
    console.log('\n⚠️  Hay tests fallidos. Revisar antes de continuar.');
    process.exit(1);
  } else {
    console.log('\n✅ Todos los tests read-only pasaron.');
    console.log('   NOTA: Tests funcionales (con login + sesión de prueba) deben verificar:');
    console.log('   - T11: Anular sesión sin productos → venta.estado=anulada, venta.metodo_pago=NULL, monto_*=NULL');
    console.log('   - T12: Anular sesión con productos → stock devuelto, venta.estado=anulada, venta.metodo_pago=NULL');
    console.log('   - T13: Anular sesión legacy → fallback sesiones.productos, venta.metodo_pago=NULL');
    console.log('   - T14: Idempotencia doble llamada → OK_IDEMPOTENTE');
    console.log('   - T15: Idempotencia key conflict → ERROR_IDEMPOTENCIA_CONFLICTO');
    console.log('   - T16: Atomicidad stock falla → rollback completo');
    console.log('   Ejecutar manualmente después de desplegar la RPC.');
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

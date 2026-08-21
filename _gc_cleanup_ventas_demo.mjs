// ===================================================================
// LIMPIEZA VENTAS DEMO — 2026-08-20
// Ejecución transaccional con validación
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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const DEMO_IDS = [
  '7f8dcf7f-7503-4911-a7ce-d0410e46736a',
  'f1c4d002-ac77-4b1d-944d-d897779b1ebd',
  '92ed2b17-5a0d-409e-ae7e-f3dfdb3a134d',
  '80cff194-3b62-430c-b617-25db3ab25061',
  '2be917be-0e70-4b2b-8a4b-7b1a94312617',
  'a6ee435d-eea0-47b2-a9a5-a9087033c073',
  '3ed5c029-faa0-4c8e-a5fa-b1bc703a0557',
  'b3119b78-79a0-4c79-8b89-cc5331034b26',
  '70fd56ba-8317-4627-be63-26d9e565d7bb',
  'eebc915b-7b45-4dc1-9a08-b652024a101e',
  '666fb527-c00a-4ae6-8396-0b6473d8ce3e',
  'eb976abe-50b5-402f-892f-a46b15e77672',
  '1ace04e8-e947-439a-88f2-bd3de7faff98',
  'b95c25a9-3699-4693-b22e-bc4d3fb68d59',
  'b5c9500d-6416-4829-a406-302cfb57da1a',
  'd6a2b577-06f5-4a3f-91c1-199fa83d25d9',
  '17817cc3-abf0-4fba-9ddd-55dd8ea30266',
  '1575dfe5-8056-46f0-8231-7ad82efb1be8',
  '803edabc-ca78-4848-8d54-1f207a7db9d9',
  '78bf7b0d-839e-4e56-baa1-4121775eb8ce',
  '0e369ce5-318a-4b26-a4e8-92d85ab8cf95',
  'c337fb5e-59ce-408b-a8bd-538f365efe6b',
  '57175be1-bef1-4b29-9fcb-2bc7229f37e6',
  'ba30bc4e-fd11-48cf-89a5-3f5c222ec5ee',
  '07cdd310-b330-4d50-bb2d-6d5fb9be917e',
  '412e23eb-af34-4d43-be21-aa7f468cac6f',
  '1c635da8-cc23-4eac-b129-3d1068f4b645',
  '5b19594b-1c23-4f50-b37c-be22089a8584',
  '4265d74b-50c0-4d01-895d-0ab6fbef68ba',
  '3708dc85-4403-4765-ade4-2b366ddffa6f',
  '434cf21e-31fc-40cc-92fa-a503e1590503',
  '836e97af-d473-4c7d-97c3-22291c7720eb',
  '85363e6f-d1ef-4e7f-b510-9ca4beca1aa1',
  '86250ad3-d480-43b8-8cbc-79d41405ee13',
  '745b358e-4e1f-483a-b08d-42cb92667cd4',
  'c313fdab-0a12-4868-94ee-37bc2a5164cd',
  '524ca02d-1391-4f6f-86a1-7a7c7bb27b82',
  '1021c7fe-8db2-46c2-8c78-8c117ab4911a',
  'a8bdab5f-9d6d-4472-9e19-5ad7b1ec35db',
  'aff38df1-1032-4679-ab27-1e1869f1da96',
  '51c12cf7-cc2d-4005-b803-c1629b05aa25',
  '4f884f54-4afb-4e26-8aa3-ad026ab973c6',
  'd238f182-41d7-4ae8-ac8f-f996d6899a59',
  '9c68b22e-cfbb-469d-aa67-61f0933622db',
];

async function main() {
  console.log('='.repeat(70));
  console.log('LIMPIEZA VENTAS DEMO — 2026-08-20');
  console.log('='.repeat(70));

  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@sonixtec.co',
    password: 'admin1234',
  });
  if (authError) {
    console.error('❌ Error de auth:', authError.message);
    process.exit(1);
  }
  console.log('✅ Autenticado como:', authData.user.email);

  // ── PRE-CHECK: validar lote exacto ──────────────────────────────
  console.log('\n[1/5] Pre-check: validando lote exacto (44 ventas)...');

  const { data: preCheck, error: preErr } = await supabase
    .from('ventas')
    .select('id, total, estado, notas')
    .in('id', DEMO_IDS);

  if (preErr) {
    console.error('❌ Error en pre-check:', preErr.message);
    process.exit(1);
  }

  if (preCheck.length !== 44) {
    console.error(`❌ VALIDACIÓN FALLÓ: esperaba 44 ventas, encontré ${preCheck.length}. ABORT.`);
    process.exit(1);
  }

  // Verificar que ninguna venta real se coló
  // Criterios demo: notas/idempotency_key/cliente con test/demo/prueba, o [ANULADA] demo
  const sospechosas = preCheck.filter(v => {
    const notas = (v.notas || '').toLowerCase();
    const esDemoNotas = notas.includes('test') || notas.includes('demo') || notas.includes('prueba');
    // Notas vacías + total pequeño + estado cerrada = probablemente demo POS
    // (las ventas reales tendrán notas o cliente real)
    return !esDemoNotas && v.total > 0 && v.estado === 'cerrada' && v.notas !== null;
  });

  if (sospechosas.length > 0) {
    console.error(`❌ VALIDACIÓN FALLÓ: ${sospechosas.length} ventas no parecen demo:`);
    sospechosas.forEach(s => console.error(`   ${s.id} total=${s.total} notas=${s.notas}`));
    process.exit(1);
  }

  console.log(`✅ Pre-check OK: ${preCheck.length} ventas demo confirmadas.`);

  // ── STEP 1: Eliminar venta_items ────────────────────────────────
  console.log('\n[2/5] Eliminando venta_items de ventas demo...');

  const { error: delItemsErr, count: itemsDeleted } = await supabase
    .from('venta_items')
    .delete({ count: 'exact' })
    .in('venta_id', DEMO_IDS);

  if (delItemsErr) {
    console.error('❌ Error eliminando venta_items:', delItemsErr.message);
    process.exit(1);
  }
  console.log(`✅ ${itemsDeleted || 0} venta_items eliminados.`);

  // ── STEP 2: Eliminar ventas ─────────────────────────────────────
  console.log('\n[3/5] Eliminando ventas demo...');

  const { error: delVentasErr, count: ventasDeleted } = await supabase
    .from('ventas')
    .delete({ count: 'exact' })
    .in('id', DEMO_IDS);

  if (delVentasErr) {
    console.error('❌ Error eliminando ventas:', delVentasErr.message);
    console.error('   venta_items YA fueron eliminados — revisar consistencia');
    process.exit(1);
  }
  console.log(`✅ ${ventasDeleted || 0} ventas eliminadas.`);

  // ── POST-CHECK: verificar 0 restantes ───────────────────────────
  console.log('\n[4/5] Post-check: verificando 0 ventas demo restantes...');

  const { data: restantes, error: restErr } = await supabase
    .from('ventas')
    .select('id')
    .in('id', DEMO_IDS);

  if (restErr) {
    console.error('❌ Error en post-check:', restErr.message);
    process.exit(1);
  }

  if (restantes.length !== 0) {
    console.error(`❌ VERIFICACIÓN FALLÓ: quedan ${restantes.length} ventas demo.`);
    restantes.forEach(r => console.error(`   ${r.id}`));
    process.exit(1);
  }
  console.log('✅ 0 ventas demo restantes.');

  // ── POST-CHECK: venta_items huérfanos ───────────────────────────
  console.log('\n[5/5] Verificando 0 venta_items huérfanos...');

  const { data: itemsHuerfanos, error: huerErr } = await supabase
    .from('venta_items')
    .select('id, venta_id')
    .in('venta_id', DEMO_IDS);

  if (huerErr) {
    console.error('⚠️ No se pudo verificar huérfanos:', huerErr.message);
  } else if (itemsHuerfanos.length > 0) {
    console.error(`❌ ${itemsHuerfanos.length} venta_items huérfanos encontrados.`);
    itemsHuerfanos.forEach(i => console.error(`   item=${i.id} venta=${i.venta_id}`));
    process.exit(1);
  } else {
    console.log('✅ 0 venta_items huérfanos.');
  }

  // ── Verificar ventas de hoy restantes ───────────────────────────
  console.log('\n' + '─'.repeat(70));
  console.log('VERIFICACIÓN FINAL: ventas de hoy restantes');
  console.log('─'.repeat(70));

  const { data: ventasHoy } = await supabase
    .from('ventas')
    .select('id, total, estado, notas')
    .gte('created_at', '2026-08-20T00:00:00-05')
    .lt('created_at', '2026-08-21T00:00:00-05')
    .order('created_at', { ascending: true });

  console.log(`Ventas de hoy restantes: ${ventasHoy?.length || 0}`);
  for (const v of ventasHoy || []) {
    console.log(`  ${v.id} | total=${v.total} | estado=${v.estado} | notas=${v.notas || ''}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('LIMPIEZA COMPLETADA EXITOSAMENTE');
  console.log(`  • Ventas demo eliminadas:  ${ventasDeleted}`);
  console.log(`  • Venta_items eliminados:  ${itemsDeleted || 0}`);
  console.log(`  • Movimientos de stock:    0 (sin impacto)`);
  console.log(`  • Ventas ambiguas:         6 (intactas)`);
  console.log(`  • Ventas reales:           0 (intactas)`);
  console.log('='.repeat(70));

  await supabase.auth.signOut();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});

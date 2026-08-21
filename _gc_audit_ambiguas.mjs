// ===================================================================
// AUDITORÍA DETALLADA — Ventas AMBIGUAS de hoy
// Read-only: consulta detalle completo de las 6 ambiguas
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

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'admin@sonixtec.co',
    password: 'admin1234',
  });
  console.log('✅ Auth:', authData.user.email);

  const ambiguas = [
    '5e27df75-a046-4e34-8b67-8905f184cb6a',
    '99d21e41-e21b-4643-bb6b-ff3b06b28abc',
    '0f8b031c-cb33-4794-9634-37aa7ee19fec',
    'e02fe995-2d4f-45b8-939f-af23f36a63e3',
    '0071e16d-f97e-43dd-9343-174d065cf00c',
    'da7b9ce4-82bd-4332-a68d-50ae81153004',
  ];

  for (const vid of ambiguas) {
    console.log('\n' + '─'.repeat(70));

    // Venta completa
    const { data: v } = await supabase.from('ventas').select('*').eq('id', vid).maybeSingle();
    console.log(`VENTA #${vid}`);
    console.log(`  created_at:     ${v.created_at}`);
    console.log(`  estado:         ${v.estado}`);
    console.log(`  sesion_id:      ${v.sesion_id || 'NULL'}`);
    console.log(`  estacion:       ${v.estacion || 'N/A'}`);
    console.log(`  cliente:        ${v.cliente || 'N/A'}`);
    console.log(`  total:          ${v.total}`);
    console.log(`  metodo_pago:    ${v.metodo_pago}`);
    console.log(`  notas:          ${v.notas}`);
    console.log(`  idempotency_key: ${v.idempotency_key || 'NULL'}`);

    // Items
    const { data: items } = await supabase.from('venta_items').select('*').eq('venta_id', vid);
    console.log(`  venta_items:    ${items?.length || 0}`);
    for (const item of items || []) {
      console.log(`    - ${item.descripcion} ×${item.cantidad} = ${item.subtotal} (${item.tipo})`);
    }

    // Sesión
    if (v.sesion_id) {
      const { data: s } = await supabase.from('sesiones').select('*').eq('id', v.sesion_id).maybeSingle();
      if (s) {
        console.log(`  sesión: ${s.estacion} | ${s.cliente} | estado=${s.estado} | finalizada=${s.finalizada}`);
        console.log(`    fecha_inicio: ${s.fecha_inicio}`);
        console.log(`    fecha_fin:    ${s.fecha_fin}`);
        console.log(`    tiempo_contratado: ${s.tiempo_contratado}`);
        console.log(`    tarifa_base:       ${s.tarifa_base}`);
        console.log(`    total_general:     ${s.total_general}`);
        console.log(`    productos:         ${JSON.stringify(s.productos)}`);
        console.log(`    notas:             ${s.notas}`);
      }
    }

    // Movimientos de stock
    if (v.sesion_id) {
      const { data: movs } = await supabase.from('movimientos_stock').select('*').eq('referencia', v.sesion_id);
      console.log(`  movimientos_stock: ${movs?.length || 0}`);
      for (const m of movs || []) {
        console.log(`    - ${m.tipo} cant=${m.cantidad} stock ${m.stock_anterior}→${m.stock_nuevo} motivo=${m.motivo}`);
      }
    }
  }

  await supabase.auth.signOut();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

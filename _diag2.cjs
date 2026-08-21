const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://stjbtxrrdofuxhigxfcy.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0amJ0eHJyZG9mdXhoaWd4ZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTgwNzUsImV4cCI6MjA3NzM5NDA3NX0.vhz6v2pRepUH7g-ucSJKtWonmAeWYqwhrTxG_ypVElo');
(async () => {
  const {data} = await sb.from('movimientos_stock').select('fecha_movimiento,tipo,cantidad,producto_id,sesion_id,stock_anterior,stock_nuevo').gte('fecha_movimiento','2026-04-07T00:00:00').order('fecha_movimiento',{ascending:false}).limit(30);
  if (!data || data.length===0) { console.log('Sin movimientos hoy'); return; }
  data.forEach(m=>console.log(m.fecha_movimiento.slice(0,19),m.tipo,'cant:'+m.cantidad,m.producto_id.slice(-8),'stock:'+m.stock_anterior+'->'+m.stock_nuevo,'sesion:'+(m.sesion_id||'null').slice(-8)));
})();

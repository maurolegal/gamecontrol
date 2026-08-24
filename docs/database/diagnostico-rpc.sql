-- Verificar si el RPC finalizar_sesion tiene el código actualizado
-- Específicamente, verificar si tiene la línea que crea el item de tiempo
-- y si está usando tarifa_base correctamente

SELECT 
  CASE 
    WHEN prosrc LIKE '%v_tarifa_tiempo > 0%' THEN 'TIENE condicion v_tarifa_tiempo > 0'
    ELSE 'NO tiene condicion v_tarifa_tiempo > 0'
  END as tiene_condicion_tiempo,
  CASE
    WHEN prosrc LIKE '%v_es_libre%TIEMPO_LIBRE%' THEN 'Detecta modo libre correctamente'
    ELSE 'NO detecta modo libre'
  END as detecta_libre,
  CASE
    WHEN prosrc LIKE '%p_monto_manual_libre%' THEN 'Acepta monto manual libre'
    ELSE 'NO acepta monto manual libre'
  END as acepta_monto_libre
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' AND p.proname = 'finalizar_sesion';

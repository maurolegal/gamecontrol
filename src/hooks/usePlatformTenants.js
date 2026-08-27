import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function usePlatformTenants(enabled = false) {
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [modules, setModules] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!enabled) return;
    setCargando(true);
    setError(null);
    const [{ data: tenantData, error: tenantError }, { data: planData, error: planError }, { data: moduleData, error: moduleError }] = await Promise.all([
      supabase.rpc('platform_list_tenants_console'),
      supabase.rpc('platform_list_plans'),
      supabase.rpc('platform_list_modules'),
    ]);
    const requestError = tenantError || planError || moduleError;
    if (requestError) setError(requestError.message);
    else {
      setTenants(tenantData?.tenants ?? []);
      setPlans(planData?.plans ?? []);
      setModules(moduleData?.modules ?? []);
    }
    setCargando(false);
  }, [enabled]);

  const cambiarEstado = useCallback(async (tenantId, status) => {
    const { data, error: requestError } = await supabase.rpc('platform_set_tenant_status', {
      p_tenant_id: tenantId,
      p_status: status,
    });
    if (requestError) throw requestError;
    if (!data?.success) throw new Error(data?.error || 'No se pudo actualizar el tenant');
    await cargar();
  }, [cargar]);

  const provisionar = useCallback(async (payload) => {
    const { data, error: requestError } = await supabase.functions.invoke('platform-provision-tenant', {
      body: { ...payload, idempotency_key: payload.idempotency_key ?? crypto.randomUUID() },
    });
    if (requestError) throw requestError;
    if (!data?.success) throw new Error(data?.error || 'No se pudo crear el tenant');
    await cargar();
    return data;
  }, [cargar]);

  useEffect(() => { cargar(); }, [cargar]);

  return { tenants, plans, modules, cargando, error, cargar, cambiarEstado, provisionar };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function usePlatformTenants(enabled = false) {
  const [tenants, setTenants] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!enabled) return;
    setCargando(true);
    setError(null);
    const { data, error: requestError } = await supabase.rpc('platform_list_tenants');
    if (requestError) setError(requestError.message);
    else setTenants(data ?? []);
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

  useEffect(() => { cargar(); }, [cargar]);

  return { tenants, cargando, error, cargar, cambiarEstado };
}

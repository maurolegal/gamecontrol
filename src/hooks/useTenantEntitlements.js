import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useTenantEntitlements() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('tenant_subscription');
      if (error) throw error;
      setSubscription(data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const hasModule = useCallback(async (moduleCode) => {
    const { data, error } = await supabase.rpc('tenant_has_module', { p_module_code: moduleCode });
    if (error) throw error;
    return data === true;
  }, []);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  return { subscription, loading, refresh, hasModule };
}

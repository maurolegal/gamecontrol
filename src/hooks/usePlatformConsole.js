import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

async function invoke(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  if (data?.success === false) throw new Error(data.error || 'No se pudo completar la operación');
  return data;
}

export function usePlatformConsole() {
  const [summary, setSummary] = useState(null);
  const [plans, setPlans] = useState([]);
  const [modules, setModules] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [adminCandidates, setAdminCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, planData, moduleData] = await Promise.all([
        invoke('platform_console_summary'),
        invoke('platform_list_plans'),
        invoke('platform_list_modules'),
      ]);
      setSummary(summaryData);
      setPlans(planData?.plans ?? []);
      setModules(moduleData?.modules ?? []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdmins = useCallback(async () => {
    const [adminData, candidateData] = await Promise.all([
      invoke('platform_list_admins'),
      invoke('platform_list_admin_candidates'),
    ]);
    setAdmins(adminData?.admins ?? []);
    setAdminCandidates(candidateData?.users ?? []);
  }, []);

  const setPlatformAdmin = useCallback(async (userId, enabled) => {
    await invoke('platform_set_platform_admin', { p_user_id: userId, p_enabled: enabled });
    await loadAdmins();
  }, [loadAdmins]);

  useEffect(() => { load(); }, [load]);

  return { summary, plans, modules, admins, adminCandidates, loading, error, load, loadAdmins, setPlatformAdmin };
}

export { invoke as platformRpc };

import { Users, UserCheck, Activity, Lock } from 'lucide-react';

function KpiCard({ icon, cls, titulo, valor, cargando }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className={`inline-flex p-2.5 rounded-xl mb-3 ${cls}`}>{icon}</div>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{titulo}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
        {cargando ? <span className="animate-pulse text-gray-300">—</span> : valor}
      </p>
    </div>
  );
}

export default function KpiUsuarios({ kpis, cargando }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard titulo="Total Usuarios"     valor={kpis.total}      icon={<Users size={20}/>}      cls="bg-blue-500/10 text-blue-500"    cargando={cargando} />
      <KpiCard titulo="Usuarios Activos"   valor={kpis.activos}    icon={<UserCheck size={20}/>}  cls="bg-emerald-500/10 text-emerald-500" cargando={cargando} />
      <KpiCard titulo="Sesiones Activas"   valor={kpis.sesiones}   icon={<Activity size={20}/>}   cls="bg-amber-500/10 text-amber-500"   cargando={cargando} />
      <KpiCard titulo="Cuentas Bloqueadas" valor={kpis.bloqueados} icon={<Lock size={20}/>}       cls="bg-red-500/10 text-red-500"       cargando={cargando} />
    </div>
  );
}

// ===================================================================
// PÁGINA: Ajustes – Design System GameControl
// Header compacto · Tabs discretos · Tarifas unificadas · Footer sticky
// ===================================================================

import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import * as db from '../lib/databaseService';
import useGameStore from '../store/useGameStore';
import { useNotifications } from '../hooks/useNotifications';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { useSalas } from '../hooks/useSalas';
import { getUsuarioIdSimple } from '../lib/authHelpers';
import {
  Settings, Building2, DollarSign, Save, TrendingDown, Award,
  Gamepad2, Lightbulb, Wallet, Trash2, Plus, Smartphone, CreditCard, QrCode, Upload, X,
} from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor || 0);
}

function calcularMetricas(t30, t60, t90, t120) {
  const precioPorMin30 = t30 > 0 ? t30 / 30 : 0;
  const precioPorMin60 = t60 > 0 ? t60 / 60 : 0;
  const precioPorMin90 = t90 > 0 ? t90 / 90 : 0;
  const precioPorMin120 = t120 > 0 ? t120 / 120 : 0;

  const descuento60 = t30 > 0 && t60 > 0 ? ((1 - (precioPorMin60 / precioPorMin30)) * 100) : 0;
  const descuento90 = t30 > 0 && t90 > 0 ? ((1 - (precioPorMin90 / precioPorMin30)) * 100) : 0;
  const descuento120 = t30 > 0 && t120 > 0 ? ((1 - (precioPorMin120 / precioPorMin30)) * 100) : 0;

  return {
    preciosPorMin: { t30: precioPorMin30, t60: precioPorMin60, t90: precioPorMin90, t120: precioPorMin120 },
    descuentos: { d60: descuento60, d90: descuento90, d120: descuento120 },
  };
}

// ── Datos de las 4 opciones de tarifa ──
const OPCIONES_TARIFA = [
  { min: '30',  label: '30 min',     desc: 'Sesión rápida' },
  { min: '60',  label: '1 hora',     desc: 'Más vendida',   badge: 'popular' },
  { min: '90',  label: '1.5 horas',  desc: 'Extendida' },
  { min: '120', label: '2 horas',    desc: 'Mejor valor',   badge: 'mejor' },
];

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm ' +
  'placeholder-gray-600 focus:outline-none focus:border-[#00D656]/50 transition-colors';
const labelCls = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1';

export default function Ajustes() {
  const { configuracion, setConfiguracion } = useGameStore();
  const { salas, actualizarTarifasSala } = useSalas();
  const { exito, error: notifError } = useNotifications();
  const { confirm } = useConfirm();
  const location = useLocation();

  const [form, setForm] = useState({ nombre_negocio: '', moneda: 'COP' });
  const [tarifasPorSala, setTarifasPorSala] = useState({});
  const [tarifasOriginales, setTarifasOriginales] = useState({}); // para detectar cambios
  const [cargando, setCargando] = useState(false);
  const [cargandoTarifas, setCargandoTarifas] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState('general');

  const [mediosPago, setMediosPago] = useState([]);
  const [nuevaCuenta, setNuevaCuenta] = useState({
    banco: '', tipo: 'ahorros', numero: '', titular: '', saldo_inicial: '',
  });
  const [cargandoMedios, setCargandoMedios] = useState(false);

  // QR image
  const [qrImagenUrl, setQrImagenUrl] = useState(null);
  const [cargandoQr, setCargandoQr] = useState(false);

  // Detectar si vienen desde Salas para abrir tarifas
  useEffect(() => {
    if (location.state?.seccion === 'tarifas') setSeccionActiva('tarifas');
  }, [location]);

  // Cargar medios de pago
  useEffect(() => {
    async function cargarMediosPago() {
      try {
        const data = await db.select('medios_pago', { orderBy: 'created_at' });
        setMediosPago(data || []);
      } catch (err) {
        console.error('Error cargando medios de pago:', err);
      }
    }
    cargarMediosPago();
  }, []);

  // Cargar configuración
  useEffect(() => {
    async function cargar() {
      try {
        const data = await db.select('configuracion', { limite: 1 });
        if (data?.[0]?.datos) {
          setConfiguracion(data[0].datos);
          setForm((prev) => ({ ...prev, ...data[0].datos }));
          // Cargar URL del QR si existe
          if (data[0].datos.qr_imagen_url) {
            setQrImagenUrl(data[0].datos.qr_imagen_url);
          }
        }
      } catch (_) {}
    }
    cargar();
  }, [setConfiguracion]);

  // Cargar tarifas existentes + guardar originales para detectar cambios
  useEffect(() => {
    if (salas.length > 0) {
      const inicial = {};
      salas.forEach((sala) => {
        inicial[sala.id] = {
          t30: sala.tarifas?.t30 || 0,
          t60: sala.tarifas?.t60 || 0,
          t90: sala.tarifas?.t90 || 0,
          t120: sala.tarifas?.t120 || 0,
        };
      });
      setTarifasPorSala(inicial);
      setTarifasOriginales(JSON.parse(JSON.stringify(inicial)));
    }
  }, [salas]);

  // Detectar si hay cambios sin guardar en tarifas
  const hayCambiosTarifas = useMemo(() => {
    return Object.keys(tarifasPorSala).some((salaId) => {
      const actual = tarifasPorSala[salaId];
      const original = tarifasOriginales[salaId];
      if (!original) return true;
      return ['t30', 't60', 't90', 't120'].some(
        (k) => Number(actual[k] || 0) !== Number(original[k] || 0)
      );
    });
  }, [tarifasPorSala, tarifasOriginales]);

  // ── Handlers ──
  async function handleSubmit(e) {
    e.preventDefault();
    setCargando(true);
    try {
      const updated_by = await getUsuarioIdSimple();
      const nuevaConfig = { ...configuracion, ...form };
      const existente = await db.select('configuracion', { limite: 1 }).catch(() => []);
      if (existente?.[0]?.id) {
        await db.update('configuracion', existente[0].id, {
          datos: nuevaConfig, updated_at: new Date().toISOString(), updated_by,
        });
      } else {
        await db.insert('configuracion', {
          id: 1, datos: nuevaConfig, updated_at: new Date().toISOString(), updated_by,
        });
      }
      setConfiguracion(nuevaConfig);
      exito('Configuración guardada');
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const handleTarifaChange = (salaId, tiempo, valor) => {
    setTarifasPorSala((prev) => ({
      ...prev,
      [salaId]: { ...prev[salaId], [tiempo]: Number(valor) || 0 },
    }));
  };

  const handleSubmitTarifas = async (e) => {
    if (e) e.preventDefault();
    setCargandoTarifas(true);
    try {
      for (const [salaId, tarifas] of Object.entries(tarifasPorSala)) {
        await actualizarTarifasSala(salaId, tarifas);
      }
      setTarifasOriginales(JSON.parse(JSON.stringify(tarifasPorSala)));
      exito('Tarifas actualizadas correctamente');
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargandoTarifas(false);
    }
  };

  const handleAgregarMedioPago = async (e) => {
    e.preventDefault();
    if (!nuevaCuenta.banco.trim() || !nuevaCuenta.numero.trim() || !nuevaCuenta.titular.trim()) {
      notifError('Por favor completa todos los campos obligatorios');
      return;
    }
    setCargandoMedios(true);
    try {
      const datosCuenta = {
        banco: nuevaCuenta.banco.trim(),
        tipo: nuevaCuenta.tipo,
        numero: nuevaCuenta.numero.trim(),
        titular: nuevaCuenta.titular.trim(),
        saldo_inicial: nuevaCuenta.saldo_inicial ? Number(nuevaCuenta.saldo_inicial) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const insertado = await db.insert('medios_pago', datosCuenta);
      setMediosPago([...mediosPago, { ...datosCuenta, id: insertado.id }]);
      setNuevaCuenta({ banco: '', tipo: 'ahorros', numero: '', titular: '', saldo_inicial: '' });
      exito('Medio de pago agregado correctamente');
    } catch (err) {
      notifError('Error al agregar medio de pago: ' + err.message);
    } finally {
      setCargandoMedios(false);
    }
  };

  const handleEliminarMedioPago = async (id) => {
    const ok = await confirm('¿Estás seguro de eliminar este medio de pago?', { tipo: 'danger', confirmText: 'Eliminar' });
    if (!ok) return;
    try {
      await db.remove('medios_pago', id);
      setMediosPago(mediosPago.filter(m => m.id !== id));
      exito('Medio de pago eliminado');
    } catch (err) {
      notifError('Error al eliminar: ' + err.message);
    }
  };

  // ── QR image upload (Cloudinary) ──
  const CLOUDINARY_QR = {
    cloudName: 'dftbhxwaa',
    uploadPreset: 'gamehub',
    folder: 'qr-pagos',
  };

  const handleSubirQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifError('La imagen no puede superar 2MB');
      return;
    }
    setCargandoQr(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLOUDINARY_QR.uploadPreset);
      fd.append('folder', CLOUDINARY_QR.folder);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_QR.cloudName}/image/upload`,
        { method: 'POST', body: fd },
      );
      if (!res.ok) throw new Error('Error subiendo imagen QR');
      const data = await res.json();
      const url = data.secure_url;

      // Guardar URL en configuración
      const nuevaConfig = { ...configuracion, qr_imagen_url: url };
      const existente = await db.select('configuracion', { limite: 1 }).catch(() => []);
      const updated_by = await getUsuarioIdSimple();
      if (existente?.[0]?.id) {
        await db.update('configuracion', existente[0].id, {
          datos: nuevaConfig, updated_at: new Date().toISOString(), updated_by,
        });
      } else {
        await db.insert('configuracion', {
          id: 1, datos: nuevaConfig, updated_at: new Date().toISOString(), updated_by,
        });
      }
      setConfiguracion(nuevaConfig);
      setQrImagenUrl(url);
      exito('Imagen QR guardada correctamente');
    } catch (err) {
      notifError('Error al subir QR: ' + err.message);
    } finally {
      setCargandoQr(false);
    }
  };

  const handleEliminarQr = async () => {
    const ok = await confirm('¿Eliminar la imagen QR?', { tipo: 'danger', confirmText: 'Eliminar' });
    if (!ok) return;
    try {
      const nuevaConfig = { ...configuracion };
      delete nuevaConfig.qr_imagen_url;
      const existente = await db.select('configuracion', { limite: 1 }).catch(() => []);
      const updated_by = await getUsuarioIdSimple();
      if (existente?.[0]?.id) {
        await db.update('configuracion', existente[0].id, {
          datos: nuevaConfig, updated_at: new Date().toISOString(), updated_by,
        });
      }
      setConfiguracion(nuevaConfig);
      setQrImagenUrl(null);
      exito('Imagen QR eliminada');
    } catch (err) {
      notifError('Error al eliminar QR: ' + err.message);
    }
  };

  const TABS = [
    { id: 'general',    label: 'General',       icon: <Building2 size={14} /> },
    { id: 'tarifas',    label: 'Tarifas',       icon: <DollarSign size={14} />, count: salas.length },
    { id: 'medios-pago', label: 'Medios de Pago', icon: <Wallet size={14} />, count: mediosPago.length },
  ];

  return (
    <div
      className="flex flex-col -m-3 md:-m-6 min-h-[calc(100vh-0px)]"
      style={{ background: '#070A0F', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}
    >
      {/* ── HEADER compacto ── */}
      <header
        className="relative z-40 px-4 py-2.5"
        style={{
          background: 'rgba(10,14,25,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="shrink-0">
            <h1 className="font-black text-white text-sm leading-tight tracking-tight">GameControl</h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-tight">Configuración</p>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ── */}
      <main className="flex-1 px-4 py-4 space-y-4 pb-28">
        {/* Título + subtítulo (no card) */}
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Configuración</h2>
          <p className="text-xs text-gray-500 mt-0.5">Gestiona las reglas operativas de GameControl</p>
        </div>

        {/* ── Tabs discretos ── */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl w-fit"
          style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSeccionActiva(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                seccionActiva === tab.id
                  ? 'bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              aria-pressed={seccionActiva === tab.id}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className="text-[10px] tabular-nums opacity-70">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN: GENERAL
            ═══════════════════════════════════════════════════════════════ */}
        {seccionActiva === 'general' && (
          <div className="max-w-xl">
            <form
              onSubmit={handleSubmit}
              className="rounded-xl p-5 space-y-4"
              style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 size={15} className="text-gray-500" />
                Información del Negocio
              </h3>

              <div>
                <label className={labelCls}>Nombre del negocio</label>
                <input
                  value={form.nombre_negocio ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, nombre_negocio: e.target.value }))}
                  placeholder="Ej: GameZone"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Moneda</label>
                <select
                  value={form.moneda ?? 'COP'}
                  onChange={(e) => setForm((p) => ({ ...p, moneda: e.target.value }))}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="COP">Peso Colombiano (COP)</option>
                  <option value="USD">Dólar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="MXN">Peso Mexicano (MXN)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#00D656', color: '#000' }}
              >
                <Save size={15} />
                {cargando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN: TARIFAS
            ═══════════════════════════════════════════════════════════════ */}
        {seccionActiva === 'tarifas' && (
          <div className="space-y-4">
            {/* Callout compacto — estrategia de precios */}
            <div
              className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <Lightbulb size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-amber-400">Estrategia de precios</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                  Las tarifas de mayor duración ofrecen mejor precio/minuto para incentivar sesiones prolongadas.
                  Las de 2 horas se usan como base para sesiones de tiempo libre.
                </p>
              </div>
            </div>

            {salas.length === 0 ? (
              <div
                className="rounded-xl p-12 text-center"
                style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Gamepad2 size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-400 text-sm font-medium">No hay salas configuradas</p>
                <p className="text-gray-600 text-xs mt-1">Crea una sala en la sección de Salas primero</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitTarifas} className="space-y-4">
                {/* Tarjetas de salas — sistema unificado */}
                <div className="space-y-4">
                  {salas.map((sala) => {
                    const tarifas = tarifasPorSala[sala.id] || {};
                    const metricas = calcularMetricas(tarifas.t30, tarifas.t60, tarifas.t90, tarifas.t120);

                    return (
                      <div
                        key={sala.id}
                        className="rounded-xl overflow-hidden"
                        style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        {/* Header de sala */}
                        <div
                          className="flex items-center justify-between px-4 py-3"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div className="flex items-center gap-2">
                            <Gamepad2 size={15} className="text-gray-500" />
                            <h4 className="text-sm font-bold text-white">{sala.nombre}</h4>
                            <span
                              className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8B919C' }}
                            >
                              {sala.tipo}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 tabular-nums">
                            {sala.numEstaciones || 0} estaciones
                          </span>
                        </div>

                        {/* Grid de tarifas — sistema unificado, no cards independientes */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0"
                          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                        >
                          {OPCIONES_TARIFA.map(({ min, label, desc, badge }) => {
                            const valor = tarifas[`t${min}`] || 0;
                            const precioPorMin = metricas.preciosPorMin[`t${min}`];
                            const descuento = min !== '30' ? metricas.descuentos[`d${min}`] : 0;

                            return (
                              <div
                                key={min}
                                className="p-4 flex flex-col gap-2"
                                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                              >
                                {/* Label + badge */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                                    {label}
                                  </span>
                                  {badge === 'popular' && (
                                    <span
                                      className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap"
                                      style={{ background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.25)' }}
                                    >
                                      Más vendida
                                    </span>
                                  )}
                                  {badge === 'mejor' && (
                                    <span
                                      className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap flex items-center gap-0.5"
                                      style={{ background: 'rgba(0,214,86,0.12)', color: '#00D656', border: '1px solid rgba(0,214,86,0.22)' }}
                                    >
                                      <Award size={8} /> Mejor valor
                                    </span>
                                  )}
                                </div>

                                {/* Input de precio — dato principal */}
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">$</span>
                                  <input
                                    type="number"
                                    value={valor || ''}
                                    onChange={(e) => handleTarifaChange(sala.id, `t${min}`, e.target.value)}
                                    min="0"
                                    step="500"
                                    placeholder="0"
                                    className="w-full pl-7 pr-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-lg font-bold tabular-nums focus:outline-none focus:border-[#00D656]/50 transition-colors placeholder-gray-700"
                                  />
                                </div>

                                {/* Precio/minuto */}
                                {valor > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] text-gray-500 tabular-nums">
                                      {formatCOP(precioPorMin)}<span className="text-gray-600">/min</span>
                                    </p>
                                    {descuento > 0 && (
                                      <div
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                                        style={{ background: 'rgba(0,214,86,0.08)', color: '#00D656' }}
                                      >
                                        <TrendingDown size={9} />
                                        {descuento.toFixed(0)}% más económico
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Resumen de ahorro — compacto */}
                        {tarifas.t30 > 0 && tarifas.t120 > 0 && (
                          <div
                            className="flex items-center gap-2 px-4 py-2.5"
                            style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                          >
                            <span className="text-[11px] text-gray-500">
                              Ahorro con 2h vs 4×30min:
                            </span>
                            <span className="text-[11px] font-bold text-[#00D656] tabular-nums">
                              {formatCOP((tarifas.t30 * 4) - tarifas.t120)}
                            </span>
                            <span className="text-[10px] text-gray-600">
                              · {metricas.descuentos.d120.toFixed(0)}% descuento
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </form>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN: MEDIOS DE PAGO
            ═══════════════════════════════════════════════════════════════ */}
        {seccionActiva === 'medios-pago' && (
          <div className="space-y-4 max-w-3xl">
            {/* ── Sección QR ── */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <QrCode size={15} className="text-[#00D656]" />
                  Código QR para pagos
                </h3>
                {qrImagenUrl && (
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: 'rgba(0,214,86,0.12)', color: '#00D656', border: '1px solid rgba(0,214,86,0.22)' }}
                  >
                    Configurado
                  </span>
                )}
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                Sube la imagen del código QR que recibirá el cliente al seleccionar este método de pago en el POS o al cerrar una sesión.
              </p>

              {qrImagenUrl ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Preview */}
                  <div
                    className="relative rounded-xl overflow-hidden shrink-0"
                    style={{ background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <img
                      src={qrImagenUrl}
                      alt="Código QR"
                      className="w-32 h-32 object-contain"
                    />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex gap-2">
                      <label
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-all hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF' }}
                      >
                        <Upload size={14} />
                        Cambiar imagen
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={handleSubirQr}
                          disabled={cargandoQr}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={handleEliminarQr}
                        disabled={cargandoQr}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-red-500/10"
                        style={{ border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {cargandoQr && (
                      <p className="text-[11px] text-gray-500">Subiendo…</p>
                    )}
                  </div>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl cursor-pointer transition-all hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)' }}
                >
                  {cargandoQr ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#00D656]/30 border-t-[#00D656] rounded-full animate-spin" />
                      <p className="text-[12px] text-gray-400">Subiendo imagen…</p>
                    </div>
                  ) : (
                    <>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(0,214,86,0.08)', border: '1px solid rgba(0,214,86,0.15)' }}
                      >
                        <QrCode size={22} className="text-[#00D656]" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">Subir imagen QR</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">PNG, JPG o WebP · máx 2MB</p>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleSubirQr}
                    disabled={cargandoQr}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Lista de medios existentes */}
            {mediosPago.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cuentas configuradas</h3>
                {mediosPago.map((medio) => (
                  <div
                    key={medio.id}
                    className="rounded-lg p-3.5 flex items-center justify-between gap-3 group"
                    style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {medio.banco.toLowerCase().includes('nequi') || medio.banco.toLowerCase().includes('daviplata') ? (
                          <Smartphone size={16} className="text-gray-400" />
                        ) : (
                          <Building2 size={16} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{medio.banco}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {medio.tipo.charAt(0).toUpperCase() + medio.tipo.slice(1)} · <span className="font-mono">{medio.numero}</span> · {medio.titular}
                        </p>
                        {medio.saldo_inicial != null && (
                          <p className="text-[10px] text-[#00D656] mt-0.5 tabular-nums">
                            Saldo inicial: {formatCOP(medio.saldo_inicial)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEliminarMedioPago(medio.id)}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Eliminar"
                      aria-label="Eliminar medio de pago"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario agregar cuenta */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Plus size={15} className="text-[#00D656]" />
                Agregar nueva cuenta
              </h3>

              <form onSubmit={handleAgregarMedioPago} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Banco / Billetera <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={nuevaCuenta.banco}
                      onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, banco: e.target.value })}
                      placeholder="Ej: Bancolombia, Nequi…"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Tipo <span className="text-red-400">*</span></label>
                    <select
                      value={nuevaCuenta.tipo}
                      onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, tipo: e.target.value })}
                      className={`${inputCls} cursor-pointer`}
                    >
                      <option value="ahorros">Ahorros</option>
                      <option value="corriente">Corriente</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Número de cuenta <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={nuevaCuenta.numero}
                      onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, numero: e.target.value })}
                      placeholder="Ej: 1234567890"
                      className={`${inputCls} font-mono`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Titular <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={nuevaCuenta.titular}
                      onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, titular: e.target.value })}
                      placeholder="Ej: Julio Hernández"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>
                      Saldo inicial <span className="text-gray-600 normal-case tracking-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">$</span>
                      <input
                        type="number"
                        value={nuevaCuenta.saldo_inicial}
                        onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, saldo_inicial: e.target.value })}
                        placeholder="Ej: 2500000"
                        min="0"
                        step="1000"
                        className={`${inputCls} pl-7 tabular-nums`}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={cargandoMedios}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#00D656', color: '#000' }}
                >
                  <Plus size={15} />
                  {cargandoMedios ? 'Agregando…' : 'Agregar cuenta'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer sticky — solo visible en tarifas con cambios ── */}
      {seccionActiva === 'tarifas' && salas.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 md:px-6"
          style={{
            background: hayCambiosTarifas ? 'rgba(10,14,25,0.98)' : 'transparent',
            backdropFilter: hayCambiosTarifas ? 'blur(20px)' : 'none',
            borderTop: hayCambiosTarifas ? '1px solid rgba(255,255,255,0.06)' : 'none',
            transition: 'all 0.2s ease',
            pointerEvents: hayCambiosTarifas ? 'auto' : 'none',
          }}
        >
          <div className={`flex items-center justify-between gap-3 max-w-5xl mx-auto transition-opacity ${hayCambiosTarifas ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Cambios sin guardar
            </span>
            <button
              onClick={handleSubmitTarifas}
              disabled={cargandoTarifas || !hayCambiosTarifas}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#00D656', color: '#000' }}
            >
              <Save size={14} />
              {cargandoTarifas ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

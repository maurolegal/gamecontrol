-- ===================================================================
-- TABLA: medios_pago
-- Almacena las cuentas bancarias y billeteras digitales del negocio
-- ===================================================================

CREATE TABLE IF NOT EXISTS medios_pago (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  banco TEXT NOT NULL,                    -- Nombre del banco o billetera (ej. Bancolombia, Nequi)
  tipo TEXT NOT NULL DEFAULT 'ahorros',   -- Tipo de cuenta: 'ahorros' o 'corriente'
  numero TEXT NOT NULL,                   -- Número de cuenta o teléfono
  titular TEXT NOT NULL,                  -- Nombre del titular de la cuenta
  saldo_inicial NUMERIC(12,2),            -- Saldo inicial opcional para control de gastos
  activo BOOLEAN DEFAULT TRUE,            -- Si el medio está activo o no
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_medios_pago_activo ON medios_pago(activo);
CREATE INDEX IF NOT EXISTS idx_medios_pago_banco ON medios_pago(banco);

-- Comentarios de documentación
COMMENT ON TABLE medios_pago IS 'Cuentas bancarias y billeteras digitales para gestión de pagos';
COMMENT ON COLUMN medios_pago.banco IS 'Nombre del banco o billetera digital (Bancolombia, Nequi, Daviplata, etc.)';
COMMENT ON COLUMN medios_pago.tipo IS 'Tipo de cuenta: ahorros o corriente';
COMMENT ON COLUMN medios_pago.numero IS 'Número de cuenta bancaria o número de teléfono para billeteras';
COMMENT ON COLUMN medios_pago.titular IS 'Nombre completo del titular de la cuenta';
COMMENT ON COLUMN medios_pago.saldo_inicial IS 'Saldo inicial opcional para validación de fondos en gastos';
COMMENT ON COLUMN medios_pago.activo IS 'Indica si el medio de pago está activo y disponible para uso';

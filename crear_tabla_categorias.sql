-- 1. Crear la tabla de categorías
CREATE TABLE IF NOT EXISTS public.categorias_productos (
    id text PRIMARY KEY,
    nombre text NOT NULL,
    color text DEFAULT 'primary',
    icono text DEFAULT 'fas fa-box',
    estado text DEFAULT 'activa',
    fecha_creacion timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitar seguridad nivel fila (RLS)
ALTER TABLE public.categorias_productos ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas de acceso (Permisivas para facilitar uso)
CREATE POLICY "Permitir lectura publica de categorias" 
ON public.categorias_productos FOR SELECT 
USING (true);

CREATE POLICY "Permitir insercion a autenticados" 
ON public.categorias_productos FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Permitir actualizacion a autenticados" 
ON public.categorias_productos FOR UPDATE 
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Permitir eliminacion a autenticados" 
ON public.categorias_productos FOR DELETE 
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- 4. Crear índice para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON public.categorias_productos(nombre);

# KingoStore

Tienda en línea (Next.js + TypeScript + Supabase). Arquitectura y plan: ver `../ARQUITECTURA.md` y `../PLAN_DE_TRABAJO.md`.

## Arrancar en local

```bash
npm install
npm run dev        # http://localhost:3000
```

Sin configurar Supabase, la tienda usa los datos de demostración de `src/modules/catalogo/datos-demo.ts`.

## Conectar la base de datos (Supabase)

1. Crea un proyecto en supabase.com.
2. En **SQL Editor** ejecuta, en este orden:
   1. `supabase/migrations/0001_esquema_inicial.sql`
   2. `supabase/seed.sql` (datos de demostración; se puede repetir sin duplicar)
3. Copia `.env.example` a `.env.local` y completa los valores desde *Project Settings → API*.
4. Reinicia `npm run dev`.

`.env.local` no se sube a GitHub. `SUPABASE_SERVICE_ROLE_KEY` da acceso total: solo se usa en el servidor (`src/lib/supabase/servidor.ts`).

## Estructura

```
src/app/            rutas (inicio, categoría, producto)
src/components/     piezas de interfaz
src/modules/        monolito modular: catalogo, precios, proveedores
src/lib/supabase/   clientes de Supabase (público y de servicio)
supabase/           migraciones y datos de demostración
```

Cada módulo expone su interfaz en `index.ts`; el resto de la aplicación solo importa desde ahí.

## Comprobaciones

```bash
npx tsc --noEmit && npm run lint && npm run build
```

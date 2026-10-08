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
   2. `supabase/migrations/0002_permisos_servicio.sql` (permisos del servidor)
   3. `supabase/migrations/0003_trazabilidad_y_pedidos.sql` (pedidos, historial y liquidaciones)
   4. `supabase/seed.sql` (datos de demostración; se puede repetir sin duplicar)
3. **Copia** `.env.example` a `.env.local` (sin borrar el original) y completa los valores desde *Project Settings → API*.
4. Reinicia `npm run dev`.

En `NEXT_PUBLIC_SUPABASE_URL` va solo la URL base (`https://<proyecto>.supabase.co`), sin `/rest/v1/`.

`.env.local` no se sube a GitHub. `SUPABASE_SERVICE_ROLE_KEY` da acceso total: solo se usa en el servidor (`src/lib/supabase/servidor.ts`).

## Pedidos

El checkout crea el pedido con la función `crear_pedido` de la base de datos: en una sola transacción valida disponibilidad, calcula los precios con los valores de la base (nunca los del navegador), descuenta el stock y deja historial y auditoría. Cada cambio de estado pasa por `cambiar_estado_pedido`, que valida las transiciones y devuelve el stock al cancelar. Por ahora solo hay pago contra entrega.

El cliente consulta su pedido en `/pedido/<token>` (enlace secreto, sin cuenta).

## Importar un catálogo desde CSV

```bash
npm run importar:csv -- datos/ejemplo-proveedor.csv mi-proveedor --solo-validar   # solo valida
npm run importar:csv -- datos/ejemplo-proveedor.csv mi-proveedor                   # importa
```

Los productos nuevos quedan en **borrador**; hay que revisarlos y pasarlos a `activo` para que se vean. El precio de venta sale de la regla de margen (por defecto 35 % y redondeo a 100 COP; se configura en la tabla `reglas_precio`).

## Estructura

```
src/app/            rutas (inicio, categoría, producto)
src/components/     piezas de interfaz
src/modules/        monolito modular: catalogo, carrito, envios, pedidos, precios,
                    proveedores (contrato y CSV), sincronizacion
src/lib/supabase/   clientes de Supabase (público y de servicio)
supabase/           migraciones y datos de demostración
```

Cada módulo expone su interfaz en `index.ts`; el resto de la aplicación solo importa desde ahí.

## Comprobaciones

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

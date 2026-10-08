-- KingoStore · esquema inicial
-- Ejecutar completo en Supabase: SQL Editor → New query → pegar → Run.
-- Dinero: enteros en pesos colombianos (COP), sin decimales.
-- Seguridad: RLS activado en todas las tablas. El público solo lee el catálogo
-- activo y SIN costos ni datos del proveedor. Pedidos, clientes y pagos solo se
-- tocan desde el servidor con la llave de servicio (service_role).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tipos
create type tipo_proveedor  as enum ('api', 'csv');
create type estado_producto as enum ('borrador', 'activo', 'pausado');
create type metodo_pago     as enum ('wompi', 'contra_entrega');
create type estado_pago     as enum ('pendiente', 'aprobado', 'rechazado', 'anulado', 'error');
create type estado_pedido   as enum (
  'pendiente_pago', 'por_confirmar', 'pagado', 'confirmado',
  'enviado_a_proveedor', 'despachado', 'entregado',
  'cancelado', 'devuelto', 'fallo_proveedor'
);

-- ------------------------------------------------- actualizado_en automático
create or replace function set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

-- ------------------------------------------------------------- catálogo
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  descripcion text not null default '',
  padre_id    uuid references categorias (id) on delete set null,
  orden       integer not null default 0,
  creado_en   timestamptz not null default now()
);

create table proveedores (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  nombre    text not null,
  tipo      tipo_proveedor not null,
  activo    boolean not null default true,
  -- Configuración NO secreta (URLs, parámetros). Los tokens van en variables de entorno.
  config    jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create table productos (
  id            uuid primary key default gen_random_uuid(),
  proveedor_id  uuid references proveedores (id) on delete set null,
  id_externo    text,
  slug          text not null unique,
  nombre        text not null,
  descripcion   text not null default '',
  categoria_id  uuid references categorias (id) on delete set null,
  imagenes      text[] not null default '{}',
  estado        estado_producto not null default 'borrador',
  demo          boolean not null default false,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (proveedor_id, id_externo)
);
create index productos_categoria_idx on productos (categoria_id);
create index productos_estado_idx on productos (estado);
create trigger productos_actualizado before update on productos
  for each row execute function set_actualizado_en();

create table variantes (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references productos (id) on delete cascade,
  id_externo     text,
  sku            text,
  atributos      jsonb not null default '{}'::jsonb,
  costo          integer not null default 0 check (costo >= 0),
  precio_venta   integer not null default 0 check (precio_venta >= 0),
  stock          integer not null default 0 check (stock >= 0),
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now(),
  unique (producto_id, id_externo)
);
create index variantes_producto_idx on variantes (producto_id);
create trigger variantes_actualizado before update on variantes
  for each row execute function set_actualizado_en();

create table reglas_precio (
  id           uuid primary key default gen_random_uuid(),
  alcance      text not null check (alcance in ('global', 'categoria', 'producto')),
  categoria_id uuid references categorias (id) on delete cascade,
  producto_id  uuid references productos (id) on delete cascade,
  margen_min   numeric(5, 2) not null default 30 check (margen_min >= 0),
  redondeo     integer not null default 100 check (redondeo > 0),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  check (
    (alcance = 'global'    and categoria_id is null     and producto_id is null) or
    (alcance = 'categoria' and categoria_id is not null and producto_id is null) or
    (alcance = 'producto'  and producto_id  is not null and categoria_id is null)
  )
);

-- ------------------------------------------------------- clientes y pedidos
create table clientes (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  telefono             text not null,
  correo               text,
  consentimiento_datos boolean not null default false,
  consentimiento_en    timestamptz,
  creado_en            timestamptz not null default now()
);

create table direcciones (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes (id) on delete cascade,
  departamento text not null,
  ciudad       text not null,
  direccion    text not null,
  notas        text,
  creado_en    timestamptz not null default now()
);
create index direcciones_cliente_idx on direcciones (cliente_id);

create table pedidos (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity unique,
  cliente_id     uuid not null references clientes (id),
  direccion_id   uuid not null references direcciones (id),
  metodo_pago    metodo_pago not null,
  estado         estado_pedido not null default 'pendiente_pago',
  subtotal       integer not null check (subtotal >= 0),
  flete          integer not null default 0 check (flete >= 0),
  total          integer not null check (total >= 0),
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (total = subtotal + flete)
);
create index pedidos_cliente_idx on pedidos (cliente_id);
create index pedidos_estado_idx on pedidos (estado);
create trigger pedidos_actualizado before update on pedidos
  for each row execute function set_actualizado_en();

create table items_pedido (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references pedidos (id) on delete cascade,
  variante_id     uuid not null references variantes (id),
  -- Copia de lo vendido, para que el historial no cambie si el catálogo cambia.
  nombre          text not null,
  cantidad        integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0),
  costo_unitario  integer not null check (costo_unitario >= 0)
);
create index items_pedido_pedido_idx on items_pedido (pedido_id);

create table pedidos_proveedor (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references pedidos (id),
  proveedor_id   uuid not null references proveedores (id),
  id_externo     text,
  guia           text,
  transportadora text,
  estado         text not null default 'pendiente',
  respuesta      jsonb,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index pedidos_proveedor_pedido_idx on pedidos_proveedor (pedido_id);
create trigger pedidos_proveedor_actualizado before update on pedidos_proveedor
  for each row execute function set_actualizado_en();

create table pagos (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references pedidos (id),
  referencia     text unique,           -- referencia/id de transacción en Wompi
  estado         estado_pago not null default 'pendiente',
  monto          integer not null check (monto >= 0),
  evento         jsonb,                 -- evento crudo recibido por webhook
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index pagos_pedido_idx on pagos (pedido_id);
create trigger pagos_actualizado before update on pagos
  for each row execute function set_actualizado_en();

-- ------------------------------------------------------------ operación
create table registros_sync (
  id           uuid primary key default gen_random_uuid(),
  proveedor_id uuid references proveedores (id) on delete set null,
  inicio       timestamptz not null default now(),
  fin          timestamptz,
  creados      integer not null default 0,
  actualizados integer not null default 0,
  errores      integer not null default 0,
  detalle      jsonb
);

create table auditoria (
  id         bigint generated always as identity primary key,
  actor      text not null,
  accion     text not null,
  entidad    text not null,
  entidad_id text,
  antes      jsonb,
  despues    jsonb,
  creado_en  timestamptz not null default now()
);

-- ------------------------------------------------------------- seguridad
alter table categorias         enable row level security;
alter table proveedores        enable row level security;
alter table productos          enable row level security;
alter table variantes          enable row level security;
alter table reglas_precio      enable row level security;
alter table clientes           enable row level security;
alter table direcciones        enable row level security;
alter table pedidos            enable row level security;
alter table items_pedido       enable row level security;
alter table pedidos_proveedor  enable row level security;
alter table pagos              enable row level security;
alter table registros_sync     enable row level security;
alter table auditoria          enable row level security;

-- Por defecto Supabase da permisos a anon/authenticated: se quitan todos y se
-- conceden solo columnas públicas del catálogo.
revoke all on all tables in schema public from anon, authenticated;

grant select on categorias to anon, authenticated;
create policy categorias_publico on categorias
  for select to anon, authenticated using (true);

-- Sin proveedor_id ni id_externo: no se expone de dónde viene cada producto.
grant select (id, slug, nombre, descripcion, categoria_id, imagenes, estado, demo, creado_en, actualizado_en)
  on productos to anon, authenticated;
create policy productos_publico on productos
  for select to anon, authenticated using (estado = 'activo');

-- Sin costo: el costo para nosotros nunca sale al público.
grant select (id, producto_id, sku, atributos, precio_venta, stock, activo)
  on variantes to anon, authenticated;
create policy variantes_publico on variantes
  for select to anon, authenticated
  using (
    activo
    and exists (
      select 1 from productos p
      where p.id = variantes.producto_id and p.estado = 'activo'
    )
  );

-- Resto de tablas: RLS activado y sin políticas = solo service_role (servidor).

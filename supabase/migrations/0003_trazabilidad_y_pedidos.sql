-- KingoStore · trazabilidad de pedidos y creación atómica de pedidos
-- Ejecutar después de 0002_permisos_servicio.sql.
--
-- Qué agrega:
--   · token_seguimiento: enlace secreto para que el cliente vea su pedido sin cuenta
--   · historial_estados_pedido: cada cambio de estado, con quién y cuándo
--   · liquidaciones: lo que cobra la transportadora y lo que el proveedor nos paga
--   · crear_pedido(): crea cliente, dirección, pedido e ítems y descuenta stock, todo
--     en una sola transacción, con los precios leídos de la base (nunca del navegador)
--   · cambiar_estado_pedido(): valida las transiciones, devuelve stock al cancelar y
--     deja rastro en el historial y en la auditoría
-- Las funciones solo las puede ejecutar el servidor (service_role).

-- ------------------------------------------------------------- seguimiento
alter table pedidos
  add column token_seguimiento uuid not null default gen_random_uuid();
create unique index pedidos_token_seguimiento_idx on pedidos (token_seguimiento);

create table historial_estados_pedido (
  id              bigint generated always as identity primary key,
  pedido_id       uuid not null references pedidos (id) on delete cascade,
  estado_anterior estado_pedido,
  estado_nuevo    estado_pedido not null,
  actor           text not null,
  nota            text,
  creado_en       timestamptz not null default now()
);
create index historial_pedido_idx on historial_estados_pedido (pedido_id, creado_en);

-- Contra entrega: lo que cobró la transportadora y lo que el proveedor liquida.
create table liquidaciones (
  id                    uuid primary key default gen_random_uuid(),
  proveedor_id          uuid not null references proveedores (id),
  pedido_proveedor_id   uuid references pedidos_proveedor (id),
  monto_cobrado         integer not null default 0 check (monto_cobrado >= 0),
  comision              integer not null default 0 check (comision >= 0),
  flete                 integer not null default 0 check (flete >= 0),
  devoluciones          integer not null default 0 check (devoluciones >= 0),
  monto_liquidado       integer not null default 0,
  estado                text not null default 'pendiente'
                          check (estado in ('pendiente', 'liquidado')),
  fecha_liquidacion     date,
  referencia            text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
create index liquidaciones_pedido_proveedor_idx on liquidaciones (pedido_proveedor_id);
create trigger liquidaciones_actualizado before update on liquidaciones
  for each row execute function set_actualizado_en();

alter table historial_estados_pedido enable row level security;
alter table liquidaciones            enable row level security;
revoke all on historial_estados_pedido, liquidaciones from anon, authenticated;
grant all on historial_estados_pedido, liquidaciones to service_role;
grant all on all sequences in schema public to service_role;

-- ------------------------------------------------------------ crear_pedido
create or replace function crear_pedido(
  p_cliente   jsonb,
  p_direccion jsonb,
  p_items     jsonb,
  p_metodo    metodo_pago,
  p_flete     integer default 0,
  p_notas     text default null,
  -- Total que vio el cliente; si los precios cambiaron, se rechaza la compra.
  p_total_esperado integer default null
) returns jsonb
language plpgsql
as $$
declare
  v_cliente_id   uuid;
  v_direccion_id uuid;
  v_pedido       pedidos%rowtype;
  v_estado       estado_pedido;
  v_subtotal     integer := 0;
  v_total        integer;
  r              record;
  v_var          record;
begin
  -- Validaciones de entrada (el servidor ya valida, esto es la última defensa).
  if p_flete is null or p_flete < 0 then
    raise exception 'flete_invalido';
  end if;
  if coalesce((p_cliente->>'consentimiento_datos')::boolean, false) is not true then
    raise exception 'consentimiento_requerido';
  end if;
  if nullif(btrim(p_cliente->>'nombre'), '') is null
     or nullif(btrim(p_cliente->>'telefono'), '') is null then
    raise exception 'datos_cliente_incompletos';
  end if;
  if nullif(btrim(p_direccion->>'departamento'), '') is null
     or nullif(btrim(p_direccion->>'ciudad'), '') is null
     or nullif(btrim(p_direccion->>'direccion'), '') is null then
    raise exception 'direccion_incompleta';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito_vacio';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(variante_id uuid, cantidad integer)
    where x.variante_id is null or x.cantidad is null or x.cantidad <= 0 or x.cantidad > 20
  ) then
    raise exception 'items_invalidos';
  end if;

  -- 1) Bloquear variantes (en orden, para evitar bloqueos cruzados), validar
  --    disponibilidad y calcular el subtotal con los precios actuales.
  for r in
    select x.variante_id, sum(x.cantidad)::integer as cantidad
    from jsonb_to_recordset(p_items) as x(variante_id uuid, cantidad integer)
    group by x.variante_id
    order by x.variante_id
  loop
    select v.precio_venta, v.stock, v.activo, p.estado as estado_producto
      into v_var
      from variantes v
      join productos p on p.id = v.producto_id
     where v.id = r.variante_id
       for update of v;

    if not found or not v_var.activo or v_var.estado_producto <> 'activo' then
      raise exception 'producto_no_disponible' using detail = r.variante_id::text;
    end if;
    if v_var.stock < r.cantidad then
      raise exception 'stock_insuficiente' using detail = r.variante_id::text;
    end if;
    v_subtotal := v_subtotal + v_var.precio_venta * r.cantidad;
  end loop;

  v_total  := v_subtotal + p_flete;
  if p_total_esperado is not null and p_total_esperado <> v_total then
    raise exception 'precio_cambio' using detail = v_total::text;
  end if;
  v_estado := case p_metodo when 'contra_entrega' then 'por_confirmar'
                            else 'pendiente_pago' end;

  -- 2) Cliente, dirección y pedido.
  insert into clientes (nombre, telefono, correo, consentimiento_datos, consentimiento_en)
  values (
    left(btrim(p_cliente->>'nombre'), 120),
    left(btrim(p_cliente->>'telefono'), 30),
    nullif(left(btrim(coalesce(p_cliente->>'correo', '')), 160), ''),
    true, now()
  ) returning id into v_cliente_id;

  insert into direcciones (cliente_id, departamento, ciudad, direccion, notas)
  values (
    v_cliente_id,
    left(btrim(p_direccion->>'departamento'), 80),
    left(btrim(p_direccion->>'ciudad'), 80),
    left(btrim(p_direccion->>'direccion'), 200),
    nullif(left(btrim(coalesce(p_direccion->>'notas', '')), 300), '')
  ) returning id into v_direccion_id;

  insert into pedidos (cliente_id, direccion_id, metodo_pago, estado, subtotal, flete, total, notas)
  values (v_cliente_id, v_direccion_id, p_metodo, v_estado, v_subtotal, p_flete, v_total,
          nullif(left(btrim(coalesce(p_notas, '')), 500), ''))
  returning * into v_pedido;

  -- 3) Ítems (con copia de nombre, precio y costo) y descuento de stock.
  for r in
    select x.variante_id, sum(x.cantidad)::integer as cantidad
    from jsonb_to_recordset(p_items) as x(variante_id uuid, cantidad integer)
    group by x.variante_id
    order by x.variante_id
  loop
    insert into items_pedido (pedido_id, variante_id, nombre, cantidad, precio_unitario, costo_unitario)
    select v_pedido.id, v.id,
           p.nombre || case when v.atributos = '{}'::jsonb then ''
                            else ' (' || (select string_agg(value, ', ') from jsonb_each_text(v.atributos)) || ')' end,
           r.cantidad, v.precio_venta, v.costo
      from variantes v join productos p on p.id = v.producto_id
     where v.id = r.variante_id;

    update variantes set stock = stock - r.cantidad where id = r.variante_id;
  end loop;

  -- 4) Rastro.
  insert into historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, actor, nota)
  values (v_pedido.id, null, v_estado, 'cliente', 'Pedido creado');

  insert into auditoria (actor, accion, entidad, entidad_id, despues)
  values ('cliente', 'crear_pedido', 'pedidos', v_pedido.id::text,
          jsonb_build_object('numero', v_pedido.numero, 'total', v_total,
                             'metodo_pago', p_metodo, 'estado', v_estado));

  return jsonb_build_object(
    'id', v_pedido.id,
    'numero', v_pedido.numero,
    'token_seguimiento', v_pedido.token_seguimiento,
    'estado', v_estado,
    'subtotal', v_subtotal,
    'flete', p_flete,
    'total', v_total
  );
end;
$$;

-- --------------------------------------------------- cambiar_estado_pedido
create or replace function cambiar_estado_pedido(
  p_pedido uuid,
  p_nuevo  estado_pedido,
  p_actor  text,
  p_nota   text default null
) returns void
language plpgsql
as $$
declare
  v_actual estado_pedido;
  r        record;
begin
  select estado into v_actual from pedidos where id = p_pedido for update;
  if not found then
    raise exception 'pedido_no_existe';
  end if;

  if (v_actual::text || '>' || p_nuevo::text) <> all (array[
       'pendiente_pago>pagado',
       'pendiente_pago>cancelado',
       'por_confirmar>confirmado',
       'por_confirmar>cancelado',
       'pagado>confirmado',
       'pagado>enviado_a_proveedor',
       'pagado>cancelado',
       'confirmado>enviado_a_proveedor',
       'confirmado>cancelado',
       'enviado_a_proveedor>despachado',
       'enviado_a_proveedor>fallo_proveedor',
       'enviado_a_proveedor>cancelado',
       'fallo_proveedor>enviado_a_proveedor',
       'fallo_proveedor>cancelado',
       'despachado>entregado',
       'despachado>devuelto',
       'entregado>devuelto'
     ]) then
    raise exception 'transicion_invalida' using detail = v_actual::text || ' -> ' || p_nuevo::text;
  end if;

  -- Cancelar libera el stock que se había reservado al crear el pedido.
  if p_nuevo = 'cancelado' then
    for r in select variante_id, cantidad from items_pedido where pedido_id = p_pedido loop
      update variantes set stock = stock + r.cantidad where id = r.variante_id;
    end loop;
  end if;

  update pedidos set estado = p_nuevo where id = p_pedido;

  insert into historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, actor, nota)
  values (p_pedido, v_actual, p_nuevo, p_actor, p_nota);

  insert into auditoria (actor, accion, entidad, entidad_id, antes, despues)
  values (p_actor, 'cambiar_estado_pedido', 'pedidos', p_pedido::text,
          jsonb_build_object('estado', v_actual), jsonb_build_object('estado', p_nuevo));
end;
$$;

-- Solo el servidor puede ejecutarlas.
revoke all on function crear_pedido(jsonb, jsonb, jsonb, metodo_pago, integer, text, integer)
  from public, anon, authenticated;
revoke all on function cambiar_estado_pedido(uuid, estado_pedido, text, text)
  from public, anon, authenticated;
grant execute on function crear_pedido(jsonb, jsonb, jsonb, metodo_pago, integer, text, integer)
  to service_role;
grant execute on function cambiar_estado_pedido(uuid, estado_pedido, text, text)
  to service_role;

notify pgrst, 'reload schema';

-- KingoStore · permisos del rol de servicio
-- Ejecutar después de 0001_esquema_inicial.sql.
-- Algunos proyectos de Supabase no conceden permisos automáticos sobre las tablas
-- nuevas. El servidor (llave service_role) los necesita para pedidos, pagos,
-- sincronización y panel admin. El público (anon) NO recibe nada aquí.

grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Tablas futuras creadas por migraciones heredan el permiso.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Refresca la API para que tome los cambios.
notify pgrst, 'reload schema';

-- KingoStore · datos de demostración
-- Ejecutar DESPUÉS de 0001_esquema_inicial.sql. Se puede repetir sin duplicar.
-- Productos y precios de ejemplo: se borran cuando haya datos reales.

insert into categorias (slug, nombre, descripcion, orden) values
  ('hogar-y-cocina', 'Hogar y cocina', 'Organización y utilidades para el día a día.', 1),
  ('tecnologia',     'Tecnología',     'Accesorios y gadgets prácticos.',              2),
  ('mascotas',       'Mascotas',       'Comodidad y cuidado para tu compañero.',       3),
  ('belleza',        'Belleza',        'Cuidado personal y maquillaje.',               4),
  ('fitness',        'Fitness',        'Entrena en casa o donde quieras.',             5)
on conflict (slug) do nothing;

with demo (slug, nombre, descripcion, categoria, precio) as (
  values
    ('bandas-elasticas-entrenamiento', 'Set de bandas elásticas para entrenamiento',
     'Bandas de distintas resistencias para ejercicios de fuerza y movilidad en casa.', 'fitness', 54900),
    ('espejo-mesa-luz-led', 'Espejo de mesa con luz LED',
     'Espejo con iluminación integrada para maquillarte con mejor luz.', 'belleza', 89900),
    ('organizador-maquillaje', 'Organizador de maquillaje con compartimentos',
     'Mantén tus productos ordenados y a la mano.', 'belleza', 59900),
    ('tapete-arena-gato', 'Tapete para recoger arena de gato',
     'Atrapa la arena que se queda en las patas y mantiene el piso limpio.', 'mascotas', 49900),
    ('bebedero-portatil-mascotas', 'Bebedero portátil para paseos con mascotas',
     'Botella con bebedero integrado para hidratar a tu mascota en la calle.', 'mascotas', 32900),
    ('lampara-led-recargable-escritorio', 'Lámpara LED recargable para escritorio',
     'Luz regulable y batería recargable para estudiar o trabajar.', 'tecnologia', 79900),
    ('soporte-plegable-celular-tableta', 'Soporte plegable para celular y tableta',
     'Se pliega para guardarlo fácil y ajusta el ángulo de la pantalla.', 'tecnologia', 29900),
    ('dispensador-jabon-soporte-esponja', 'Dispensador de jabón con soporte para esponja',
     'Mantiene el jabón y la esponja organizados junto al lavaplatos.', 'hogar-y-cocina', 34900),
    ('organizador-ajustable-cajones', 'Organizador ajustable para cajones de cocina',
     'Divisiones ajustables para ordenar cubiertos y utensilios.', 'hogar-y-cocina', 44900)
),
nuevos as (
  insert into productos (slug, nombre, descripcion, categoria_id, estado, demo)
  select d.slug, d.nombre, d.descripcion, c.id, 'activo', true
  from demo d
  join categorias c on c.slug = d.categoria
  on conflict (slug) do nothing
  returning id, slug
)
insert into variantes (producto_id, id_externo, atributos, costo, precio_venta, stock)
select n.id, 'demo-' || n.slug, '{}'::jsonb, round(d.precio * 0.55), d.precio, 50
from nuevos n
join demo d on d.slug = n.slug;

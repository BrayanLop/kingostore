import type { Categoria, Producto } from "./types";

export const categorias: Categoria[] = [
  {
    slug: "hogar-y-cocina",
    nombre: "Hogar y cocina",
    descripcion: "Organización y utilidades para el día a día.",
  },
  {
    slug: "tecnologia",
    nombre: "Tecnología",
    descripcion: "Accesorios y gadgets prácticos.",
  },
  {
    slug: "mascotas",
    nombre: "Mascotas",
    descripcion: "Comodidad y cuidado para tu compañero.",
  },
  {
    slug: "belleza",
    nombre: "Belleza",
    descripcion: "Cuidado personal y maquillaje.",
  },
  {
    slug: "fitness",
    nombre: "Fitness",
    descripcion: "Entrena en casa o donde quieras.",
  },
];

// Productos de ejemplo para ver el diseño. Precios inventados.
type ProductoBase = Omit<Producto, "variantes">;

const productosBase: ProductoBase[] = [
  {
    slug: "bandas-elasticas-entrenamiento",
    nombre: "Set de bandas elásticas para entrenamiento",
    descripcion:
      "Bandas de distintas resistencias para ejercicios de fuerza y movilidad en casa.",
    categoria: "fitness",
    precio: 54900,
    demo: true,
  },
  {
    slug: "espejo-mesa-luz-led",
    nombre: "Espejo de mesa con luz LED",
    descripcion: "Espejo con iluminación integrada para maquillarte con mejor luz.",
    categoria: "belleza",
    precio: 89900,
    demo: true,
  },
  {
    slug: "organizador-maquillaje",
    nombre: "Organizador de maquillaje con compartimentos",
    descripcion: "Mantén tus productos ordenados y a la mano.",
    categoria: "belleza",
    precio: 59900,
    demo: true,
  },
  {
    slug: "tapete-arena-gato",
    nombre: "Tapete para recoger arena de gato",
    descripcion: "Atrapa la arena que se queda en las patas y mantiene el piso limpio.",
    categoria: "mascotas",
    precio: 49900,
    demo: true,
  },
  {
    slug: "bebedero-portatil-mascotas",
    nombre: "Bebedero portátil para paseos con mascotas",
    descripcion: "Botella con bebedero integrado para hidratar a tu mascota en la calle.",
    categoria: "mascotas",
    precio: 32900,
    demo: true,
  },
  {
    slug: "lampara-led-recargable-escritorio",
    nombre: "Lámpara LED recargable para escritorio",
    descripcion: "Luz regulable y batería recargable para estudiar o trabajar.",
    categoria: "tecnologia",
    precio: 79900,
    demo: true,
  },
  {
    slug: "soporte-plegable-celular-tableta",
    nombre: "Soporte plegable para celular y tableta",
    descripcion: "Se pliega para guardarlo fácil y ajusta el ángulo de la pantalla.",
    categoria: "tecnologia",
    precio: 29900,
    demo: true,
  },
  {
    slug: "dispensador-jabon-soporte-esponja",
    nombre: "Dispensador de jabón con soporte para esponja",
    descripcion: "Mantiene el jabón y la esponja organizados junto al lavaplatos.",
    categoria: "hogar-y-cocina",
    precio: 34900,
    demo: true,
  },
  {
    slug: "organizador-ajustable-cajones",
    nombre: "Organizador ajustable para cajones de cocina",
    descripcion: "Divisiones ajustables para ordenar cubiertos y utensilios.",
    categoria: "hogar-y-cocina",
    precio: 44900,
    demo: true,
  },
];

// En modo demostración cada producto tiene una variante con id no válido para
// pedidos: el checkout solo funciona con la base de datos conectada.
export const productos: Producto[] = productosBase.map((p) => ({
  ...p,
  variantes: [{ id: `demo-${p.slug}`, atributos: {}, precio: p.precio, stock: 50 }],
}));

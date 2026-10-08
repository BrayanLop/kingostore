// Contrato común que debe cumplir cada proveedor (Dropi, CJ, importador CSV...).
// Cada adaptador traduce la API del proveedor a estos tipos.

export interface ProductoProveedor {
  idExterno: string;
  nombre: string;
  descripcion: string;
  imagenes: string[];
  variantes: VarianteProveedor[];
  /** Si el adaptador no pudo interpretar el producto, aquí va el motivo (y no se importa). */
  motivoRechazo?: string;
}

export interface VarianteProveedor {
  idExterno: string;
  sku?: string;
  atributos: Record<string, string>;
  /** Costo para nosotros, en COP. */
  costo: number;
  /** Precio de venta sugerido por el proveedor, si lo informa (referencia, no obligatorio). */
  precioSugerido?: number;
  stock: number;
}

export interface DireccionEnvio {
  nombre: string;
  telefono: string;
  departamento: string;
  ciudad: string;
  direccion: string;
  notas?: string;
}

export interface PedidoProveedor {
  idPedidoPropio: string;
  items: { idExternoVariante: string; cantidad: number }[];
  destino: DireccionEnvio;
  /** true si el proveedor debe cobrar al entregar. */
  contraEntrega: boolean;
  totalACobrar?: number;
}

export interface ResultadoPedido {
  idExterno: string;
  guia?: string;
  transportadora?: string;
}

export interface AdaptadorProveedor {
  readonly id: string;
  listarProductos(pagina: number): Promise<{
    productos: ProductoProveedor[];
    hayMas: boolean;
  }>;
  obtenerStock(idExternoVariante: string): Promise<number>;
  crearPedido(pedido: PedidoProveedor): Promise<ResultadoPedido>;
}

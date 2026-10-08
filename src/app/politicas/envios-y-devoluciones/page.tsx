import type { Metadata } from "next";
import { PaginaLegal } from "@/components/PaginaLegal";
import { ENVIO_GRATIS_DESDE_COP, FLETE_FIJO_COP } from "@/modules/envios/config";
import { formatearCop } from "@/modules/precios";

export const metadata: Metadata = { title: "Envíos y devoluciones" };

export default function EnviosYDevoluciones() {
  return (
    <PaginaLegal titulo="Envíos y devoluciones" actualizado="[fecha de publicación]">
      <h2>1. Cobertura y costo de envío</h2>
      <p>
        Enviamos a todo el territorio colombiano donde lleguen nuestras
        transportadoras aliadas. El envío cuesta {formatearCop(FLETE_FIJO_COP)}
        {ENVIO_GRATIS_DESDE_COP !== null && (
          <>
            {" "}y es <strong>gratis</strong> en compras desde{" "}
            {formatearCop(ENVIO_GRATIS_DESDE_COP)}
          </>
        )}
        . El valor exacto se muestra antes de confirmar el pedido.{" "}
        <strong>[Confirmar valores cuando se conozcan los fletes reales.]</strong>
      </p>

      <h2>2. Tiempos de entrega</h2>
      <p>
        El tiempo estimado es de <strong>[X a Y días hábiles]</strong> desde que
        confirmamos tu pedido, según la ciudad de destino. Es un estimado: puede
        variar por la transportadora o por causas de fuerza mayor. Recibirás el
        número de guía para seguir tu envío.
      </p>

      <h2>3. Pago contra entrega</h2>
      <p>
        Pagas al recibir el pedido. Ten el valor total listo. Si nadie recibe el
        pedido en los intentos de entrega, la transportadora lo devolverá y el
        pedido se cancelará.
      </p>

      <h2>4. Revisa tu pedido al recibirlo</h2>
      <p>
        Revisa que el paquete llegue en buen estado. Si notas daños evidentes,
        avísanos el mismo día por WhatsApp con fotos del paquete y del producto.
      </p>

      <h2>5. Derecho de retracto</h2>
      <p>
        Por ser una compra a distancia, puedes <strong>retractarte dentro de los
        5 días hábiles siguientes a la entrega</strong> del producto, sin dar
        explicaciones (Ley 1480 de 2011, art. 47). Para ejercerlo:
      </p>
      <ul>
        <li>Escríbenos a <strong>[correo]</strong> o por WhatsApp indicando tu número de pedido.</li>
        <li>Devuelve el producto en las mismas condiciones en que lo recibiste, con su empaque y accesorios.</li>
        <li>Los costos de transporte de la devolución corren por tu cuenta.</li>
        <li>Te devolvemos el dinero dentro de los 30 días calendario siguientes a que ejerzas el derecho.</li>
      </ul>
      <p>
        El retracto no aplica a productos que, por su naturaleza, no puedan ser
        devueltos por razones de higiene o seguridad, ni a los demás casos que la
        ley exceptúe. <strong>[Revisar excepciones con el abogado, por ejemplo
        productos de belleza abiertos.]</strong>
      </p>

      <h2>6. Garantía legal</h2>
      <p>
        Si el producto llega defectuoso o no corresponde a lo ofrecido, tienes
        derecho a la garantía legal: reparación, cambio o devolución del dinero,
        según el caso. Escríbenos a <strong>[correo]</strong> con tu número de
        pedido y fotos o video del problema. En estos casos, los costos de envío
        de la devolución los asumimos nosotros.
      </p>

      <h2>7. Cancelaciones</h2>
      <p>
        Puedes cancelar tu pedido sin costo antes de que sea despachado.
        Escríbenos lo antes posible con tu número de pedido.
      </p>
    </PaginaLegal>
  );
}

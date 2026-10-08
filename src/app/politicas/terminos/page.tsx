import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function Terminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones" actualizado="[fecha de publicación]">
      <h2>1. Quiénes somos</h2>
      <p>
        KingoStore es una tienda en línea operada por <strong>[razón social o
        nombre del comerciante]</strong>, NIT/CC <strong>[número]</strong>, con
        domicilio en <strong>[ciudad, Colombia]</strong>. Contacto:{" "}
        <strong>[correo]</strong> y WhatsApp <strong>[número]</strong>.
      </p>

      <h2>2. Qué ofrecemos</h2>
      <p>
        Vendemos productos para el hogar, tecnología, mascotas, belleza y
        fitness, con entrega en Colombia. Algunos productos son despachados
        directamente por nuestros proveedores aliados.
      </p>

      <h2>3. Precios</h2>
      <p>
        Los precios se expresan en pesos colombianos (COP) e incluyen los
        impuestos que apliquen <strong>[confirmar con contador]</strong>. El
        valor del envío se muestra antes de confirmar el pedido. El precio que
        aplica es el vigente al momento de confirmar la compra.
      </p>

      <h2>4. Cómo comprar y pagar</h2>
      <ul>
        <li>Eliges los productos, los agregas al carrito y completas tus datos de entrega.</li>
        <li>
          El pago es <strong>contra entrega</strong>: pagas al recibir el
          pedido. <strong>[Agregar otros medios de pago cuando estén activos.]</strong>
        </li>
        <li>
          Antes de despachar, podemos contactarte por WhatsApp o teléfono para
          confirmar tus datos. Si no logramos confirmar el pedido, podemos
          cancelarlo.
        </li>
      </ul>

      <h2>5. Disponibilidad</h2>
      <p>
        Las existencias son limitadas. Si un producto se agota después de
        recibir tu pedido, te lo informaremos y podrás elegir otro producto o
        cancelar sin costo.
      </p>

      <h2>6. Envíos, retracto y garantía</h2>
      <p>
        Los tiempos de entrega, el derecho de retracto, las devoluciones y la
        garantía legal se explican en la página{" "}
        <Link className="text-gold-light underline" href="/politicas/envios-y-devoluciones">
          Envíos y devoluciones
        </Link>
        .
      </p>

      <h2>7. Peticiones, quejas y reclamos</h2>
      <p>
        Puedes escribirnos a <strong>[correo]</strong> o por WhatsApp. Daremos
        respuesta dentro de los plazos legales. Si no estás conforme con la
        respuesta, puedes acudir a la Superintendencia de Industria y Comercio
        (SIC).
      </p>

      <h2>8. Datos personales</h2>
      <p>
        El tratamiento de tus datos se rige por nuestra{" "}
        <Link className="text-gold-light underline" href="/politicas/privacidad">
          Política de privacidad
        </Link>
        .
      </p>

      <h2>9. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Colombia,
        incluido el Estatuto del Consumidor (Ley 1480 de 2011).
      </p>
    </PaginaLegal>
  );
}

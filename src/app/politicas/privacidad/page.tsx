import type { Metadata } from "next";
import { PaginaLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="[fecha de publicación]">
      <h2>1. Responsable del tratamiento</h2>
      <p>
        <strong>[Razón social o nombre]</strong>, NIT/CC <strong>[número]</strong>,
        domicilio en <strong>[ciudad, Colombia]</strong>. Correo para ejercer
        tus derechos: <strong>[correo]</strong>.
      </p>

      <h2>2. Qué datos recogemos</h2>
      <ul>
        <li>Nombre, teléfono y, si lo das, correo electrónico.</li>
        <li>Dirección de entrega e indicaciones para el envío.</li>
        <li>Productos que compras y estado de tus pedidos.</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Gestionar tu pedido: confirmarlo, empacarlo, enviarlo y cobrarlo.</li>
        <li>Contactarte por WhatsApp, teléfono o correo sobre tu pedido.</li>
        <li>Atender peticiones, quejas, garantías y devoluciones.</li>
        <li>Cumplir obligaciones legales, contables y tributarias.</li>
      </ul>

      <h2>4. Con quién los compartimos</h2>
      <p>
        Con los proveedores y transportadoras que necesitan tus datos de
        entrega para despachar tu pedido, y con los servicios técnicos que
        alojan la tienda y su base de datos. No vendemos tus datos.{" "}
        <strong>[Listar aquí proveedores y encargados cuando estén definidos.]</strong>
      </p>

      <h2>5. Tus derechos (Ley 1581 de 2012)</h2>
      <p>Como titular puedes:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Solicitar prueba de la autorización que nos diste.</li>
        <li>Ser informado sobre el uso que damos a tus datos.</li>
        <li>Revocar la autorización y solicitar la supresión de tus datos, cuando no exista un deber legal de conservarlos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
      </ul>
      <p>
        Para ejercerlos escribe a <strong>[correo]</strong>. Responderemos en
        los plazos que fija la ley.
      </p>

      <h2>6. Autorización</h2>
      <p>
        Al marcar la casilla de aceptación al finalizar tu pedido, autorizas el
        tratamiento de tus datos para las finalidades descritas.
      </p>

      <h2>7. Conservación</h2>
      <p>
        Conservamos tus datos el tiempo necesario para cumplir estas
        finalidades y las obligaciones legales aplicables.{" "}
        <strong>[Definir plazos con el contador/abogado.]</strong>
      </p>

      <h2>8. Cookies y almacenamiento local</h2>
      <p>
        Guardamos tu carrito en el almacenamiento de tu navegador para que no
        se pierda al cambiar de página. <strong>[Actualizar este apartado cuando
        se agreguen analítica y publicidad, con su aviso de consentimiento.]</strong>
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas para proteger tus datos, pero ningún sistema
        es completamente infalible.
      </p>
    </PaginaLegal>
  );
}

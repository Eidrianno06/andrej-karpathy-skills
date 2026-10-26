# La Dulcería: carta por mesa y panel del mostrador

| Archivo | Quién lo usa | Para qué |
|---|---|---|
| `menu.html?mesa=N` | Clientes (desde el QR de su mesa) | Ver la carta, armar el pedido, enviarlo y seguir su estado. No muestra ventas ni otros pedidos. |
| `panel.html` | Personal (con correo y contraseña) | Recibir pedidos en vivo con sonido, confirmarlos o rechazarlos, marcarlos listos, cobrarlos, ver mesas, vitrina y caja. |
| `qr.html` | Tú, una vez | Generar e imprimir los 8 QR, uno por mesa. |
| `index.html` | Presentación | Página de muestra con el recorrido animado. |
| `supabase.sql` | Supabase, una vez | Crea la base de datos, la carta inicial y las reglas de seguridad. |
| `config.js` | Tú, una vez | Aquí van las 2 claves de Supabase. |

Sin claves en `config.js` todo funciona en **modo demo**: los pedidos viajan solo entre pestañas del mismo navegador. Sirve para probar, no para el local.

## Puesta en marcha (unos 15 minutos, desde una computadora)

1. **Crea el proyecto.** Entra a [supabase.com](https://supabase.com), crea una cuenta gratis y luego *New project*. Ponle de nombre `la-dulceria` y elige una región cercana (por ejemplo *East US*).
2. **Crea la base de datos.** En el menú de la izquierda abre *SQL Editor* → *New query*. Pega todo el contenido de `supabase.sql` y pulsa **Run**. Debe decir *Success*.
3. **Crea el usuario del mostrador.**
   - *Authentication* → *Users* → *Add user* → *Create new user*. Escribe un correo y una contraseña y marca *Auto Confirm User*.
   - Vuelve a *SQL Editor* y ejecuta, con ese mismo correo:
     ```sql
     insert into personal (email) values ('mostrador@ladulceria.com');
     ```
   - Repite esto por cada persona que deba entrar al panel.
4. **Cierra el registro público.** *Authentication* → *Sign In / Providers* → desactiva **Allow new users to sign up**. Así nadie más puede crearse una cuenta.
5. **Copia las claves.** *Project Settings* → *API*. Copia **Project URL** y la clave **anon public** en `config.js` (o pásamelas y lo hago yo).
6. **Publica la carpeta.** Entra a [app.netlify.com/drop](https://app.netlify.com/drop) y arrastra la carpeta `la-dulceria` completa. Te da una dirección, por ejemplo `https://la-dulceria.netlify.app`.
7. **Imprime los QR.** Abre `https://TU-DIRECCION/qr.html`, revisa que la dirección de arriba sea la correcta y pulsa *Imprimir*.
8. **Abre el panel en el mostrador.** Entra a `https://TU-DIRECCION/panel.html` con el correo del paso 3. Toca la pantalla una vez para activar el sonido de los pedidos nuevos.

## Cómo funciona

- Cada QR abre `menu.html?mesa=N`, así el pedido llega con su número de mesa.
- El cliente solo manda productos y cantidades. **Precios, total y existencias se calculan en Supabase**, así nadie puede inventar un precio ni pedir algo agotado.
- Cada pedido descuenta las porciones de la vitrina. Si se rechaza, vuelven.
- Estados: **Nuevo → Preparando → Listo → Entregado** (se cobra al entregar: pago móvil, efectivo o punto). El cliente lo ve en su teléfono en unos segundos.
- Una mesa puede tener a lo sumo 5 pedidos sin confirmar a la vez, para evitar envíos repetidos.
- **Cambiar la carta:** en Supabase, *Table Editor* → `productos`. Puedes editar nombre, descripción, precio, categoría, `sigla` (las 2 letras del cuadrito) y `color`. Para agregar un postre, crea una fila nueva con un `id` corto, por ejemplo `brownie`. Desde el panel puedes reponer, ajustar porciones y ocultar o mostrar productos.
- **Más o menos mesas:** cambia `mesas` en `config.js` y el `8` de la función `hacer_pedido` en `supabase.sql` (la línea dice «número de mesas»), vuelve a ejecutar el SQL y reimprime los QR.

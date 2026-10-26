# La Dulcería: carta QR por mesa + panel del mostrador

Notas para Claude. Léelas antes de cambiar algo. Responde al usuario en español.

## Qué es
Sitio estático (HTML/CSS/JS sin build) + Supabase. Se publica arrastrando esta carpeta a Netlify Drop.
- `menu.html?mesa=N` — carta para el cliente (QR por mesa). No muestra ventas ni pedidos ajenos.
- `panel.html` — mostrador, con login de Supabase Auth. Pestañas: Pedidos, Mesas, Vitrina, Caja.
- `qr.html` — genera e imprime un QR por mesa.
- `index.html` — página de presentación animada (demo, sin datos reales).
- `datos.js` — única capa de datos. Con claves en `config.js` usa Supabase; sin claves, modo demo en localStorage.
- `estilo.css` — tokens y piezas compartidas. `supabase.sql` — esquema completo, re-ejecutable.

## Decisiones (no cambiar sin hablarlo)
- El cliente solo envía `{id, cantidad}` a la RPC `hacer_pedido`; precio, total y stock se calculan en Postgres.
- Personal = correos en la tabla `personal`; `es_personal()` controla RLS y las RPC `cancelar_pedido` y `reponer`.
- Estados: nuevo → preparando → listo → entregado (con `pago`: pago_movil/efectivo/punto) | cancelado (devuelve stock).
- El cliente sigue sus pedidos con `estado_pedidos(uuid[])`; los ids se guardan en localStorage por mesa.
- Diseño: blanco/crema/marrones; Fraunces (títulos, cursiva para acentos) + Manrope (texto y números).

## Instalación actual
- Netlify: https://ladulceriabyadruancordero.netlify.app
- Supabase: proyecto "La dulcería Santa rosa", ref `mcoojpyglyrjizfwjdwz` (org "La dulcería"). 8 mesas.
- Usuarios del panel: ver tabla `personal` (no anotar correos aquí: esta carpeta se publica en Netlify).

## Pendiente / ideas acordadas
- Multi-restaurante: una sola base con `local_id` en cada tabla y RLS por local, en vez de un proyecto de Supabase por local (el plan gratis solo permite 2).
- Pantalla en el panel para editar la carta (productos, precios, fotos) sin entrar a Supabase.
- Moneda: mostrar USD con decimales ($ 5,50) y opcionalmente Bs. a tasa del día; hoy `fmt` muestra "$ 5.500".
- Fotos reales de los productos (Supabase Storage).

## Cómo probar
- Modo demo: servir la carpeta (`python3 -m http.server`) sin claves en `config.js`; abrir panel.html y menu.html?mesa=8 en pestañas del mismo navegador.
- SQL: se probó en Postgres local con roles `anon`/`authenticated` simulados y en el proyecto real con transacciones que hacen rollback.

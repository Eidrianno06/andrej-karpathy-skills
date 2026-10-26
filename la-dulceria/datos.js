// Capa de datos compartida por menu.html y panel.html.
// Con claves en config.js habla con Supabase; sin claves usa un modo demo guardado en este navegador.
(function(){
  const C = window.DULCERIA || {};
  const MESAS = C.mesas || 8;

  const util = {
    fmt: n => '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    uuid(){
      if (crypto.randomUUID) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = b[6] & 0x0f | 0x40; b[8] = b[8] & 0x3f | 0x80;
      const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    },
    inicioDeHoy(){ const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
  };

  /* ---------- Supabase ---------- */
  if (C.supabaseUrl && C.supabaseKey && window.supabase) {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
    const ok = ({data, error}) => { if (error) throw new Error(error.message); return data; };
    const escuchar = (tabla, cb) => sb.channel('cambios-' + tabla)
      .on('postgres_changes', {event:'*', schema:'public', table:tabla}, () => cb())
      .subscribe();

    window.Datos = {
      modo: 'supabase', mesas: MESAS, ...util,
      productos: async () => ok(await sb.from('productos').select('*').order('orden')),
      alCambiarProductos: cb => escuchar('productos', cb),
      hacerPedido: async p => ok(await sb.rpc('hacer_pedido', {p_id:p.id, p_mesa:p.mesa, p_items:p.items, p_nota:p.nota || ''})),
      estadoPedidos: async ids => ids.length ? ok(await sb.rpc('estado_pedidos', {p_ids:ids})) : [],
      alCambiarMisPedidos: cb => setInterval(cb, 5000),

      async sesion(){ return !!(await sb.auth.getSession()).data.session && ok(await sb.rpc('es_personal')); },
      async entrar(email, clave){
        const {error} = await sb.auth.signInWithPassword({email, password:clave});
        if (error) throw new Error('Correo o contraseña incorrectos.');
        if (!ok(await sb.rpc('es_personal'))) { await sb.auth.signOut(); throw new Error('Este correo no está autorizado para el panel.'); }
      },
      salir: async () => { await sb.auth.signOut(); },
      pedidosDeHoy: async () => ok(await sb.from('pedidos').select('*').gte('creado', util.inicioDeHoy()).order('creado', {ascending:false})),
      alCambiarPedidos: cb => escuchar('pedidos', cb),
      cambiarEstado: async (id, estado, pago) => ok(await sb.from('pedidos').update(pago ? {estado, pago} : {estado}).eq('id', id)),
      cancelar: async id => ok(await sb.rpc('cancelar_pedido', {p_id:id})),
      reponer: async (id, cantidad) => ok(await sb.rpc('reponer', {p_id:id, p_cantidad:cantidad})),
      activar: async (id, activo) => ok(await sb.from('productos').update({activo}).eq('id', id))
    };
    return;
  }

  /* ---------- Modo demo (localStorage, sincroniza pestañas del mismo navegador) ---------- */
  const SEMILLA = [
    ['tres', 'Torta tres leches',     'Bizcocho empapado y merengue tostado.',    'Tortas',    5500,  9, 12, '#D9B38A', '3L'],
    ['choco','Torta de chocolate',    'Húmeda, con ganache de cacao al 60 %.',    'Tortas',    6000,  6, 12, '#5A3320', 'Ch'],
    ['zana', 'Torta de zanahoria',    'Con nueces y frosting de queso crema.',    'Tortas',    5800,  7, 10, '#C9874D', 'Za'],
    ['ques', 'Quesillo',              'Flan de la casa con caramelo oscuro.',     'Fríos',     4200, 10, 12, '#C88A3E', 'Qs'],
    ['marq', 'Marquesa de chocolate', 'Capas de galleta María y crema de cacao.', 'Fríos',     5800,  4,  8, '#6B4029', 'Mq'],
    ['chees','Cheesecake de fresa',   'Base de galleta y coulis de fresa.',       'Fríos',     6500,  6, 10, '#B7655A', 'Cc'],
    ['bien', 'Bienmesabe',            'Crema de coco, bizcochuelo y canela.',     'Fríos',     5000,  5,  8, '#E1C9A5', 'Bm'],
    ['golf', 'Golfeado con queso',    'Papelón, anís y queso de mano.',           'Horneados', 4800,  8, 12, '#A9673A', 'Gf'],
    ['alfa', 'Alfajores x3',          'Rellenos de arequipe y coco rallado.',     'Horneados', 4000, 12, 15, '#D7A46E', 'Af'],
    ['galle','Galletas de avena x4',  'Con pasas y un toque de canela.',          'Horneados', 3200, 10, 15, '#B98A56', 'Ga'],
    ['cafe', 'Café con leche',        'Espresso doble y leche cremada.',          'Bebidas',   2500, 40, 40, '#8A5A3A', 'Cl'],
    ['choc', 'Chocolate caliente',    'Cacao venezolano y un toque de canela.',   'Bebidas',   3200, 30, 30, '#4E2C1A', 'Ca']
  ].map(([id, nombre, descripcion, categoria, precio, stock, bandeja, color, sigla], i) =>
    ({id, nombre, descripcion, categoria, precio, stock, bandeja, color, sigla, orden:i + 1, activo:true}));

  const KEY = 'dulceria-demo-v1';
  let memoria = null;   // respaldo si el navegador bloquea localStorage
  function leer(){
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch(e){}
    return memoria || {productos: SEMILLA.map(p => ({...p})), pedidos: []};
  }
  const oyentes = [];
  function guardar(s){
    memoria = s;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){}
    oyentes.forEach(f => f());
  }
  addEventListener('storage', e => { if (e.key === KEY) oyentes.forEach(f => f()); });
  const oir = cb => { oyentes.push(cb); };

  window.Datos = {
    modo: 'demo', mesas: MESAS, ...util,
    productos: async () => leer().productos.slice().sort((a, b) => a.orden - b.orden),
    alCambiarProductos: oir,
    async hacerPedido({id, mesa, items, nota}){
      const s = leer();
      if (!(mesa >= 1 && mesa <= MESAS)) throw new Error('Esta mesa no existe. Escanea el QR de tu mesa.');
      if (!items.length) throw new Error('Tu pedido está vacío.');
      if (s.pedidos.filter(p => p.mesa === mesa && p.estado === 'nuevo').length >= 5)
        throw new Error('Tu mesa ya tiene pedidos esperando confirmación. Espera un momento.');
      const lineas = [];
      for (const it of items) {
        const p = s.productos.find(x => x.id === it.id && x.activo);
        if (!p) throw new Error('Uno de los productos ya no está disponible.');
        if (p.stock < it.cantidad) throw new Error(`Solo quedan ${p.stock} de ${p.nombre}.`);
        lineas.push({id:p.id, nombre:p.nombre, cantidad:it.cantidad, precio:p.precio});
      }
      lineas.forEach(l => { s.productos.find(x => x.id === l.id).stock -= l.cantidad; });
      s.pedidos.unshift({id, mesa, items:lineas, nota:(nota || '').slice(0, 200), estado:'nuevo', pago:null,
        total:lineas.reduce((a, l) => a + l.cantidad * l.precio, 0), creado:new Date().toISOString()});
      guardar(s);
    },
    estadoPedidos: async ids => leer().pedidos.filter(p => ids.includes(p.id)),
    alCambiarMisPedidos: oir,

    sesion: async () => true,
    entrar: async () => {},
    salir: async () => {},
    pedidosDeHoy: async () => leer().pedidos.filter(p => p.creado >= util.inicioDeHoy()),
    alCambiarPedidos: oir,
    async cambiarEstado(id, estado, pago){
      const s = leer(), p = s.pedidos.find(x => x.id === id); if (!p) return;
      p.estado = estado; if (pago) p.pago = pago; guardar(s);
    },
    async cancelar(id){
      const s = leer(), p = s.pedidos.find(x => x.id === id);
      if (!p || p.estado === 'entregado' || p.estado === 'cancelado') return;
      p.items.forEach(l => { const x = s.productos.find(q => q.id === l.id); if (x) x.stock += l.cantidad; });
      p.estado = 'cancelado'; guardar(s);
    },
    async reponer(id, cantidad){
      const s = leer(), p = s.productos.find(x => x.id === id); if (!p) return;
      p.stock = Math.max(0, p.stock + cantidad); guardar(s);
    },
    async activar(id, activo){
      const s = leer(), p = s.productos.find(x => x.id === id); if (!p) return;
      p.activo = activo; guardar(s);
    }
  };
})();

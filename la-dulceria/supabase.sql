-- La Dulcería: base de datos para la carta por mesa y el panel del local.
-- Pégalo completo en Supabase > SQL Editor > New query y pulsa "Run".
-- Se puede volver a ejecutar: no borra pedidos ni productos que ya existan.

-- ---------- Tablas ----------

create table if not exists productos (
  id          text primary key,
  nombre      text not null,
  descripcion text not null default '',
  categoria   text not null,
  precio      integer not null check (precio >= 0),
  stock       integer not null default 0 check (stock >= 0),
  bandeja     integer not null default 10 check (bandeja > 0),  -- porciones que entran al reponer
  color       text not null default '#B9783F',
  sigla       text not null default '',
  orden       integer not null default 0,
  activo      boolean not null default true
);

create table if not exists pedidos (
  id      uuid primary key,
  mesa    integer not null,
  items   jsonb not null,                                  -- [{id, nombre, cantidad, precio}] copiado al momento de pedir
  nota    text not null default '' check (length(nota) <= 200),
  total   integer not null check (total >= 0),
  estado  text not null default 'nuevo' check (estado in ('nuevo','preparando','listo','entregado','cancelado')),
  pago    text check (pago in ('pago_movil','efectivo','punto')),
  creado  timestamptz not null default now()
);
create index if not exists pedidos_creado on pedidos (creado desc);

-- Correos de las personas que pueden entrar al panel
create table if not exists personal (
  email text primary key
);

-- ---------- Seguridad ----------
-- Los clientes (sin cuenta) solo pueden leer la carta y pedir por medio de hacer_pedido.
-- Solo los correos de la tabla "personal" ven y procesan pedidos.

create or replace function es_personal() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from personal where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

alter table productos enable row level security;
alter table pedidos   enable row level security;
alter table personal  enable row level security;

drop policy if exists "carta visible para todos" on productos;
create policy "carta visible para todos" on productos for select using (true);

drop policy if exists "personal edita productos" on productos;
create policy "personal edita productos" on productos for update to authenticated
  using (es_personal()) with check (es_personal());

drop policy if exists "personal ve pedidos" on pedidos;
create policy "personal ve pedidos" on pedidos for select to authenticated using (es_personal());

drop policy if exists "personal actualiza pedidos" on pedidos;
create policy "personal actualiza pedidos" on pedidos for update to authenticated
  using (es_personal()) with check (es_personal());

-- ---------- Funciones ----------

-- El cliente envía solo productos y cantidades. Precios, total y stock se calculan aquí,
-- así nadie puede mandar un precio inventado ni pedir más de lo que hay en la vitrina.
create or replace function hacer_pedido(p_id uuid, p_mesa integer, p_items jsonb, p_nota text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod productos; cant integer;
  lineas jsonb := '[]'::jsonb; tot integer := 0;
begin
  if p_mesa is null or p_mesa not between 1 and 8 then  -- número de mesas: debe coincidir con config.js
    raise exception 'Esta mesa no existe. Escanea el QR de tu mesa.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tu pedido está vacío.';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'El pedido tiene demasiados productos.';
  end if;
  if (select count(*) from pedidos where mesa = p_mesa and estado = 'nuevo') >= 5 then
    raise exception 'Tu mesa ya tiene pedidos esperando confirmación. Espera un momento.';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    cant := (it ->> 'cantidad')::integer;
    if cant is null or cant < 1 or cant > 20 then
      raise exception 'Cantidad no válida.';
    end if;
    select * into prod from productos where id = it ->> 'id' and activo for update;
    if not found then
      raise exception 'Uno de los productos ya no está disponible.';
    end if;
    if prod.stock < cant then
      raise exception 'Solo quedan % de %.', prod.stock, prod.nombre;
    end if;
    update productos set stock = stock - cant where id = prod.id;
    lineas := lineas || jsonb_build_object('id', prod.id, 'nombre', prod.nombre, 'cantidad', cant, 'precio', prod.precio);
    tot := tot + cant * prod.precio;
  end loop;

  insert into pedidos (id, mesa, items, nota, total)
  values (p_id, p_mesa, lineas, left(coalesce(p_nota, ''), 200), tot);
end $$;

-- El cliente consulta el estado de sus propios pedidos con el código que generó su teléfono.
create or replace function estado_pedidos(p_ids uuid[])
returns table (id uuid, estado text, total integer, items jsonb, creado timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.estado, p.total, p.items, p.creado
  from pedidos p
  where p.id = any (p_ids[1:10])
  order by p.creado desc;
$$;

-- Rechazar un pedido devuelve sus porciones a la vitrina.
create or replace function cancelar_pedido(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ped pedidos; it jsonb;
begin
  if not es_personal() then raise exception 'No autorizado.'; end if;
  select * into ped from pedidos where id = p_id for update;
  if not found or ped.estado in ('entregado', 'cancelado') then return; end if;
  for it in select * from jsonb_array_elements(ped.items) loop
    update productos set stock = stock + (it ->> 'cantidad')::integer where id = it ->> 'id';
  end loop;
  update pedidos set estado = 'cancelado' where id = p_id;
end $$;

create or replace function reponer(p_id text, p_cantidad integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_personal() then raise exception 'No autorizado.'; end if;
  update productos set stock = greatest(0, stock + p_cantidad) where id = p_id;
end $$;

revoke execute on function cancelar_pedido(uuid) from anon;
revoke execute on function reponer(text, integer) from anon;

-- ---------- Tiempo real ----------
do $$ begin
  alter publication supabase_realtime add table pedidos;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table productos;
exception when duplicate_object then null; end $$;

-- ---------- Carta inicial (cámbiala cuando quieras desde Table Editor) ----------
insert into productos (id, nombre, descripcion, categoria, precio, stock, bandeja, color, sigla, orden) values
  ('tres',  'Torta tres leches',     'Bizcocho empapado y merengue tostado.',    'Tortas',    5500,  9, 12, '#D9B38A', '3L', 1),
  ('choco', 'Torta de chocolate',    'Húmeda, con ganache de cacao al 60 %.',    'Tortas',    6000,  6, 12, '#5A3320', 'Ch', 2),
  ('zana',  'Torta de zanahoria',    'Con nueces y frosting de queso crema.',    'Tortas',    5800,  7, 10, '#C9874D', 'Za', 3),
  ('ques',  'Quesillo',              'Flan de la casa con caramelo oscuro.',     'Fríos',     4200, 10, 12, '#C88A3E', 'Qs', 4),
  ('marq',  'Marquesa de chocolate', 'Capas de galleta María y crema de cacao.', 'Fríos',     5800,  4,  8, '#6B4029', 'Mq', 5),
  ('chees', 'Cheesecake de fresa',   'Base de galleta y coulis de fresa.',       'Fríos',     6500,  6, 10, '#B7655A', 'Cc', 6),
  ('bien',  'Bienmesabe',            'Crema de coco, bizcochuelo y canela.',     'Fríos',     5000,  5,  8, '#E1C9A5', 'Bm', 7),
  ('golf',  'Golfeado con queso',    'Papelón, anís y queso de mano.',           'Horneados', 4800,  8, 12, '#A9673A', 'Gf', 8),
  ('alfa',  'Alfajores x3',          'Rellenos de arequipe y coco rallado.',     'Horneados', 4000, 12, 15, '#D7A46E', 'Af', 9),
  ('galle', 'Galletas de avena x4',  'Con pasas y un toque de canela.',          'Horneados', 3200, 10, 15, '#B98A56', 'Ga', 10),
  ('cafe',  'Café con leche',        'Espresso doble y leche cremada.',          'Bebidas',   2500, 40, 40, '#8A5A3A', 'Cl', 11),
  ('choc',  'Chocolate caliente',    'Cacao venezolano y un toque de canela.',   'Bebidas',   3200, 30, 30, '#4E2C1A', 'Ca', 12)
on conflict (id) do nothing;

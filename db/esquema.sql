-- Esquema de la App de Entrenamiento (Postgres / Supabase)
-- RLS activado sin políticas: las tablas NO son accesibles con la clave pública de Supabase;
-- solo la API (función de Netlify) accede, con la conexión directa a la base.

create table if not exists usuarios (
  id serial primary key,
  ci text unique not null,
  nombre text not null,
  rol text not null check (rol in ('entrenador','alumno')),
  pass_hash text not null,
  activo boolean not null default true,
  edad integer, objetivo text, nivel text, meta text, telefono text, observaciones text,
  ficha jsonb not null default '{}'::jsonb,
  creado timestamptz not null default now()
);
create table if not exists sesiones (
  token text primary key,
  usuario_id integer not null references usuarios(id) on delete cascade,
  creado timestamptz not null default now()
);
create table if not exists ejercicios (id serial primary key, nombre text not null, grupo text not null, video text);
create table if not exists planes (id serial primary key, nombre text not null, descripcion text, dias jsonb not null default '[]'::jsonb, creado timestamptz not null default now());
create table if not exists rutinas (
  id serial primary key,
  alumno_id integer not null references usuarios(id) on delete cascade,
  fecha date not null, titulo text, enfoque text, notas text,
  items jsonb not null default '[]'::jsonb,
  plan_id integer, hecha boolean not null default false, comentario_alumno text,
  creado timestamptz not null default now()
);
create index if not exists ix_rutinas_alumno_fecha on rutinas(alumno_id, fecha);
create table if not exists mediciones (id serial primary key, alumno_id integer not null references usuarios(id) on delete cascade, fecha date not null, datos jsonb not null);
create index if not exists ix_mediciones_alumno on mediciones(alumno_id);
create table if not exists fotos (id serial primary key, alumno_id integer not null references usuarios(id) on delete cascade, fecha date not null, tipo text not null, mime text not null, data bytea not null);
create index if not exists ix_fotos_alumno on fotos(alumno_id);
create table if not exists pagos (id serial primary key, alumno_id integer not null references usuarios(id) on delete cascade, fecha date not null, monto double precision, estado text, nota text);
create index if not exists ix_pagos_alumno on pagos(alumno_id);
create table if not exists cancelaciones (id serial primary key, alumno_id integer not null references usuarios(id) on delete cascade, fecha date not null, nota text);
create index if not exists ix_cancelaciones_alumno on cancelaciones(alumno_id);
create table if not exists alimentos (id serial primary key, nombre text not null, grupo text not null, porcion double precision not null, unidad text not null, kcal double precision, prot double precision, carb double precision, grasa double precision, nota text);
create table if not exists dietas (alumno_id integer primary key references usuarios(id) on delete cascade, datos jsonb not null);
create table if not exists config (clave text primary key, valor text);
create index if not exists ix_sesiones_usuario on sesiones(usuario_id);

alter table usuarios enable row level security;
alter table sesiones enable row level security;
alter table ejercicios enable row level security;
alter table planes enable row level security;
alter table rutinas enable row level security;
alter table mediciones enable row level security;
alter table fotos enable row level security;
alter table pagos enable row level security;
alter table cancelaciones enable row level security;
alter table alimentos enable row level security;
alter table dietas enable row level security;
alter table config enable row level security;

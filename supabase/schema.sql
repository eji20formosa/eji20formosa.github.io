-- EJI N.º 20 - Esquema inicial de Supabase
-- Ejecutar completo en Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'teacher' check (role in ('teacher','director')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 3 and 2000),
  event_date date not null,
  created_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 'teacher')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_photos enable row level security;

create or replace function public.is_director()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'director'
  );
$$;

-- Los perfiles solo pueden ser leídos por su titular o por dirección.
drop policy if exists "profiles_read_self_or_director" on public.profiles;
create policy "profiles_read_self_or_director" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_director());

-- El usuario no puede cambiar su propio rol. Dirección puede actualizar perfiles.
drop policy if exists "profiles_update_director" on public.profiles;
create policy "profiles_update_director" on public.profiles
for update to authenticated
using (public.is_director())
with check (public.is_director());

-- Cualquier visitante ve solamente eventos publicados.
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events
for select to anon, authenticated
using (status = 'published' or created_by = (select auth.uid()) or public.is_director());

-- Docentes y dirección pueden crear publicaciones propias. Docentes quedan pendientes.
drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own" on public.events
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (public.is_director() and status = 'published')
    or (not public.is_director() and status = 'pending')
  )
);

-- Solo dirección puede aprobar/rechazar.
drop policy if exists "events_update_director" on public.events;
create policy "events_update_director" on public.events
for update to authenticated
using (public.is_director())
with check (public.is_director());

-- Dirección puede eliminar eventos; cada docente puede borrar los propios.
drop policy if exists "events_delete_own_or_director" on public.events;
create policy "events_delete_own_or_director" on public.events
for delete to authenticated
using (created_by = (select auth.uid()) or public.is_director());

drop policy if exists "photos_public_read" on public.event_photos;
create policy "photos_public_read" on public.event_photos
for select to anon, authenticated
using (
  exists (select 1 from public.events e where e.id = event_id and e.status = 'published')
  or uploaded_by = (select auth.uid())
  or public.is_director()
);

drop policy if exists "photos_insert_own" on public.event_photos;
create policy "photos_insert_own" on public.event_photos
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.created_by = (select auth.uid())
  )
);

drop policy if exists "photos_delete_own_or_director" on public.event_photos;
create policy "photos_delete_own_or_director" on public.event_photos
for delete to authenticated
using (uploaded_by = (select auth.uid()) or public.is_director());

-- Crear bucket público para que las fotos aprobadas se vean en la web.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "event_photos_authenticated_upload" on storage.objects;
create policy "event_photos_authenticated_upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "event_photos_owner_or_director_delete" on storage.objects;
create policy "event_photos_owner_or_director_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'event-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_director()
  )
);

-- IMPORTANTE: luego de crear la primera cuenta de la directora,
-- ejecutá esta sentencia reemplazando el correo:
-- update public.profiles p set role='director'
-- from auth.users u where p.id=u.id and u.email='CORREO_DIRECTORA';


-- ENUM rôles
create type public.app_role as enum ('admin', 'employee');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role (security definer)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;

-- suppliers
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  stock_quantity integer not null default 0,
  min_stock integer not null default 0,
  dimensions text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;

-- stock_movements
create type public.movement_type as enum ('in', 'out');
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type movement_type not null,
  quantity integer not null check (quantity > 0),
  reason text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.stock_movements enable row level security;

-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- Auto-update product stock on movement insert
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'in' then
    update public.products set stock_quantity = stock_quantity + new.quantity where id = new.product_id;
  else
    update public.products set stock_quantity = stock_quantity - new.quantity where id = new.product_id;
  end if;
  return new;
end; $$;
create trigger trg_apply_stock_movement after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Handle new user: create profile + default employee role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'employee');
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Admins view all profiles" on public.profiles for select using (public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- user_roles
create policy "Users view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- categories
create policy "Authenticated read categories" on public.categories for select to authenticated using (true);
create policy "Admins manage categories" on public.categories for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- suppliers
create policy "Authenticated read suppliers" on public.suppliers for select to authenticated using (true);
create policy "Admins manage suppliers" on public.suppliers for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- products
create policy "Authenticated read products" on public.products for select to authenticated using (true);
create policy "Admins manage products" on public.products for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- stock_movements
create policy "Authenticated read movements" on public.stock_movements for select to authenticated using (true);
create policy "Authenticated insert movements" on public.stock_movements for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins manage movements" on public.stock_movements for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

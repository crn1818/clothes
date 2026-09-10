-- =============================================================================
-- Croma — esquema para o modo rede (vários usuários, feed compartilhado)
-- =============================================================================
--
-- Sem um projeto Supabase configurado, o Croma roda local: cada pessoa vê o
-- próprio Croma, guardado no IndexedDB do navegador dela. Aplicando este
-- arquivo e ligando o modo rede em Ajustes, ele vira rede de verdade — contas,
-- feed compartilhado e fotos no storage. O cliente já sabe falar com tudo isto
-- (`src/lib/rede.ts`); as tabelas espelham o modelo de `src/lib/types.ts`.
--
-- Como aplicar:
--   1. Crie um projeto em https://supabase.com
--   2. SQL Editor → cole este arquivo → Run
--   3. Storage → confira que o bucket `looks` apareceu
--   4. No Croma, Ajustes → Modo rede → cole a URL e a anon key
--
-- Pode rodar mais de uma vez: tudo aqui é idempotente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  handle     text unique not null check (handle ~ '^[a-z0-9._]{2,24}$'),
  nome       text not null,
  bio        text not null default '',
  cidade     text not null default '',
  -- Avatar é um degradê de duas cores, igual ao app local.
  avatar     text[] not null default array['#C97F4E', '#5E7C8B'],
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Looks
-- ---------------------------------------------------------------------------

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  caption    text not null default '',

  -- Caminhos no bucket `looks`. Guardar os dois evita baixar 2 MB para
  -- desenhar uma miniatura de 120px na grade do perfil.
  image_path text not null,
  thumb_path text not null,
  width      int  not null,
  height     int  not null,
  bytes      int  not null,
  mime       text not null,

  -- Saída do extrator de paleta: [{hex, name, family, share}, ...]
  cores      jsonb not null default '[]'::jsonb,
  -- Clima ('terrosa', 'vibrante'...) e matizes ('azul', 'marrom'...).
  -- Colunas próprias, e não campos dentro do jsonb, porque é por elas que o
  -- filtro do feed consulta — e array + índice GIN responde na hora.
  familias   text[] not null default '{}',
  matizes    text[] not null default '{}',
  descricao  text not null default '',

  created_at timestamptz not null default now()
);

create index if not exists posts_recentes_idx  on public.posts (created_at desc);
create index if not exists posts_autor_idx     on public.posts (author_id, created_at desc);
create index if not exists posts_familias_idx  on public.posts using gin (familias);
create index if not exists posts_matizes_idx   on public.posts using gin (matizes);

-- ---------------------------------------------------------------------------
-- Peças etiquetadas na foto
-- ---------------------------------------------------------------------------

create table if not exists public.pins (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null references public.posts(id) on delete cascade,

  -- Coordenadas normalizadas, não pixels: a mesma marcação precisa cair no
  -- lugar certo no feed, na grade e em tela cheia, que têm larguras diferentes.
  x real not null check (x >= 0 and x <= 1),
  y real not null check (y >= 0 and y <= 1),

  peca      text not null,
  categoria text not null default 'outro'
            check (categoria in ('top','calca','vestido','casaco','calcado',
                                 'bolsa','acessorio','joia','outro')),
  marca     text not null default '',
  onde      text not null default '',
  preco     text not null default '',
  link      text not null default ''
);

create index if not exists pins_post_idx on public.pins (post_id);

-- ---------------------------------------------------------------------------
-- Camada social
-- ---------------------------------------------------------------------------

create table if not exists public.curtidas (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.salvos (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.seguidores (
  seguidor_id uuid not null references public.profiles(id) on delete cascade,
  seguido_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);

-- Feed pronto, com as contagens já resolvidas.
--
-- security_invoker faz a view rodar com as permissões de quem consulta, e não
-- com as do dono. Sem isso ela contornaria o RLS silenciosamente — hoje seria
-- inofensivo (posts são públicos), mas viraria um furo no dia em que alguém
-- acrescentasse aqui uma coluna vinda de tabela restrita.
create or replace view public.feed with (security_invoker = on) as
select
  p.*,
  coalesce((select count(*) from public.curtidas c where c.post_id = p.id), 0) as curtidas,
  coalesce((select count(*) from public.pins    n where n.post_id = p.id), 0) as pecas
from public.posts p;

-- ---------------------------------------------------------------------------
-- Perfil automático ao criar conta
-- ---------------------------------------------------------------------------

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle, nome)
  values (
    new.id,
    -- Handle provisório a partir do e-mail; a pessoa troca depois no perfil.
    regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9._]', '', 'g')
      || substr(replace(new.id::text, '-', ''), 1, 4),
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Regra geral: todo mundo lê (é uma rede social pública), cada um só escreve
-- no que é seu. Sem isso, a chave anônima que vai no navegador permitiria
-- apagar o post de qualquer pessoa.
-- ---------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.posts      enable row level security;
alter table public.pins       enable row level security;
alter table public.curtidas   enable row level security;
alter table public.salvos     enable row level security;
alter table public.seguidores enable row level security;

drop policy if exists "perfis visíveis" on public.profiles;
create policy "perfis visíveis"        on public.profiles for select using (true);
drop policy if exists "edito meu perfil" on public.profiles;
create policy "edito meu perfil"       on public.profiles for update using (auth.uid() = id);

drop policy if exists "looks visíveis" on public.posts;
create policy "looks visíveis"         on public.posts for select using (true);
drop policy if exists "publico meus looks" on public.posts;
create policy "publico meus looks"     on public.posts for insert with check (auth.uid() = author_id);
drop policy if exists "edito meus looks" on public.posts;
create policy "edito meus looks"       on public.posts for update using (auth.uid() = author_id);
drop policy if exists "apago meus looks" on public.posts;
create policy "apago meus looks"       on public.posts for delete using (auth.uid() = author_id);

drop policy if exists "peças visíveis" on public.pins;
create policy "peças visíveis"         on public.pins for select using (true);
drop policy if exists "etiqueto meus looks" on public.pins;
create policy "etiqueto meus looks"    on public.pins for all
  using (exists (select 1 from public.posts p
                 where p.id = pins.post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p
                      where p.id = pins.post_id and p.author_id = auth.uid()));

drop policy if exists "curtidas visíveis" on public.curtidas;
create policy "curtidas visíveis"      on public.curtidas for select using (true);
drop policy if exists "curto e descurto" on public.curtidas;
create policy "curto e descurto"       on public.curtidas for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Salvos são privados: o que você guarda é da sua conta e de mais ninguém.
drop policy if exists "vejo o que salvei" on public.salvos;
create policy "vejo o que salvei"      on public.salvos for select using (auth.uid() = user_id);
drop policy if exists "salvo e desfaço" on public.salvos;
create policy "salvo e desfaço"        on public.salvos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "seguidores visíveis" on public.seguidores;
create policy "seguidores visíveis"    on public.seguidores for select using (true);
drop policy if exists "sigo e deixo de seguir" on public.seguidores;
create policy "sigo e deixo de seguir" on public.seguidores for all
  using (auth.uid() = seguidor_id) with check (auth.uid() = seguidor_id);

-- ---------------------------------------------------------------------------
-- Storage das fotos
--
-- Cada pessoa escreve só dentro da própria pasta (`<user_id>/...`), que é o
-- que o cliente deve usar ao montar o caminho do upload.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('looks', 'looks', true)
on conflict (id) do nothing;

drop policy if exists "fotos visíveis" on storage.objects;
create policy "fotos visíveis" on storage.objects for select
  using (bucket_id = 'looks');

drop policy if exists "envio para a minha pasta" on storage.objects;
create policy "envio para a minha pasta" on storage.objects for insert
  with check (
    bucket_id = 'looks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "apago da minha pasta" on storage.objects;
create policy "apago da minha pasta" on storage.objects for delete
  using (
    bucket_id = 'looks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- criar_perfil() é gatilho, não endpoint
--
-- Sendo SECURITY DEFINER e morando no schema `public`, ela fica exposta em
-- /rest/v1/rpc/criar_perfil para anon e authenticated — foi o que o linter de
-- segurança do Supabase apontou. O gatilho continua funcionando sem EXECUTE
-- para esses papéis: ele roda como dono da tabela.
-- ---------------------------------------------------------------------------

revoke execute on function public.criar_perfil() from public;
revoke execute on function public.criar_perfil() from anon;
revoke execute on function public.criar_perfil() from authenticated;

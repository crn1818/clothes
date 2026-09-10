/**
 * Credenciais públicas do projeto Supabase deste app.
 *
 * Estão em código, versionadas, e isso é deliberado. A chave
 * `sb_publishable_` é feita para ir dentro do JavaScript que todo visitante
 * baixa — escondê-la do repositório não a esconderia de ninguém. Quem protege
 * os dados é o Row Level Security de `supabase/schema.sql`, verificado contra
 * o projeto real: insert anônimo em `posts` volta `42501`.
 *
 * **Nunca ponha aqui a `service_role` key.** Essa ignora o RLS inteiro.
 *
 * Por que aqui e não em `.env.production`: o arquivo estava commitado e
 * funcionava no build local, mas o build da Vercel saiu sem as duas variáveis
 * e o app publicado subiu em modo local — feed vazio, sem tela de entrada.
 * Constante em código não depende de o host repassar `.env` nenhum, então
 * funciona igual em qualquer lugar. As variáveis `VITE_*` continuam valendo e
 * têm prioridade, para quem quiser apontar para outro projeto sem editar isto.
 */
export const REDE_PADRAO = {
  url: 'https://skqdbvswmmfzqcedtrgi.supabase.co',
  anonKey: 'sb_publishable_xHlzP6F8xFnx21uewBLWwg_DGzXUuPD',
} as const;

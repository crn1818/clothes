import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * O SDK do Supabase entra por `import()` e não pelo topo do arquivo.
 *
 * São ~90 KB comprimidos que só servem no modo rede. Deixá-los no pacote
 * principal faria todo mundo que usa o Croma local baixar o dobro do app para
 * nada — e a primeira abertura é justamente onde ele precisa parecer aplicativo
 * e não site. O tipo acima é `import type`, apagado na compilação.
 */

/**
 * Configuração do modo rede.
 *
 * As credenciais vêm de dois lugares, nesta ordem:
 *  1. variáveis do build (`.env`: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 *  2. localStorage, preenchido pela tela de Ajustes
 *
 * Sem nenhuma das duas o Croma roda local, e é isso que faz a versão publicada
 * funcionar para quem só quer olhar: não existe estado "configurando", existe
 * um app inteiro que funciona sozinho e um botão para ligá-lo na rede.
 *
 * A anon key é pública por natureza — ela vai no bundle do navegador de
 * qualquer jeito. Quem protege os dados é o RLS do `supabase/schema.sql`,
 * nunca o segredo da chave.
 */

const LS_URL = 'croma.supabase.url';
const LS_KEY = 'croma.supabase.anonKey';

export interface ConfigRede {
  url: string;
  anonKey: string;
}

function doAmbiente(): ConfigRede | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url, anonKey } : null;
}

export function lerConfig(): ConfigRede | null {
  const env = doAmbiente();
  if (env) return env;

  try {
    const url = localStorage.getItem(LS_URL);
    const anonKey = localStorage.getItem(LS_KEY);
    if (url && anonKey) return { url, anonKey };
  } catch {
    /* localStorage bloqueado (janela anônima, cookies desligados) */
  }
  return null;
}

/** O `.env` vence a tela de Ajustes; nesse caso não faz sentido deixar editar. */
export function configFixaNoBuild(): boolean {
  return doAmbiente() !== null;
}

export function salvarConfig(cfg: ConfigRede): void {
  localStorage.setItem(LS_URL, cfg.url.trim().replace(/\/+$/, ''));
  localStorage.setItem(LS_KEY, cfg.anonKey.trim());
  cliente = null;
}

export function limparConfig(): void {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
  cliente = null;
}

let cliente: SupabaseClient | null = null;

/**
 * Cria o cliente, baixando o SDK na primeira vez.
 *
 * Chamada uma vez na abertura do app quando o modo é rede; daí em diante todo
 * o resto do código usa `sb()`, que é síncrono.
 */
export async function iniciarCliente(): Promise<SupabaseClient | null> {
  if (cliente) return cliente;
  const cfg = lerConfig();
  if (!cfg) return null;

  const { createClient } = await import('@supabase/supabase-js');
  cliente = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cliente;
}

/** Cliente já pronto — só chame depois de `iniciarCliente()`. */
export function sb(): SupabaseClient {
  if (!cliente) throw new Error('Modo rede não está configurado.');
  return cliente;
}

/** Se já existe cliente, sem tentar criar um. */
export function clienteAtual(): SupabaseClient | null {
  return cliente;
}

export function modoRede(): boolean {
  return lerConfig() !== null;
}

/** Valida o par URL + chave antes de gravar, para o erro aparecer na hora certa. */
export async function testarConfig(cfg: ConfigRede): Promise<string | null> {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url.trim())) {
    return 'A URL deve ser parecida com https://xxxxxxxx.supabase.co';
  }
  // Servem as duas: a publishable moderna (sb_publishable_…) e a anon legada
  // (JWT começando em eyJ). O SDK aceita ambas na mesma posição.
  if (cfg.anonKey.trim().length < 40) {
    return 'A chave parece curta demais — confira se copiou inteira.';
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const teste = createClient(cfg.url.trim().replace(/\/+$/, ''), cfg.anonKey.trim());
    // Uma leitura qualquer serve: se o schema não foi aplicado, o erro é claro.
    const { error } = await teste.from('profiles').select('id').limit(1);
    if (error) {
      if (error.message.includes('does not exist')) {
        return 'Conectou, mas as tabelas não existem. Rode o supabase/schema.sql no SQL Editor.';
      }
      return `O Supabase respondeu: ${error.message}`;
    }
    return null;
  } catch {
    return 'Não consegui falar com esse projeto. Confira a URL e a chave.';
  }
}

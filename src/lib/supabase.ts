import type { SupabaseClient } from '@supabase/supabase-js';
import { REDE_PADRAO } from './config-rede';

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
 * O app sobe em rede por padrão, apontando para o projeto de `config-rede.ts`.
 * Variáveis `VITE_*` do build sobrescrevem isso, a tela de Ajustes também, e
 * quem quiser o modo local (sem conta, tudo no navegador) desliga por lá.
 *
 * Depender só de `.env` mordeu: o arquivo estava versionado e o build local o
 * lia, mas o build da Vercel saiu sem as duas variáveis e o app publicado
 * subiu em modo local, com feed vazio e sem tela de entrada. Constante em
 * código não depende de o host repassar nada.
 */

const LS_URL = 'croma.supabase.url';
const LS_KEY = 'croma.supabase.anonKey';
const LS_LOCAL = 'croma.modoLocal';

export interface ConfigRede {
  url: string;
  anonKey: string;
}

function doAmbiente(): ConfigRede | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url, anonKey } : null;
}

function forcadoLocal(): boolean {
  try {
    return localStorage.getItem(LS_LOCAL) === '1';
  } catch {
    return false;
  }
}

/**
 * Ordem de precedência: pedido explícito de modo local, depois variáveis do
 * build, depois o que a tela de Ajustes gravou, e por fim o projeto padrão do
 * app. A última linha é o que garante que a versão publicada suba em rede
 * mesmo que o host não repasse nenhum `.env`.
 */
export function lerConfig(): ConfigRede | null {
  if (forcadoLocal()) return null;

  const env = doAmbiente();
  if (env) return env;

  try {
    const url = localStorage.getItem(LS_URL);
    const anonKey = localStorage.getItem(LS_KEY);
    if (url && anonKey) return { url, anonKey };
  } catch {
    /* localStorage bloqueado (janela anônima, cookies desligados) */
  }

  return { url: REDE_PADRAO.url, anonKey: REDE_PADRAO.anonKey };
}

/** Com credenciais vindas do build, editar por Ajustes não teria efeito. */
export function configFixaNoBuild(): boolean {
  return doAmbiente() !== null;
}

export function salvarConfig(cfg: ConfigRede): void {
  localStorage.setItem(LS_URL, cfg.url.trim().replace(/\/+$/, ''));
  localStorage.setItem(LS_KEY, cfg.anonKey.trim());
  localStorage.removeItem(LS_LOCAL);
  cliente = null;
}

/**
 * Volta para o modo local.
 *
 * Precisa gravar uma marca em vez de só apagar as chaves: como existe um
 * projeto padrão em código, apagar não faria o app esquecer nada.
 */
export function limparConfig(): void {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
  localStorage.setItem(LS_LOCAL, '1');
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

/*
 * Service worker do Croma.
 *
 * Existe por dois motivos: fazer o navegador oferecer "instalar" (sem ele o
 * manifest sozinho não basta) e deixar o app abrir sem rede — o que importa
 * porque, no modo local, o acervo inteiro já está no aparelho e seria absurdo
 * não conseguir olhar as próprias fotos no avião.
 *
 * Duas estratégias, escolhidas pelo tipo do pedido:
 *
 * - **Navegação: rede primeiro.** O HTML é o que aponta para os arquivos com
 *   hash no nome; servi-lo do cache faria uma versão nova nunca chegar.
 *   Offline, cai para a cópia guardada.
 * - **Resto: cache primeiro, revalidando atrás.** Os arquivos com hash no nome
 *   são imutáveis, então o cache está sempre certo e a tela pinta na hora.
 *
 * Pedidos para outros domínios (Supabase, fontes) passam direto: guardar
 * resposta de API em cache de app é fonte garantida de dado velho na tela.
 */

const CACHE = 'croma-v1';
const ESSENCIAL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ESSENCIAL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;

  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copia));
          return resposta;
        })
        .catch(() =>
          caches.match('/index.html').then((cache) => cache ?? Response.error()),
        ),
    );
    return;
  }

  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      const daRede = fetch(pedido)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() => guardado);

      return guardado || daRede;
    }),
  );
});

# Croma

Rede social do look do dia. Você posta a foto da roupa, o app **lê as cores
sozinho** e descreve a paleta em português, e você marca com uma bolinha de
onde é cada peça — quem passa o mouse (ou toca) vê a marca, o lugar e o preço.

- **Feed** — looks em ordem cronológica, cada um com a paleta embaixo da foto.
- **Paletas** — o mesmo acervo entrando pela cor: escolha "terrosa" ou "azuis" e
  veja tudo que bate.
- **Postar** — a paleta aparece ao lado da foto no instante em que ela entra.
- **Salvos** — o que você guardou, e a paleta que esses salvos formam juntos.
- **Perfil** — seus looks e "a sua paleta": as cores que você repete.

Feito com Vite + React + TypeScript. Sem framework de UI, sem biblioteca de
cor — o motor de paleta é próprio e está em `src/lib/color/`.

## Rodar

```bash
npm install
npm run dev
```

Abre em <http://127.0.0.1:5190>. Na primeira visita o app gera nove looks de
exemplo (leva uns segundos) para o feed não nascer vazio.

```bash
npm run build       # gera dist/
npm run typecheck
npm test            # testes do motor de cor
```

## Dois modos

O Croma funciona sozinho e vira rede quando você quiser:

| | **Local** (padrão) | **Rede** (Supabase) |
| --- | --- | --- |
| Onde ficam as fotos | IndexedDB do navegador | Storage do seu projeto |
| Quem vê | só você | todas as contas |
| Precisa de quê | nada | um projeto Supabase |
| Contas | nenhuma | e-mail e senha |

Não existe tela de "configurando": o app inteiro funciona antes de qualquer
credencial, e a rede se liga em **Ajustes → Modo rede** (ou por `.env`, veja
`.env.example`). Ver "Ligar o modo rede", abaixo.

## As três partes que importam

### 1. A paleta sai da roupa, não da parede

Esta é a parte difícil e é onde está quase todo o trabalho. Numa foto de corpo
inteiro o **fundo ocupa uns 70% do quadro** — qualquer contagem de cor por área
devolve a cor da parede, não do look. Três abordagens foram medidas antes de
chegar na que ficou:

| Abordagem | Resultado |
| --- | --- |
| Peso maior no centro da foto | Fundo ficava com 54–70% da paleta |
| Descartar o que é parecido com a cor da borda | Parede com degradê tem faixa de tons larga demais; saía um lilás acinzentado no lugar do tricô lavanda — a média entre roupa e parede, uma cor que não existe na foto |
| Descartar grupos que "moram" nas beiradas | A vinheta escurece as beiradas, então a parede clara do meio parecia central e sobrevivia com 70% |
| **Espalhamento a partir da moldura** | O que ficou |

O espalhamento (`marcarFundo`, em `src/lib/color/extract.ts`) parte das bordas
da imagem e caminha pixel a pixel. Cada passo compara um pixel com o **vizinho**:
num degradê a diferença entre vizinhos é ~0.003, então ele atravessa a parede
inteira; a borda de uma peça de roupa é um salto grande em um ou dois pixels, e
ele para ali.

Duas travas, ambas calibradas medindo o vazamento para dentro da figura:

- **Local (0.018)** — salto máximo entre vizinhos. Até 0.018 o fundo é coberto
  inteiro e a roupa fica intacta; de 0.025 em diante o espalhamento sobe a borda
  suavizada das peças e come metade do look.
- **Global (0.05)** — afastamento máximo da semente de onde o fundo chegou. Sem
  ela, num look pastel (tricô lavanda em parede rosa-clara) a borda suavizada
  vira uma escada de degraus pequenos e o espalhamento sobe a escada inteira:
  chegava a marcar 95% do quadro como fundo.

Só as sementes que dominam o anel externo abrem caminho, o que impede que um
ombro encostando na lateral do quadro vire porta de entrada para o fundo comer a
roupa toda. E há uma válvula: se sobrar menos de 6% da imagem, o critério é
descartado — melhor uma paleta imperfeita que paleta nenhuma.

O resultado, medido nos looks de exemplo: as cinco cores de cada paleta são as
peças de roupa, não o cenário.

O agrupamento em si é k-means em **OKLab**, o espaço de cor em que distância
numérica corresponde ao que o olho percebe. Em HSL um azul-marinho e um preto
ficam longe demais, e dois beges quase iguais ficam longe um do outro; nenhum
dos dois erros existe aqui. Cada cor recebe o nome mais próximo num dicionário
de ~110 termos de moda em português (`src/lib/color/names.ts`), denso onde roupa
costuma morar — bege, areia, camel, terracota, ferrugem, marsala, jeans, petróleo.

Quando duas cores caem no mesmo nome, elas viram "jeans claro" e "jeans escuro":
uma paleta que lista "jeans 23%, jeans 21%" parece defeito, não leitura.

**A pele também sai da paleta**, e pelo mesmo princípio do fundo: rastreabilidade,
não semelhança de cor. Casar por cor não funciona aqui, e a medição diz por quê —
toda tonalidade de pele fica a menos de 0.055 de alguma cor de roupa comum:

| Pele | Colide com | Distância |
| --- | --- | --- |
| Clara | nude · bege · trigo | 0.020 · 0.024 · 0.034 |
| Oliva | camel | 0.030 |
| Castanha | caramelo · tabaco | 0.048 · 0.050 |
| Marrom | tabaco · castanho | 0.013 · 0.040 |
| Muito escura | chocolate | 0.009 |

Com qualquer tolerância útil, "tirar o que parece pele" apagaria o casaco bege de
quem tem pele clara — e apagar uma peça do look é pior do que deixar pele na
paleta. Então o app acha a cor da pele **daquela pessoa**, no topo do corpo onde a
cabeça está, e dali espalha pixel a pixel. Rosto e pescoço saem juntos; uma peça
só cairia se encostasse no rosto *e* fosse da cor dele.

Achar o rosto custou três tentativas: agrupar a banda do topo em três e escolher o
grupo mais parecido com pele era uma loteria (num look de moletom cinza o k-means
juntou rosto e moletom num grupo só, e a referência não saía); a média de tudo que
parece pele misturava cabelo castanho com rosto e dava uma cor que não existe na
foto. O que funciona é filtrar por escore e separar os dois tons da cabeça por
luminosidade, escolhendo por **posição** — cabelo cobre o alto e as laterais, o
rosto fica embaixo e no eixo do corpo. Nos nove looks de exemplo a referência sai
com erro de 0.004 a 0.007.

Braço e perna, que o tecido separa do rosto, o espalhamento não alcança. Essas
cores são *apontadas* em vez de apagadas: o compositor as traz desmarcadas, com um
toque para devolver. Dá para separá-las de roupa parecida porque membro é
literalmente o mesmo tom do rosto (0.005–0.014 da referência) enquanto roupa
parecida fica bem mais longe (0.039 no camel, 0.044 na saia rosa-chá).

### 2. As bolinhas nas peças

Você toca na foto e diz o que é aquela peça, de que marca, de onde veio, quanto
custou e (se quiser) o link. No feed, a bolinha abre um cartão — **hover** no
desktop, **toque** no celular, porque `hover` simplesmente não existe lá.

O cartão nasce grudado na bolinha e é empurrado para dentro das bordas da foto,
e vira para cima quando o pino está na parte de baixo da imagem — que é onde
ficam sapatos, o caso mais comum. As coordenadas são normalizadas (0..1), não
pixels, então a mesma marcação cai no lugar certo no feed, na grade do perfil e
em tela cheia.

No compositor as bolinhas são arrastáveis; toque curto edita, arraste
reposiciona.

### 3. As fotos

Três decisões, em `src/lib/image.ts`:

- **Redução em etapas.** Ir de 4032px para 1800px num único `drawImage` joga
  fora 80% dos pixels sem olhar para eles, e tecido de trama fina (tricô, linho,
  jeans) vira ruído. Reduzir pela metade de cada vez faz o navegador tirar média
  em cada passo.
- **WebP em qualidade alta** (0.90–0.94), com JPEG de reserva. É onde estão as
  bordas de roupa.
- **`Blob` no IndexedDB, não base64 no `localStorage`.** Base64 infla 33% e o
  `localStorage` estoura em ~5 MB — três fotos e acabou.

Guarda-se a imagem cheia (até 2400px, configurável) e uma miniatura de 560px, e
o app pede armazenamento persistente para o navegador não limpar as fotos
sozinho quando o disco apertar. O compositor mostra o que foi guardado: pixels,
megapixels, tamanho do arquivo e quanto encolheu.

## Onde ficam as coisas

```
src/
  lib/
    color/
      oklab.ts          conversões sRGB ↔ OKLab ↔ OKLCh, distância perceptual
      names.ts          dicionário em português + famílias de matiz
      extract.ts        separação do fundo, k-means, nomeação  ← o núcleo
      extract.test.ts   os testes que guardam tudo isso
      palettes.ts       clima da paleta e a frase automática
    image.ts            decodificação, redução em etapas, WebP, miniatura
    idb.ts              IndexedDB (blobs), URLs, cota, limpeza     [local]
    rede.ts             o mesmo, contra Supabase                   [rede]
    supabase.ts         credenciais e cliente
    backup.ts           exportar e restaurar o acervo local
    looks.ts            croquis SVG dos looks de exemplo
    store.tsx           estado do app; escolhe local ou rede
    types.ts            o modelo de dados
  components/           cartão de post, bolinhas, paleta, grade, filtros, folhas
  views/                Feed, Explorar, Compor, Salvos, Perfil, Ajustes
  gates/Entrar.tsx      login e cadastro (só no modo rede)
public/sw.js            service worker: instalável e abre offline
supabase/schema.sql     tabelas, RLS e bucket do modo rede
```

## Os looks de exemplo

O feed nasce com nove looks marcados como **exemplo**. Eles não são fotos de
banco de imagem: são croquis desenhados em SVG (`src/lib/looks.ts`) que passam
pelo **mesmo pipeline das fotos de verdade** — mesma redução, mesma compressão,
mesmo extrator. As paletas que aparecem no feed são saída real do motor de cor,
não valores digitados à mão; se o extrator regredir, o feed de exemplo quebra
junto. Os degradês e a vinheta em cada croqui são de propósito: pano real não é
chapado, e imagem chapada faria o algoritmo parecer melhor do que é.

Dá para removê-los (e trazê-los de volta) em **Ajustes → Conteúdo de exemplo**.

## Onde os dados ficam

No modo local, tudo no navegador (IndexedDB): nada sai do aparelho, não há
servidor nem telemetria. Em janela anônima ou com cookies bloqueados o app
avisa que não consegue guardar nada.

Como "guardado no navegador" não é o mesmo que "guardado", **Ajustes → Backup**
baixa um `.json` único com perfil, looks, paletas, etiquetas e as fotos
embutidas, e restaura a partir dele. Restaurar não sobrescreve o que já existe:
looks com o mesmo id são pulados, para não apagar curtidas e salvos posteriores
ao backup.

## Modo rede: já ligado neste repositório

O app sobe apontando para um projeto Supabase real. As credenciais estão em
`src/lib/config-rede.ts`, em código e versionadas de propósito: a chave
`sb_publishable_` é pública por natureza — vai dentro do JavaScript que
qualquer visitante baixa. Quem protege os dados é o RLS, verificado contra o
projeto de verdade: insert anônimo em `posts` volta `42501`.

**Nunca ponha a `service_role` key ali** — essa ignora o RLS inteiro.

Ficaram em código, e não em `.env.production`, porque `.env` versionado
funcionava no build local mas **não chegou ao build da Vercel**: o app
publicado subiu em modo local, com feed vazio e sem tela de entrada. Constante
em código não depende de o host repassar arquivo nenhum.

Para apontar para outro projeto Supabase, na ordem de precedência:

1. Crie um projeto em <https://supabase.com>
2. SQL Editor → cole `supabase/schema.sql` → Run (pode rodar mais de uma vez)
3. Project Settings → API → copie a **URL** e a chave **publishable**
   (a `anon` legada em JWT também serve)
4. Use **Ajustes → Modo rede** no app (não precisa rebuildar), ou defina
   `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no build, ou edite
   `config-rede.ts`

Para voltar ao modo local (sem conta, tudo no navegador): **Ajustes → Modo
rede → Desligar**.

O que o schema cria: perfis, looks, peças etiquetadas, curtidas, salvos,
seguidores, a view `feed` com as contagens resolvidas, RLS por dono em tudo e o
bucket `looks` com política de pasta por usuário. Ligado o modo rede, o app pede
login (e-mail e senha), publica no storage e lê o feed compartilhado —
`src/lib/rede.ts` é o gêmeo remoto de `src/lib/idb.ts`, com as mesmas operações.

A anon key é pública por natureza: ela vai no bundle do navegador de qualquer
jeito. Quem protege os dados é o RLS, nunca o segredo da chave.

O extrator de paleta continua rodando no navegador de quem posta, nos dois
modos — é barato e evita processar imagem no servidor.

## Limitações conhecidas

- **Roupa da cor exata da parede** (camisa branca em parede branca) derruba a
  separação de fundo; a válvula de segurança devolve a paleta do quadro inteiro,
  então a parede entra na conta. Por isso o compositor deixa desmarcar
  manualmente uma cor que veio do fundo.
- **Pele e peça podem virar uma cor só.** Quando estão perto demais — casaco camel
  encostando em perna à mostra, 0.030 entre os dois — o agrupamento funde as duas
  e nada feito depois separa. Nesse caso o app prefere manter: melhor pele na
  paleta do que o look sem paleta.
- **Sem rosto visível não há remoção de pele.** Flat lay, foto só da peça ou corpo
  cortado não dão referência, e aí nada é removido — que é o certo.
- **HEIC** (padrão do iPhone) não é decodificado pelo navegador. O app avisa e
  pede JPG, PNG, WebP ou AVIF.
- Não há comentários nem seguir de verdade — a camada social é curtir e salvar.
  A tabela `seguidores` existe no schema, a interface não.
- Não dá para editar um look publicado, só apagar.
- No modo rede, os caminhos **autenticados** (cadastro, publicar, curtir,
  salvar) ainda não foram exercitados de ponta a ponta. O que foi verificado
  contra o projeto real: conexão, leitura das seis tabelas e da view, o bucket
  respondendo, e o RLS recusando escrita anônima.

## Publicar

O caminho recomendado é importar este repositório em
<https://vercel.com/new>: o Vite é detectado sozinho e as credenciais já estão
no código, então não há variável de ambiente para configurar. Feito isso, todo
`git push` na `main` vira deploy.

Se o projeto vier com **Deployment Protection** ligada, desligue em Project
Settings → Deployment Protection; com ela, só quem está logado na sua conta
Vercel abre o site.

Alternativa sem git, enviando `dist/` pela API REST:

```bash
powershell -ExecutionPolicy Bypass -File deploy-vercel.ps1 -Token SEU_TOKEN
```

O token sai de <https://vercel.com/account/settings/tokens>.

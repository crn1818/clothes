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

## Ligar o modo rede

1. Crie um projeto em <https://supabase.com>
2. SQL Editor → cole `supabase/schema.sql` → Run (pode rodar mais de uma vez)
3. Project Settings → API → copie a **URL** e a **anon key**
4. No Croma: **Ajustes → Modo rede → Ligar** e cole as duas

Ou, para deixar fixo no build, ponha as duas em `.env` (veja `.env.example`).

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
- **Pele entra na paleta** quando há bastante pele à mostra. É uma cor que está
  mesmo na foto, e tirá-la exigiria detecção de pessoa; dá para desmarcar.
- **HEIC** (padrão do iPhone) não é decodificado pelo navegador. O app avisa e
  pede JPG, PNG, WebP ou AVIF.
- Não há comentários nem seguir de verdade — a camada social é curtir e salvar.
  A tabela `seguidores` existe no schema, a interface não.
- Não dá para editar um look publicado, só apagar.
- O modo rede foi escrito e tipado, mas **nunca rodou contra um projeto
  Supabase de verdade** — o local foi verificado tela a tela, o remoto não.

## Publicar

```bash
powershell -ExecutionPolicy Bypass -File deploy-vercel.ps1 -Token SEU_TOKEN
```

Roda o build e envia `dist/` para a Vercel. O token sai de
<https://vercel.com/account/settings/tokens>.

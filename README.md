# CraftTogether 🎮🟩

App mobile (**Android + iOS**) para **encontrar salas e jogar o seu Minecraft
(Bedrock) com amigos** — mesmo quando vocês estão em redes/internets diferentes.

Cada pessoa usa o **seu próprio Minecraft**, comprado e instalado. O CraftTogether
**não é o jogo** e **não inclui nem modifica nenhum arquivo do Minecraft**: ele só
cuida da **conexão** entre os aparelhos, usando recursos que o jogo já oferece
("Visível para jogadores da LAN" e "Adicionar servidor").

> ⚖️ **Aviso:** projeto não-oficial, sem vínculo com a Mojang Studios ou a
> Microsoft. "Minecraft" é marca da Mojang Synergies AB. Use apenas cópias do jogo
> legalmente adquiridas. Sem pirataria.

---

## Como funciona

```
 Amigo (convidado)                    Nuvem                     Você (host)
┌──────────────────┐          ┌──────────────────┐        ┌──────────────────┐
│  Minecraft       │          │   Relay UDP      │        │  Minecraft       │
│  (Add Server →   │  UDP     │  (encaminha      │  UDP   │  (mundo com LAN  │
│  127.0.0.1:porta)│◄────────►│   pacotes por    │◄──────►│   ligada, :19132)│
│      ▲           │          │   código/sessão) │        │      ▲           │
│  proxy local     │          └──────────────────┘        │  proxy local     │
│  (app)           │                  ▲                    │  (app)           │
└──────────────────┘                  │ matchmaking +      └──────────────────┘
                                       │ sinalização (REST + WebSocket)
```

- **Mesma Wi-Fi:** o mundo do host aparece direto na aba **Amigos** do Minecraft
  (descoberta LAN nativa). O app só ajuda a achar/organizar.
- **Redes diferentes:** o app cria uma **ponte** via um **relay UDP** na nuvem. O
  convidado adiciona um servidor apontando para o **proxy local** do app; os pacotes
  do jogo viajam pelo relay até o mundo do host. O relay **não lê nem altera** nada
  do jogo — só repassa bytes.

## Estrutura do repositório (monorepo pnpm)

```
crafttogether/
├── app/              # App Expo (React Native + TypeScript) — Android & iOS
│   ├── app/          # telas (expo-router): index, create, rooms, room/[id], friends, guide
│   └── src/          # api, net (udpProxy, signaling, lanDiscovery), state, ui, theme
├── server/           # Backend TypeScript
│   ├── src/http.ts       # REST: criar/listar/entrar salas, sair (Fastify)
│   ├── src/signaling.ts  # WebSocket de sinalização (estado da sala, relay-ready)
│   ├── src/relay.ts      # relay UDP (dgram) — encaminha pacotes por token
│   ├── src/store.ts      # registro de salas em memória
│   └── test/             # testes (relay ponta a ponta + matchmaking)
└── packages/shared/  # tipos + protocolo compartilhados (código de sala, frames do relay)
```

## Rodando localmente

**Pré-requisitos:** Node 20+, pnpm 10+. Para o app: Android Studio / Xcode (ou um
aparelho físico com o [Expo Dev Client](https://docs.expo.dev/develop/development-builds/introduction/)).
O app usa `react-native-udp` (código nativo), então **não roda no Expo Go** — use um
Dev Client ou uma build.

```bash
pnpm install

# 1) Backend (matchmaking + sinalização + relay UDP)
cp .env.example .env
pnpm server:dev            # http://localhost:8080, ws://localhost:8080/ws, relay udp:19133

# 2) App (em outro terminal)
#    Aponte o app para o backend. Em um aparelho físico use o IP LAN do seu PC:
export EXPO_PUBLIC_API_URL="http://SEU_IP_LOCAL:8080"
pnpm --filter @crafttogether/app prebuild      # gera android/ e ios/
pnpm --filter @crafttogether/app android       # ou: ios
```

### Verificação automática (o que dá para testar sem o jogo)

```bash
pnpm -r typecheck   # tipos de app, server e shared
pnpm -r lint
pnpm -r test        # relay UDP ponta a ponta + API de matchmaking
```

O teste do relay (`server/test/relay.test.ts`) sobe o relay de verdade e usa dois
sockets UDP simulando os proxies do host e do convidado, provando que os pacotes
atravessam a ponte nas **duas direções**.

## Protocolo de teste manual (2 aparelhos + Minecraft Bedrock)

Este é o teste ponta a ponta real, que precisa de dois celulares e do jogo:

1. **Suba o backend** num servidor com IP público (veja *Deploy*) e configure
   `PUBLIC_HOST` para esse IP. Faça as builds do app com `EXPO_PUBLIC_API_URL`
   apontando para ele.
2. **Host:** abra o app → "Criar uma sala" → anote o **código**. Abra o Minecraft,
   entre no mundo e ligue **"Visível para jogadores da LAN"**. Volte ao app (tela
   da sala).
3. **Convidado:** abra o app → "Encontrar salas" → digite o **código** → "Entrar".
   A tela da sala mostra **endereço** e **porta** (ex.: `127.0.0.1 : 19140`).
4. **Convidado:** no Minecraft, aba **Servidores** → **Adicionar servidor** → cole o
   endereço e a porta → **Jogar**.
5. ✅ O convidado entra no mundo do host. O painel de status do app mostra
   "Ponte ativa".

**Checklist se não conectar:** host abriu o mundo e ligou a LAN? os dois estão na
tela da sala? endereço/porta digitados exatamente? a rede não bloqueia UDP
(teste em outra rede/4G)?

> ℹ️ O caminho "proxy local + Add Server" é o alvo do MVP e depende de o Bedrock do
> aparelho aceitar conectar ao proxy local. Se algum aparelho não aceitar, o
> roadmap prevê um **fallback de LAN virtual** (Android `VpnService` / iOS Network
> Extension) que coloca os dois na mesma sub-rede virtual e usa a descoberta LAN
> nativa do jogo. O `UdpProxy`/relay já são desenhados com interface trocável para
> isso.

## Deploy do backend

Há um `server/Dockerfile`. Exponha a porta **TCP 8080** (HTTP+WS) e a porta **UDP**
do relay (`RELAY_PORT`, padrão 19133). Defina `PUBLIC_HOST` com o IP/domínio público.

```bash
docker build -f server/Dockerfile -t crafttogether-server .
docker run -p 8080:8080 -p 19133:19133/udp \
  -e PUBLIC_HOST=SEU_IP_PUBLICO crafttogether-server
```

Plataformas como **Fly.io** e **Railway** funcionam bem (garanta suporte a UDP para
o relay). Variáveis: veja `.env.example`.

## Builds do app (EAS)

```bash
npm i -g eas-cli
eas build -p android --profile preview     # gera um APK instalável
eas build -p ios --profile preview         # requer conta Apple Developer
```

Ajuste `EXPO_PUBLIC_API_URL` nos perfis do `app/eas.json` para o seu backend.

## Roadmap

- Fallback de **LAN virtual** (VPN) para aparelhos que não aceitem o proxy local.
- **Contas + lista de amigos** persistente e presença online.
- Suporte robusto a **múltiplos convidados** por sala (demux por conexão RakNet).
- Métricas de latência e seleção de região do relay.

## Notas técnicas

- **Persistência:** o MVP usa um registro de salas **em memória** (salas são
  efêmeras). A superfície do `RoomStore` é pequena e pode ser trocada por um banco
  (Prisma/SQLite/Postgres) depois.
- **Segurança do relay:** o encaminhamento é por **token de sessão** aleatório
  emitido no join; datagramas de origens não registradas são descartados.

## Licença

MIT — veja [LICENSE](./LICENSE).

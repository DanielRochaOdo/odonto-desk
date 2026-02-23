# Odonto Desk - MVP de Acesso Remoto com Consentimento

MVP de suporte remoto com consentimento explícito, focado em qualidade de conexão e segurança. O fluxo é simples: o cliente gera um código, o atendente solicita acesso, o cliente aceita, e o compartilhamento de tela inicia via WebRTC.

**Visão Geral**
- Autenticação obrigatória via Supabase Auth
- Sessões com consentimento explícito e expiração
- WebRTC para screen share e DataChannel para cursor remoto (apenas indicador)
- Chat e auditoria em tempo real via Supabase Realtime
- Métricas de qualidade com `getStats()`

**Stack**
- Frontend: Vite + React (JS) + Tailwind
- Backend: Supabase (Auth, Postgres, Realtime, Edge Functions)
- Deploy: Vercel (web) e Supabase (backend)

**Estrutura**
- `supabase/migrations`
- `supabase/functions/create-session`
- `supabase/functions/request-join`
- `supabase/functions/resolve-request`
- `web/src`
- `web/.env.example`

## Setup

**Pré-requisitos**
- Node.js 18+
- Supabase CLI

**Supabase (Banco + RLS)**
1. Crie um projeto no Supabase.
2. No SQL Editor do Supabase, execute o conteúdo de `supabase/migrations/20260223123000_init.sql`.
3. Verifique se o Auth por Email está habilitado.

**Edge Functions**
1. Faça login no Supabase CLI: `supabase login`
2. Conecte o projeto: `supabase link --project-ref SEU_PROJECT_REF`
3. Faça deploy: `supabase functions deploy create-session`
4. Faça deploy: `supabase functions deploy request-join`
5. Faça deploy: `supabase functions deploy resolve-request`

**Variáveis Web**
1. Copie `web/.env.example` para `web/.env`.
2. Preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STUN_URL` (padrão já configurado)
   - `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` (opcional)

**Rodar Web**
1. `cd web`
2. `npm install`
3. `npm run dev`

## Fluxo de Uso

**Fluxo do Cliente**
1. Login
2. Criar sessão
3. Compartilhar o código com o atendente
4. Aceitar a solicitação
5. Encerrar quando terminar

**Fluxo do Atendente**
1. Login
2. Inserir código da sessão
3. Aguardar aceite do cliente
4. Prestar suporte
5. Encerrar quando terminar

## Qualidade de Conexão

O app coleta métricas a cada ~1,5s:
- RTT
- Bitrate estimado
- Packet loss
- Jitter
- Frames dropped

O cliente ajusta `maxBitrate` automaticamente quando a qualidade está em `Auto`. Também é possível escolher `Baixa`, `Média` ou `Alta`.

## Segurança e Compliance
- Consentimento explícito (request -> accept/deny)
- Sessões expiram em 30 minutos
- RLS rigoroso para limitar acesso aos dados
- Auditoria completa (`session_events`)
- Encerramento imediato por ambos

## Testes Manuais
1. Criar duas contas (cliente e atendente) em abas anônimas.
2. Cliente cria sessão e copia o código.
3. Atendente entra com o código.
4. Cliente aceita.
5. Atendente visualiza a tela.
6. Testar reconexão (desligar internet por ~5s).
7. Encerrar por ambos.
8. Validar que um terceiro usuário não vê dados da sessão.

## Limitações do MVP
- Não há controle total de teclado/mouse no SO sem agente nativo.
- O indicador de cursor é apenas visual (overlay no vídeo).
- Para controle completo, é necessário um agente desktop (Tauri/Electron) na fase 2.

## Deploy
- Web: Vercel (defina as variáveis `VITE_*` no projeto)
- Supabase: funções já publicadas, use o mesmo projeto do banco

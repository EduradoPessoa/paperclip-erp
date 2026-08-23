# Acompanhamento Visual da Execução dos Agentes ("Central de Execução")

Data: 2026-08-23
Status: Plano de produto/técnico — complementa `doc/plans/2026-08-23-erp-generico-modular-estrategia.md`
Escopo: visibilidade em tempo real e retrospectiva da execução de tarefas pelos agentes,
em todas as camadas: run individual → documento de negócio (case) → pipeline/módulo → empresa.

---

## 1. Requisito

> "Gostaria de acompanhar de forma visual a execução das tarefas pelos agentes."

No contexto do ERP, isso significa que o operador (board) precisa responder, a qualquer
momento e com o mínimo de cliques:

1. **O que os agentes estão fazendo agora** (execução ao vivo, por agente, módulo, pipeline).
2. **O que um agente fez em uma execução específica** (linha do tempo do run: eventos,
   ferramentas, decisões, artefatos, custo, resultado) — "progressive disclosure":
   resumo → passos → logs brutos (princípio já adotado pelo Paperclip).
3. **Onde cada documento de negócio está no processo** (case → estágio do pipeline →
   runs que o trabalharam → histórico de transições com autor).
4. **Histórico agregado** (Gantt, feed de atividade, contadores por módulo) para
   retrospectiva e auditoria.

Este plano **não reinventa**: inventaria o que o upstream já entrega, define o que falta
e propõe uma superfície integrada chamada **Central de Execução**.

---

## 2. Inventário do que Já Existe (upstream, verificado em 2026-08-23)

| Superfície | Onde | O que mostra |
|---|---|---|
| **Live Runs por issue** | `ui/src/components/LiveRunWidget.tsx` + `RunChatSurface.tsx` + `transcript/useLiveRunTranscripts.ts` | Runs ativos/inativos de uma issue, polling de 3s quando a aba está visível, transcript estilo chat, botão de cancelar run |
| **Runs por empresa** | `GET /api/companies/:companyId/heartbeat-runs`, `GET /api/companies/:companyId/live-runs` (com `minCount`) | Lista/histórico e runs "realmente vivos" da empresa |
| **Run detail / transcript** | Rota `/agents/:agentId/runs/:runId` (rendered by `ui/src/pages/AgentDetail.tsx`), `ui/src/pages/RunTranscriptUxLab.tsx` | Transcript do run, liveness state, status message, tool atual, snippets, `outputSilence` |
| **Work Timeline (Gantt)** | `GET /api/companies/:companyId/timeline` (`server/src/services/work-timeline.ts`) + `ui/src/pages/Timeline.tsx` | Spans por run/agente/issue (start/end/status/tokens), eventos (created/commented/approved/delegated/assigned), edges (delegation/assignment/mention) |
| **Live events (WebSocket)** | `server/src/realtime/live-events-ws.ts` (company-scoped, auth board/agent) + `packages/shared/src/types/live.ts` | Tipos: `heartbeat.run.queued/status/progress/event/log`, `agent.status`, `activity.logged`, `external_object.updated`, `plugin.ui.updated` |
| **Activity feed** | `ui/src/components/ActivityFeed.tsx`, `ActivityRow.tsx`, `ActivityCharts.tsx`; rota activity | Feed auditável de mutações com filtros |
| **Histórico de estágios de pipeline** | `ui/src/components/PipelineStageHistoryPanel.tsx`, `CaseActivityFeed.tsx`, `CaseRevisionRail.tsx` | Transições de stage por case, eventos de case, revisões de documentos |
| **Ledger de runs por issue** | `ui/src/components/IssueRunLedger.tsx` | Runs vinculados a uma issue |
| **Status cards (experimental)** | `ui/src/pages/StatusCards/`, `server/src/services/status-card-update-engine.ts` | Cards de status gerados por agente (resumo de andamento) |
| **Task chat com status runtime** | `ui/src/pages/IssueDetail.tsx` / task chat (commit `de9645ab`) | Status ao vivo no final do chat antes do primeiro token |
| **Custo por run** | `cost_events`, `heartbeat_runs.usageJson`, resumos em `heartbeat-run-summary.ts` | Tokens/custo por run, agente, issue, empresa |

**Conclusão do inventário:** o upstream já tem 80% dos *dados* e várias superfícies
pontuais. O que falta é uma **superfície integrada, orientada a módulos/pipelines** e um
**"run player" com linha do tempo estruturada** — hoje o detalhe de execução é transcript
linear (chat), sem a dimensão temporal de eventos/artefatos/custo.

---

## 3. Lacunas vs. Requisito

1. **Sem visão "ao vivo" consolidada por módulo/pipeline.** Os runs vivos estão em
   `live-runs` (empresa), `LiveRunWidget` (issue) e `AgentDetail` (agente). Não existe
   "o que está acontecendo agora no módulo Compras / no pipeline purchase-order".
2. **Sem linha do tempo estruturada por run ("Run Player").** `heartbeat_run_events`,
   `activity_log`, `case_events`, work products e `cost_events` existem, mas não há uma
   API/UI que os monte numa timeline única do run (ex.: `t=0 run inicia → t=1 tool call →
   t=2 cria case → t=3 posta comentário → t=4 custo acumulado → t=5 finaliza`).
3. **WS realtime subutilizado.** `live-events-ws.ts` está pronto e autenticado, mas o
   `LiveRunWidget` usa polling. Para "acompanhar visualmente", o realtime precisa virar o
   caminho principal com polling de fallback (também evita polling agressivo — existe
   `useVisibilityRefetchInterval` para reduzir custo em aba oculta).
4. **Sem linkagem caso ↔ execução na superfície.** Um case tem `case_events`
   (actorType/runId) e `case_issue_links` (issues → runs), mas o operador não vê "quais
   runs trabalharam este case e em que estágio" de forma integrada.
5. **Relatórios de execução estruturados ainda não existem** (previstos no plano ERP,
   seção 6.2): work product `execution-report` por operação de agente. A Central de
   Execução deve exibi-los quando existirem.
6. **Sem contadores agregados por módulo em tempo real** (runs ativos, casos em review
   aguardando humano, taxa de aprovação/rejeição, custo do dia por módulo).

---

## 4. Design Proposto — Central de Execução

Rota base: `/companies/:companyId/execution` (board). Navegação: novo item no sidebar
"Execução" (ao lado de Timeline/Activity), com abas.

### 4.1 Visão A — Live Board (aba "Ao Vivo")

Objetivo: responder "o que os agentes estão fazendo agora".

- **Grid de cards de execução ativa**: um card por run ativo (ou agente), com:
  agente (avatar+nome), módulo/pipeline (badge), case/issue (identificador+título),
  estágio do pipeline, status do run (`queued/running`), ferramenta atual
  (`currentToolName`), mensagem de status (`currentStatusMessage`), snippet da última
  mensagem (`lastAssistantSnippet`), duração, custo acumulado, `livenessState`.
- **Filtros**: módulo (→ pipelines do módulo via manifesto), pipeline, agente, case type,
  período. Busca por identificador de case/issue.
- **Contadores fixos no topo**: runs ativos, agentes trabalhando, casos em `review`
  aguardando humano, casos bloqueados, custo do dia (por módulo).
- **Atualização**: WS `live-events-ws` (`heartbeat.run.queued/status/progress/event`,
  `agent.status`, `activity.logged`) com **fallback polling** (3s visível, pausa em aba
  oculta — reutilizar `useVisibilityRefetchInterval`).
- **Ações diretas**: abrir Run Player, abrir o case, cancelar run (se autorizado).

### 4.2 Visão B — Run Player (aba "Execuções" / drill-down)

Objetivo: responder "o que esse agente fez nessa execução".

- Rota: `/agents/:agentId/runs/:runId` — evoluir a página atual (hoje transcript
  linear) para um layout de **linha do tempo vertical**:
  - **Cabeçalho**: agente, issue/case alvo, adapter, duração, status, custo (tokens/$),
    triggers, retry/continuation.
  - **Timeline de eventos** (novo endpoint agregador, seção 5): cada entrada com
    timestamp e ícone por tipo — `run.start`, `tool.call`, `issue.comment_posted`,
    `case.created/transitioned`, `work_product.created`, `activity.logged`,
    `cost.accrued`, `run.end`. Entradas colapsáveis; clicar abre o detalhe.
  - **Camadas de profundidade (progressive disclosure)**: resumo gerado (status cards /
    future `execution-report`) → passos (timeline) → transcript completo (chat, já
    existe) → logs brutos (run log store).
  - **Sidebar de contexto**: caso/pipeline, estágios percorridos, artefatos/work products
    com backlinks, custo acumulado por fase.

### 4.3 Visão C — Process Flow por Pipeline/Módulo (aba "Processos")

Objetivo: responder "onde cada documento de negócio está no processo".

- **Kanban/swimlane por estágio do pipeline** (reutilizar modelo do board de issues):
  cards de `pipeline_cases` com badge de run ativo (pulsante), autor da última transição
  (via `case_events`), versão, pendências (`pendingSuggestion`, blockers), rollup
  pai/filho.
- **Histórico por case**: `PipelineStageHistoryPanel` (já existe) + `CaseActivityFeed`
  enriquecidos com os runs que executaram cada transição (runId já está em `case_events`).
- **Filtro de módulo**: o manifesto do módulo define seus pipelines → a visão por módulo
  agrupa seus pipelines.

### 4.4 Visão D — Timeline Gantt Aprimorada (aba "Timeline")

Objetivo: retrospectiva por período.

- Manter `ui/src/pages/Timeline.tsx` (Gantt já existente) e adicionar:
  agrupamento/filtro por módulo/pipeline, sobreposição de transições de stage de case
  sobre os spans de run, filtro por agente e por resultado (sucesso/falha/cancelado).

### 4.5 Visão E — Auditoria Consolidada (aba "Atividade")

Objetivo: trilha auditável única por módulo/documento/ator.

- Evoluir `ActivityFeed` com filtros por módulo, pipeline, case, run; export JSON/CSV
  (já previsto no plano ERP, seção 5.2).

---

## 5. Contrato de API (aditivo, company-scoped, auditado)

Novos endpoints (todos com checks de empresa e actor, atividade opcional em leituras):

1. `GET /companies/:companyId/execution/live`
   - Query: `module?`, `pipelineIds?`, `agentIds?`, `caseType?`, `q?`, `includeCases?`
   - Response: `{ runs: LiveRunCard[], counters: { activeRuns, workingAgents, casesInReview, casesBlocked, costTodayCents, byModule[] } }`
   - Implementação sobre: `live-runs` existente + `pipeline_cases` em review/blocked +
     `cost_events` do dia. Serviço novo fino: `server/src/services/execution-center.ts`.
2. `GET /runs/:runId/timeline`
   - Response: `{ run: {...}, entries: RunTimelineEntry[] }` onde
     `RunTimelineEntry = { at, kind, actorId?, title, summary, detail?, issueId?, caseId?, costCents?, artifactIds? }`
   - Agrega: `heartbeat_run_events`, `activity_log` (runId), `issue_comments`,
     `case_events`/`pipeline_automation_executions` (runId), work products, `cost_events`.
3. `GET /companies/:companyId/execution/modules/:moduleKey/status`
   - Resumo por módulo: pipelines, cases por estágio, runs ativos, pendências humanas.
4. WS: manter `live-events-ws.ts`; adicionar tipos `case.transitioned`,
   `case.suggestion_created/resolved`, `execution.report_created` ao
   `LIVE_EVENT_TYPES` (em `packages/shared/src/constants.ts`) e publicá-los nas rotas de
   case/pipeline — front consome com fallback de polling.

Contratos compartilhados: tipos novos em `packages/shared/src/types/execution.ts`
(seguindo o padrão `work-timeline.ts` — DTO único consumido por server e UI).

---

## 6. Integração com o Plano ERP

- **Módulos**: filtros da Central de Execução derivam do manifesto do módulo
  (pipelines do módulo). Um módulo "sem pipeline ativo" não aparece no Live Board.
- **Relatórios de execução** (plano ERP §6.2): quando o agente publicar o
  `execution-report` (work product no case), o Run Player mostra o resumo no topo e a
  timeline por baixo — o "reportar detalhadamente o que foi feito" vira visível.
- **Memória** (plano ERP §7): o Run Player é a superfície natural para ver o que foi
  capturado (`memory_operations` com backlink ao run) e o Live Board pode sinalizar
  "memória atualizada nesta execução".
- **Human-in-the-loop**: casos em estágio `review` com `reviewerKind: human` e
  `pendingSuggestion` entram nos contadores do Live Board (seção 5.1) — o operador vê
  imediatamente o que **precisa da decisão dele**.

---

## 7. Fases de Implementação

### Fase V1 — Live Board (prova de valor, 1–2 semanas)
- Serviço `execution-center.ts` + `GET /execution/live` + página
  `/companies/:companyId/execution` com Live Board.
- WS como canal primário + fallback polling (`useVisibilityRefetchInterval`).
- Reuso integral de `live-runs`, `ActivityFeed`, componentes de identidade/status.
- Verificação: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`;
  `pnpm check:token-gates` (regras de UI).

### Fase V2 — Run Player (2–3 semanas)
- `GET /runs/:runId/timeline` agregador + evolução da página
  `/agents/:agentId/runs/:runId` para timeline vertical com as 3 camadas
  (resumo → passos → transcript/logs).
- Verificação: testes de agregação (unit), teste de fronteira de empresa.

### Fase V3 — Process Flow por módulo (2–3 semanas)
- Kanban por pipeline (reuso do board de issues), enriquecimento do
  `PipelineStageHistoryPanel` com runs, filtros por módulo via manifesto.
- Publicação dos novos `LIVE_EVENT_TYPES` de case/execução no WS.

### Fase V4 — Timeline + Auditoria consolidada (2 semanas)
- Filtros de módulo/pipeline no Gantt existente; exportação de auditoria por módulo;
- Integração com `execution-report` e `memory_operations` quando implementados (plano ERP).

**Sequência recomendada**: V1 → V2 (entrega o "acompanhar visualmente" completo para o
ciclo comercial da Fase 2 do plano ERP), V3/V4 seguem conforme os módulos vão ao ar.

---

## 8. Riscos e Decisões

- **R1 — Volume de eventos**: timeline por run pode crescer (muitos tool calls).
  Mitigação: agregação server-side com paginação por cursor e colapso por tipo
  (ex.: agrupar tool calls consecutivas).
- **R2 — Realtime**: WS por empresa com muitos clientes. Mitigação: evento agregado
  `heartbeat.run.progress` em vez de eventos granulares por cliente; fallback polling;
  throttle de publicação (batch a cada ~1s).
- **R3 — Upstream rápido**: contratos `LIVE_EVENT_TYPES`, `live-runs`, timeline podem
  mudar. Mitigação: tipos novos em `packages/shared`, contribuir a Central de Execução
  ao upstream se fizer sentido (feature genérica).
- **D1 — Onde mora o Live Board**: página core (upstream-able) vs página de módulo.
  Recomendação: core (é genérico); módulos só adicionam filtros via manifesto.
- **D2 — Resumo de execução gerado por IA** (status cards) vs manual: usar status cards
  existentes como resumo do Run Player (Fase V2), sem novo subsistema.

---

## 9. Evidências verificadas no repositório

- `ui/src/components/LiveRunWidget.tsx` — polling 3s via `useVisibilityRefetchInterval`,
  transcript por run, cancel.
- `ui/src/pages/Timeline.tsx` + `server/src/services/work-timeline.ts` +
  `packages/shared/src/types/work-timeline.ts` — Gantt com spans/events/edges.
- `server/src/realtime/live-events-ws.ts` — WS company-scoped com auth board/agent;
  `packages/shared/src/constants.ts` `LIVE_EVENT_TYPES`.
- Rotas: `GET /companies/:companyId/heartbeat-runs`, `GET /companies/:companyId/live-runs`
  (`server/src/routes/agents.ts`); `GET /companies/:companyId/timeline`.
- UI: `RunChatSurface.tsx`, `IssueRunLedger.tsx`, `PipelineStageHistoryPanel.tsx`,
  `CaseActivityFeed.tsx`, `ActivityFeed.tsx`, `StatusCards/`, `RunTranscriptUxLab.tsx`,
  `AgentDetail.tsx` (rota `/agents/:agentId/runs/:runId`).
- Tabelas: `heartbeat_runs`, `heartbeat_run_events`, `cost_events`, `activity_log`,
  `case_events`, `pipeline_automation_executions`, `issue_work_products`.

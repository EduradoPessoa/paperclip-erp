# Estratégia: ERP Genérico Modular sobre o Fork do Paperclip

Data: 2026-08-23
Autor: análise autônoma do repositório `paperclip-erp` (fork de `paperclipai/paperclip`)
Status: Proposta / Plano de arquitetura — nenhum código foi alterado por este documento

---

## 1. Sumário Executivo

O repositório **é um snapshot limpo do Paperclip master de 2026-08-22**: não há um único
commit próprio do fork (`git log origin/master..HEAD` está vazio; árvore de trabalho limpa).
Toda a base já existente — incluindo `pipelines`, `cases`, `finance_events` e `folders` —
é funcionalidade **upstream** do Paperclip.

A boa notícia: o Paperclip já entrega, de fábrica, a maior parte da "espinha dorsal" que um
ERP genérico multitenant com auditoria, processos personalizáveis, agentes com controle
humano e memória precisa:

| Requisito do ERP | O que o Paperclip já fornece |
|---|---|
| Multitenancy | `companies` como objeto de primeira ordem; toda entidade com `company_id`; fronteiras de empresa forçadas em rotas/serviços |
| Segurança de dados | API keys de agente com hash, secrets criptografados (`company_secrets` + providers), refs de secret em vez de valores inline, redação em logs, `principal_permission_grants`, roles de instância e membros de empresa |
| Auditoria | `activity_log` (toda mutação), `issue.updated` com before/after por campo, `case_events` e `document_revisions` append-only, `decision_triage_events` imutável |
| Processos personalizáveis | **Pipelines**: estágios, transições, estágios de revisão com `reviewerKind: human`, automação por stage (routines), documentos de guidance, versões, leases e sugestões de transição |
| Agentes IA com controle humano | Agents + heartbeats + routines; `suggest-transition` (agente sugere, humano aceita); estágios de review humanos; approvals; issue-thread interactions (`request_confirmation`, `ask_user_questions`, `request_checkbox_confirmation`); pause/resume/terminate pelo board |
| Memória | Plano completo e detalhado em `doc/memory-landscape.md` + `doc/plans/2026-03-17-memory-service-surface-api.md` — **ainda não implementado** (não há tabelas `memory_*` no schema) |

O trabalho do ERP, portanto, não é "construir do zero": é **definir uma camada de domínio
modular em cima do control plane** — cada módulo do ERP vira um conjunto de (a) pipelines
(processos), (b) case types (documentos de negócio), (c) routines (automação), (d) skills
(capacidades dos agentes) e (e) páginas de UI — e **implementar a memória** já especificada.

---

## 2. Diagnóstico do Repositório

### 2.1 O que é este fork

- Remote: `https://github.com/EduradoPessoa/paperclip-erp.git`, branch única `master`.
- Baseline: `05b35d46` (2026-08-22) — Paperclip master com ~3.800 commits.
- **Zero divergência do upstream.** Nenhum arquivo ERP próprio foi adicionado ainda.
- Consequência: qualquer mudança feita aqui precisa de uma política de sincronização com
  upstream (rebase periódico), ou o fork envelhece rápido — o upstream lança dezenas de
  commits por semana.

### 2.2 Arquitetura existente (mapeada)

- `server/` — Express REST API + orquestração (auth, adapters, secrets, storage, plugins,
  pipelines, cases, costs/finance, routines, workspaces).
- `ui/` — React + Vite (board): páginas de dashboard, org, tasks, agents, custos,
  approvals, activity, **Pipelines**, **PipelineSettings**, StatusCards, Apps/Gateways,
  Secrets, Skills, Audit, Tools.
- `packages/db/` — Drizzle schema + migrations (Postgres; PGlite embarcado no dev).
- `packages/shared/` — tipos, constantes, validadores, `pipeline-case-type.ts`,
  `app-definitions.ts` (conexões externas: zapier, github, slack, notion, linear,
  google-sheets, context7).
- `packages/plugins/` — runtime de plugins (SDK, ferramentas, UI, namespaces de DB).
- `packages/skills-catalog/`, `packages/teams-catalog/` — catálogos de skills/empresas.
- `cli/` — `paperclipai` (inclui `paperclipai pipelines ...`).
- `skills/` — skills operacionais (ex.: `paperclip`, `para-memory-files`).

### 2.3 Primitivos de interesse direto para o ERP

**Pipelines (workflow engine — o coração do "processos claros e personalizáveis")**

Tabelas: `pipelines`, `pipeline_stages` (kinds `working | review | done | cancelled`),
`pipeline_transitions` (grafo de transições, com `enforceTransitions`).

Recursos por stage (JSON config): `autoAdvanceOnChildrenTerminal`, `reviewerKind: human`,
`approveToStageKey` / `rejectToStageKey` / `requestChangesToStageKey`,
`requireRejectReason`, `autonomy: suggest`, automação por stage ligada a uma routine.

API rica: create/update pipeline, stages, transitions, documents (guidance), ingest
(individual e batch), `suggest-transition` + `resolve-suggestion`, `transition` com
`expectedVersion` (otimismo com 409 `version_conflict`), `review` (approve/reject/
request-changes), blockers entre cases, `rollup`, `events`, `context-pack`, automação
com retry/rerun. Há UI, CLI e smoke (`pnpm smoke:pipelines-tutorial`) e um tutorial
completo em `docs/pipelines-tutorial.md`.

**Cases (objeto de negócio genérico)**

`cases` (experimental): `caseNumber` + `identifier` sequenciais por empresa, `caseType`
(derivado do pipeline — "um pipeline por tipo de coisa"), `key`, `fields` JSON, `status`
(`draft | in_progress | in_review | approved | done | cancelled`), parentCase, eventos
append-only (`case_events`: created/updated/fields_changed/status_changed/issue_linked/
document_revised/attachment_added/label_added...), documentos por key, labels, anexos e
links com issues (roles `origin | work | reference`). **Um case é o molde para um
documento de negócio ERP: pedido de compra, NF, ordem de serviço, ficha de ativo etc.**

**Pipeline cases (instâncias em processo)**

`pipeline_cases`: `stageId`, `caseKey`, `fields`, `version` (controle de concorrência),
`pendingSuggestion` (agente propõe transição; humano resolve), leases (claim/release por
agente ou usuário), `terminalKind`, rollup pai/filho, blockers, `pipeline_automation_executions`
(routines executadas por evento de stage, idempotentes), links com issues e documentos.

**Finance (ledger de eventos)**

`finance_events` + serviço `server/src/services/finance.ts` + rotas
`POST /companies/:companyId/finance-events`, `finance-summary`, `finance-by-biller`,
`finance-by-kind`, listagem. Campos: `direction` (debit/credit), `biller`, `provider`,
`model`, `quantity`, `unit`, `amountCents`, `currency`, `estimated`, `externalInvoiceId`,
`occurredAt`, `metadataJson`. Foi criado pelo upstream para a camada de billing/quota —
**é a base natural do módulo Financeiro**, mas hoje é telemetria de custos de IA, não
contas a pagar/receber de negócio.

**Memória**

- `doc/memory-landscape.md` — pesquisa do mercado de memória (mem0, AWS AgentCore, etc.).
- `doc/plans/2026-03-17-memory-service-surface-api.md` — contrato completo de adapters
  (`MemoryAdapter`, `MemoryScope`, `MemorySourceRef`, hooks `pre_run_hydrate` /
  `post_run_capture` / `issue_comment_capture` / `issue_document_capture`), modelo de
  dados sugerido (`memory_bindings`, `memory_binding_targets`, `memory_operations`,
  `memory_extraction_jobs`), e direção: Paperclip é dono de binding/resolução/proveniência/
  auditoria; providers são responsáveis por extração/ranking/armazenamento.
- **Status: não implementado.** Não há tabelas `memory_*` nem rotas de memória.

---

## 3. Leitura dos Requisitos do ERP

### 3.1 "ERP Genérico, Modular" — o que isso significa neste contexto

Um ERP genérico não é um monolito de 16 telas; é uma **plataforma** em que cada módulo é
um pacote de: processos (pipelines), documentos de negócio (case types), regras/automação
(routines + serviços), capacidades de agentes (skills) e UI. O Paperclip fornece todos os
mecanismos de empacotamento necessários (plugins, skills catalog, teams catalog, app
definitions), então a arquitetura-alvo é:

> **Núcleo fino (control plane) + módulos de domínio empacotados como "apps de módulo".**

Cada módulo declara um **manifesto**: pipelines que instala, case types que usa, routines
que agenda, skills que expõe aos agentes, telas que registra, tabelas de extensão (via
plugin database namespace) que precisa.

### 3.2 Os módulos → primitivos existentes

| Módulo | Primitivo base | O que já existe | Gaps principais |
|---|---|---|---|
| Administração | `companies`, `agents`, roles, grants, `folders`, settings | Multitenancy, membros, convites, permissões, skills | RBAC por módulo; auditoria administrativa consolidada por empresa |
| Compras | Pipeline `purchase-order` + cases (requisição, cotação, pedido, recebimento) | Pipeline/cases/approvals/issue links | Catálogo de fornecedores, cotações comparativas, workflow de aprovação por valor |
| Ativo Imobilizado | Cases (ficha de ativo) + `finance_events` | Cases, documentos, anexos, labels | Depreciação (cálculo por routine), baixas, inventário físico, tags |
| Estoques | Cases (item/movimento) + novas tabelas de saldo | Cases genéricos | Saldo/quantidade com serial e lote; custo médio; inventário cíclico; reservas |
| Custo | `cost_events` + `finance_events` | Ledger de custos de IA + eventos financeiros | Custo de produção (matéria-prima + mão de obra + rateio), centro de custo |
| Vendas | Pipeline `sales-order` + cases (lead, proposta, pedido) | Pipelines, cases, issue links | CRM básico (funil = pipeline!), proposta → pedido → faturamento |
| Faturamento | Cases (nota fiscal) + conexões externas | Cases, anexos, conexões (zapier etc.) | Emissão de NF-e/NFS-e via integrador, carimbo de série/numeração — coberto pelo módulo Fiscal |
| **Fiscal** | Tabelas de módulo (`fiscal_documents`, `fiscal_events`...) + **FiscalProvider** (integrador agnóstico: SPEDY primeiro) + `finance_events` | Contrato de provedor, bindings por empresa, secrets para credenciais, append-only events | Emissão DF-e (NF-e/NFC-e/NFS-e/CT-e/MDF-e), IBS/CBS/IS (reforma), split payment, manifestação do destinatário, créditos de entrada — ver `doc/plans/2026-08-23-modulo-fiscal.md` |
| Financeiro | `finance_events` + `budgets` + `cost_events` | Ledger de eventos, orçamentos com hard-stop, rollups | Contas a pagar/receber com vencimento, conciliação bancária, plano de contas |
| PCP | Pipelines (ordem de produção, roteiro) + routines + StatusCards | Pipeline engine, automação, status cards | Capacidade de máquina, MRP básico, apontamento |
| Importação | Cases (DI/DUIMP) + documentos + routines | Cases/documentos | Integrações aduaneiras, custos de importação por rateio |
| Exportação | Cases (export order) + documentos | Cases/documentos | Documentos de exportação, câmbio |
| Contabilidade | `finance_events` + novas tabelas | Eventos financeiros com direction/currency | Partidas dobradas, plano de contas, SPED, competência × caixa |
| WMS | Cases (endereço, separação) + issues | Cases/pipelines | Inventário por endereço, ondas de separação, leitura de código/RFID |
| OMS | Pipeline `order-management` consolidando canais + conexões | Pipelines + app definitions (marketplaces via conexões) | Normalização de pedidos multi-canal, regras de promessa de entrega |
| TMS | Cases (frete, CT-e) + routines | Cases/pipelines | Cálculo de frete, agendamento de coleta, rastreio |
| Serviços | Cases (ordem de serviço) + issue links + work products | Cases, work products, avaliação | Agendamento, SLA, faturamento de serviços |

### 3.3 Requisitos transversais

- **Multitenant + segurança forte**: já é o DNA do Paperclip (ver seção 4).
- **Auditoria**: já existe em múltiplas camadas (ver seção 5) — precisa de superfície de
  consulta consolidada e retenção configurável.
- **Processos claros e personalizáveis**: pipelines cobrem. Precisa de templates de
  pipeline por módulo (instalar módulo = instalar pipelines pré-configurados) e editor
  visual de processos (hoje a UI de stages/transitions é funcional, não visual).
- **Agentes operando módulos + humano no controle**: ver seção 6 — protocolo
  `sugerir → aprovar → executar → relatar`, já suportado pelo pipeline engine.
- **Memória**: implementar o plano existente (seção 7).

---

## 4. Multitenancy e Segurança — Estado Atual e Evolução

### 4.1 Já existente (forte)

- **Fronteira dura por empresa**: `company_id` em toda entidade de negócio; rotas/serviços
  verificam acesso; testes negam cross-company.
- **Dois tipos de ator**: board (humano, sessão) e agente (API key com hash em
  `agent_api_keys`, mapeada a 1 agente + 1 empresa; `agent-auth-jwt.ts`).
- **Multi-usuário**: `company_memberships`, `instance_user_roles`, `principal_permission_grants`
  (com scopes, ex. `tasks:assign_scope`), convites/join requests, `users:manage_permissions`.
- **Segredos**: `company_secrets` + `company_secret_versions` com providers
  (`local_encrypted` por padrão, AWS opcional); valores sensíveis como refs, nunca inline;
  redação em logs e em payloads de activity/approvals; `PAPERCLIP_SECRETS_STRICT_MODE`.
- **Governança de ações**: approvals, budget hard-stop com auto-pause, review policies
  (`human_only`, `not_creator`), resolvers de issue-thread interactions, presets de baixa
  confiança (`doc/LOW-TRUST-PRESETS.md`).

### 4.2 Lacunas para o ERP e recomendações

1. **RBAC por módulo**: hoje as permissões são por ação genérica (`tasks:assign`, `inbox:manage`,
   `users:manage_permissions`). O ERP precisa de permissões por módulo/processo
   (ex.: `erp:purchase_order:approve_above_10k`). Recomendação: evoluir
   `principal_permission_grants` com um namespace de scopes `erp.<modulo>:<ação>` e um
   evaluator por action key (o mesmo padrão do `company_skill_policies`, que já implementa
   `defaultEffect + regras ordenadas + simulador` — reutilizar esse mecanismo).
2. **Linha de autoridade em cascata por valor**: aprovação de compras por faixa de valor e
   por nível hierárquico (o org chart de `agents.reports_to` + `approvals` já dá o esqueleto).
3. **Separação de ambientes**: dados por empresa; ambientes (dev/prod) por configuração —
   hoje existe `environments` para execução; estender para configuração de módulos.
4. **Retenção e imutabilidade de trilhas**: auditoria imutável (ver seção 5) com política
   de retenção por tipo de evento (fiscal exige prazos legais).
5. **Data classification**: campos sensíveis por tipo de case (dados bancários, pessoais —
   LGPD). Recomendação: marcar campos `fields` com classificação e aplicar redação
   reutilizando `log-redaction.ts`.

---

## 5. Auditoria — Trilhas Existentes e Plano

### 5.1 Trilhas já existentes

| Trilha | O que registra | Característica |
|---|---|---|
| `activity_log` | Toda mutação (actor agent/user/system, action, entity, details) | Obrigatória em rotas mutantes |
| `issue.updated` receipts | Before/after por campo, ator, run, razão de autorização | Emissão em todo PATCH de issue |
| `case_events` | Ciclo de vida de cases (fields_changed, status_changed, issue_linked, document_revised...) | Append-only com `actorType`/`runId` |
| `document_revisions` | Histórico completo de documentos | Append-only, restore por revisão |
| `decision_triage_events` | Mudanças de triagem de decisões | Append-only com proveniência |
| `heartbeat_run_events` / run logs | Execução dos agentes | Para reconstituição de runs |
| `pipeline_automation_executions` | Execuções de routines por evento de stage | Idempotente, com retry |

### 5.2 O que o ERP deve adicionar

1. **Consolidador de auditoria** (`GET /companies/:companyId/audit` unificado): hoje as
   trilhas são por domínio; o ERP precisa de uma visão única (filtros por módulo,
   documento, ator, período) — UI `ui/src/pages/audit` já existe e pode ser a base.
2. **Imutabilidade com retenção**: `case_events` e `activity_log` devem ser
   append-only de verdade (sem UPDATE/DELETE em produção; banco dedicado ou política de
   permissões em nível de role do Postgres).
3. **Assinatura/hash encadeado** (opcional, fase avançada): hash do evento anterior no
   próximo (`prev_hash`), dando prova de integridade para compliance fiscal.
4. **Exportação para órgãos** (SPED, auditoria externa): export JSON/CSV por empresa e
   período, com dados mestres congelados no momento do evento (snapshot de valores).

---

## 6. Agentes de IA Operando os Módulos — Protocolo "Humano no Controle"

### 6.1 O mecanismo já existe

O pipeline engine foi desenhado exatamente para isso:

- **Sugerir, não executar**: `POST /cases/:caseId/suggest-transition` grava
  `pendingSuggestion` (toStage, rationale, confidence, agentId, runId); o humano resolve
  com `resolve-suggestion` (accept/reject). Estágios com `autonomy: suggest`.
- **Revisão humana**: estágios `review` com `reviewerKind: human` e aprovação/rejeição/
  pedido de mudanças com `requireRejectReason`.
- **Automação por estágio**: `pipeline_automation_executions` liga um evento de stage a uma
  routine (execução de agente) — o agente trabalha dentro do estágio, e a passagem de
  estágio continua controlada.
- **Aprovações formais**: tabela `approvals` para ações governadas (contratação, estratégia,
  override de orçamento); `issue_approvals` e `request_checkbox_confirmation` para
  confirmações detalhadas.
- **Board sempre no controle**: pause/resume de agentes e issues a qualquer momento,
  force-release de locks, override de decisões.

### 6.2 Protocolo de operação recomendado por módulo (contrato dos agentes)

Para cada operação que um agente executa num módulo (ex.: "criar pedido de compra",
"baixar item de estoque", "faturar OS"):

1. **Contexto**: o agente recebe o `context-pack` do case (campos, versão, filhos,
   eventos, guidance do pipeline) + memória relevante (ver seção 7).
2. **Proposta**: o agente propõe a ação — cria/edita o case ou emite
   `suggest-transition` com rationale e evidência.
3. **Gate humano**: transições para estágios `review`, valores acima de limite, ou
   qualquer ação governada exigem aprovação humana (interaction/approval/review stage).
4. **Execução**: aprovado, o agente executa via routine no estágio `working`, atualizando
   campos tipados e anexando work products (arquivos, relatórios).
5. **Relato**: o agente publica um **relatório de execução** estruturado — comentário no
   issue de trabalho ou work product `execution-report` no case: o que foi feito, dados
   alterados (antes → depois), decisões tomadas, riscos, custo (tokens/$), evidências
   (links para arquivos/runs) e próximos passos sugeridos.
6. **Aprendizado**: `post_run_capture` e eventos de review alimentam a memória (seção 7).

Esse protocolo deve virar uma **skill obrigatória** (`skills/paperclip-erp` ou equivalente
no catálogo) que todos os agentes de módulo carregam, junto com skills específicas por
módulo (ex.: `erp-purchasing`, `erp-warehouse`).

---

## 7. Memória de Execução — Implementar o Plano Existente

O upstream já especificou o desenho; falta implementar. Recomendação: **seguir
`doc/plans/2026-03-17-memory-service-surface-api.md`** com estas priorizações para o ERP:

### 7.1 Fase M1 — Contrato de controle (núcleo)

- Tabelas: `memory_bindings`, `memory_binding_targets` (company default + agent override),
  `memory_operations` (log auditável de toda operação de memória), `memory_extraction_jobs`.
- API de controle: CRUD de bindings (company-scoped), resolução efetiva.
- API de runtime: `capture`, `record_upsert`, `query`, `list`, `get`, `forget` (o contrato
  `MemoryAdapter` do plano).

### 7.2 Fase M2 — Hooks e auditoria

- Hooks: `pre_run_hydrate` (recall antes do run), `post_run_capture` (resíduo do run),
  `issue_comment_capture`, `issue_document_capture`, `case_event_capture` (novo — eventos
  de case são a matéria-prima do aprendizado de processo).
- Atribuição: toda operação de memória logada em `memory_operations` com
  `attributionMode` (`included_in_run` | `billed_directly`) e vínculo a
  `heartbeatRunId`/`costEventId`/`financeEventId`.

### 7.3 Fase M3 — Provider local + um provider externo

- Provider local markdown-first (inspecionável, zero-config, alinhado ao local-first).
- Provider externo exemplo (mem0 ou equivalente) validando o caminho plugin.

### 7.4 Fase M4 — UI de memória

- Configuração por empresa/agente; explorador de operações; lista/detalhe de registros com
  backlinks para issues/cases/runs; status de jobs de extração.

### 7.5 Loop de aprendizado específico do ERP

O tutorial de pipelines já sugere o "reflection feed": `case events` com
`review_decided` (approve/reject/request_changes) são o sinal de qualidade dos processos.
A memória deve capturar:

- **Decisões de revisão**: por que um pedido foi rejeitado? (motivo obrigatório em
  `requireRejectReason`) → melhorar skills, prompts de routine e guidance do pipeline.
- **Padrões de processo**: duração por estágio, gargalos (casos presos em estágio X),
  taxas de retrabalho (request_changes) → sugerir ajuste de pipeline ao humano.
- **Fatos de negócio**: preferências de fornecedores, condições de pagamento, regras de
  precificação aprendidas das execuções (via `memory.note`/`record_upsert`).
- **Perfil por agente**: o que cada agente executa bem/parece travar (via `profile`).

---

## 8. Arquitetura-Alvo — "Núcleo Fino + Módulos como Apps"

### 8.1 Modelo conceitual

```
┌─────────────────────────────────────────────────────────────┐
│ UI (board)   telas de módulo + telas core (org, tasks, ...)  │
├─────────────────────────────────────────────────────────────┤
│ Camada de módulos (ERP)                                      │
│  • manifesto por módulo (pipelines, case types, routines,    │
│    skills, telas, extensões de schema)                       │
│  • ex.: compras, vendas, financeiro, estoques, PCP, WMS, ... │
├─────────────────────────────────────────────────────────────┤
│ Core (Paperclip control plane — já existe)                   │
│  • companies/agents/issues/goals/projects                    │
│  • pipelines + cases (workflow + documentos de negócio)      │
│  • routines (automação), approvals, budgets, costs, finance  │
│  • activity_log, case_events, document_revisions (auditoria) │
│  • auth: board + agent keys, secrets, permission grants      │
│  • memória (a implementar): bindings, operations, providers  │
│  • plugins, skills catalog, conexões (app definitions)       │
├─────────────────────────────────────────────────────────────┤
│ Dados: Postgres (PGlite dev) + storage local/S3 + providers  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Regras de construção dos módulos

1. **Documento de negócio = case**: cada documento (pedido, NF, OS, ficha de ativo,
   ordem de produção) é um case em um pipeline dedicado. `caseType` é o pipeline. Campos
   tipados entram em `fields` com um **schema declarado no manifesto do módulo**
   (validação zod em `packages/shared` + validação em runtime no server).
2. **Processo = pipeline**: estágios e transições configuráveis por empresa (o "genérico"
   vem dos templates; o "personalizável" vem da edição por empresa).
3. **Regra = routine + serviço**: cálculos (depreciação, custo médio, frete) são routines
   ou serviços do módulo invocados por automação de stage; nunca inline na UI.
4. **Capacidade de agente = skill**: skills de módulo no `skills-catalog` (ou plugin),
   carregadas nos agentes que operam o módulo.
5. **Extensão de dados = plugin database namespace**: tabelas específicas de domínio
   (ex.: saldo de estoque, contas a pagar) vivem em namespaces de plugin, não no schema
   core — mantendo o core atualizável via rebase com upstream.
6. **Integrações = conexões**: SEFAZ, bancos, marketplaces, transportadoras via
   `app-definitions`/conexões/plugins (zapier, google-sheets, webhooks já existem).
7. **Tudo company-scoped, tudo auditado**: nenhuma rota de módulo foge às regras do core.

### 8.3 Manifesto de módulo (exemplo conceitual)

```jsonc
{
  "module": "erp-purchasing",
  "version": "1.0.0",
  "name": "Compras",
  "pipelines": ["purchase-request", "quotation", "purchase-order", "goods-receipt"],
  "caseTypes": ["purchase-request", "quotation", "purchase-order", "goods-receipt"],
  "routines": ["rfq-generation", "po-approval-escalation"],
  "skills": ["erp-purchasing"],
  "permissions": ["erp:purchase_order:create", "erp:purchase_order:approve_above_10k"],
  "extensionTables": ["purchase_order_lines", "supplier_catalog"],
  "ui": { "routes": ["/companies/:id/modules/purchasing"] }
}
```

---

## 9. Roadmap em Fases

### Fase 0 — Fundação do fork (1–2 semanas)
- Decidir política de upstream: rebase mensal + contribuir de volta features genéricas
  (pipelines/cases já são upstream — bugs e melhorias devem ir para o upstream).
- CI básico: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build` (já existem scripts).
- Renomear superfície de produto (branding, `paperclip-erp`), sem quebrar pacotes npm.

### Fase 1 — Núcleo ERP (1–2 meses)
- **Memória**: implementar Fases M1–M2 (bindings, operations, hooks core) — o plano já
  existe; é o item de maior valor e maior alavancagem.
- **Manifesto de módulos + registro**: mecanismo de declaração/instalação de módulos
  (pode começar como tabela `erp_modules` + carregamento de templates de pipeline).
- **Entidades mestras**: clientes, fornecedores, produtos, plano de contas — como
  pipelines de "master data" ou tabelas de extensão com validação tipada.
- **Financeiro base**: contas a pagar/receber sobre `finance_events` (novos campos:
  due date, status de liquidação, entidade de negócio), conciliação simples.
- **RBAC por módulo**: estender `principal_permission_grants` com namespace
  `erp.<modulo>:<ação>` reutilizando o evaluator de policy do core.

### Fase 2 — Ciclo comercial + Fiscal (Compras + Vendas + Faturamento + Fiscal + Financeiro) (3–4 meses)
- Pipelines completos: requisição → cotação → pedido → recebimento; lead → proposta →
  pedido → NF → recebimento financeiro.
- **Módulo Fiscal (F1–F3)**: contrato `FiscalProvider`, binding por empresa, adapter
  SPEDY em homologação SEFAZ, emissão de NF-e de saída (ciclo: transmitir/consultar/
  cancelar/CC-e), NFS-e, e entrada de Compras (consulta por chave, conferência,
  manifestação do destinatário, créditos) — ver `doc/plans/2026-08-23-modulo-fiscal.md`.
- Gate de aprovação por valor (humano) e de emissão fiscal (review humano antes de
  transmitir), agentes sugerindo e executando com relatório.
- Templates de módulo instaláveis por empresa (o "genérico" pronto + personalizável).

### Fase 3 — Operações (Estoques, WMS, PCP, Serviços) (2–3 meses)
- Saldo/lote/serial, inventário cíclico; endereçamento WMS; ordens de produção com
  apontamento; ordens de serviço com SLA.
- Integração com o ciclo comercial (pedido → reserva → expedição).

### Fase 4 — Logística e câmbio (TMS, Importação, Exportação, OMS) (2–3 meses)
- Frete/CT-e/MDF-e (com o Fiscal F5), DI/DUIMP, export orders; OMS consolidando canais
  via conexões.

### Fase 5 — Contábil (Contabilidade, Ativo Imobilizado, Custo) (2–3 meses)
- Partidas dobradas sobre eventos financeiros e fiscais, plano de contas,
  competência × caixa, SPED (alimentado pelos `fiscal_events`); depreciação; custo de
  produção com rateios.
- **Fiscal F4/F5**: campos IBS/CBS/IS, motor tributário (teste 0,1% → pleno 2027),
  split payment → Financeiro, DCTFWeb (2029), CT-e/MDF-e e preparação para o DF-e.
- Exportações de auditoria (JSON/CSV/SPED) — cumprindo a seção 5.

### Contínuo
- Skills de módulo + protocolo de relato (seção 6); memória aprendendo dos reviews
  (seção 7.5); revisão de segurança a cada módulo (pentest das fronteiras de empresa);
  atualização mensal com upstream.

---

## 10. Riscos e Decisões Abertas

### Riscos

1. **Upstream rápido**: ~50 commits/semana. Sem política de rebase, o fork diverge e as
   extensões quebram. Mitigação: extensões em namespaces de plugin/tabelas próprias,
   contribuir de volta, rebase mensal.
2. **Pipelines/cases ainda "experimentais"** (feature gates na UI): contrato pode mudar.
   Mitigação: tratar como estável no nosso código, fixar snapshots de teste
   (`smoke:pipelines-tutorial`), contribuir testes ao upstream.
3. **Escopo gigante (17 módulos, com o Fiscal)**: tentar tudo de uma vez inviabiliza. Mitigação:
   Fase 2 primeiro (ciclo comercial) como prova de valor; módulos seguintes reutilizam o
   mesmo padrão.
4. **Compliance fiscal BR (NF-e, SPED, LGPD)**: não fazer no core; plugins/integrações.
5. **Concorrência/consistência**: `version` otimista dos pipeline cases já resolve
   conflitos; não introduzir CRDTs; manter o modelo de ownership atômico.

### Decisões abertas (para o time)

- D1: Módulos como **plugins** (isolamento máximo, UI via plugin) vs **código no monorepo**
  (mais simples, acoplado ao rebase). Recomendação: começar no monorepo com pastas por
  módulo e extrair para plugin quando o padrão amadurecer.
- D2: Entidades mestras (clientes/produtos) como **case types** vs **tabelas próprias**.
  Recomendação: tabelas próprias para dados mestres (integridade referencial e validação
  forte), cases para documentos transacionais.
- D3: Moeda/plurimodalidade: `finance_events.currency` já existe; definir política de
  câmbio e data de competência por módulo.
- D4: Postagem contábil automática vs manual (Fase 5) — decidir quando o plano de contas
  existir.
- D5: Nome do produto e identidade visual do fork (hoje é 100% Paperclip).

---

## 11. Próximos Passos Imediatos (sugestão de execução)

1. **Aprovar este plano** (board) e escolher D1/D2/D3.
2. Criar a fundação da Fase 1:
   - Implementar memória (Fases M1–M2) seguindo o plano upstream já escrito;
   - Registrar `erp_modules` e o primeiro template de módulo (Compras ou Financeiro);
   - Adicionar testes de fronteira de empresa para as novas rotas.
3. Rodar `pnpm -r typecheck && pnpm test:run && pnpm build` a cada entrega e manter
   `pnpm check:token-gates` para UI.
4. Configurar rebase mensal com upstream e CI de verificação.

---

## Status de Execução (2026-08-23)

**Fase 1 — entregue (fundações):**

| Item | Status |
|---|---|
| **Memória de execução (M1)** — `memory_bindings`, `memory_binding_targets`, `memory_operations` (append-only), `memory_extraction_jobs` + migração `0228`; serviço de bindings (default por empresa + override por agente), resolução, operações auditadas; rotas company-scoped | ✅ `bd747123` |
| **Manifesto de módulos ERP** — `erp_modules` (registro por empresa, 17 chaves estáveis + labels) + migração `0229`; serviço/rotas (listar/instalar/atualizar/desinstalar, board + auditado) | ✅ `erp-modules` (commit C) |
| **Entidades mestras** — `erp_customers`, `erp_suppliers`, `erp_products`, `erp_chart_of_accounts` + migração `0230`; serviço/rotas company-scoped (CRUD com busca/status, mutações board + auditadas); validators com CPF/CNPJ, NCM/CEST, plano de contas (ativo/passivo/PL/receita/despesa) | ✅ Ciclo 1 (entidades mestras) |
| **Financeiro base** — `erp_payables`/`erp_receivables` + migração `0231`; AP/AR com vencimento, atualização (só em aberto) e **liquidação → `finance_events`** (`payable_settlement` debit / `receivable_settlement` credit), vínculo com fornecedor/cliente e documento fiscal | ✅ Ciclo 2 (Financeiro base) |
| **Compras (ciclo comercial)** — pipeline `purchase-order` provisionado por empresa (rascunho → **aprovação humana** → enviado → recebido → fechado/cancelado, transitions enforced); pedido = pipeline case com **campos tipados** (fornecedor, itens com produto/NCM, valores, prazo); **recebimento via fiscal de entrada → payable** vinculado ao fornecedor | ✅ Ciclo 3 (Compras) |
| **Vendas (ciclo comercial)** — pipeline `sales-order` (rascunho → **aprovação humana** → confirmado → faturado → entregue/cancelado); pedido = case com campos tipados (cliente, itens, valores, prazo); **faturamento via fiscal de saída → receivable** vinculado ao cliente | ✅ Ciclo 4 (Vendas) |
| **Faturamento (com o Fiscal)** — orquestra a emissão de NF-e/NFS-e de saída a partir do pedido de venda: monta o draft fiscal (itens do pedido + NCM do produto, cliente como destinatário, emitente), transmite via `FiscalProvider` (SPEDY) e, **se autorizado**, cria o **receivable** e move o pedido para `invoiced`; chave de acesso placeholder (44 dígitos) até o provedor atribuir a real | ✅ Ciclo 5 (Faturamento) |
| **Estoques** — movimentos append-only como fonte da verdade (`deltaQuantity` assinado), saldo por produto e por **lote**, bloqueio de saldo negativo (409), integração **recebimento via fiscal de entrada** e **expedição via pedido de venda** | ✅ Ciclo 6 (Estoques) |
| **WMS** — endereçamento (`erp_wms_locations`), saldo por local derivado dos movimentos (`wms_location`), **ondas de separação** (validação prévia de disponibilidade) e **inventário cíclico** (aprovação → ajuste de estoque pela diferença) | ✅ Ciclo 7 (WMS) |
| **RBAC por módulo (base)** — chave `erp:modules:manage` no `PERMISSION_KEYS`; convenção `erp:<módulo>:<ação>` com helpers tipados (`buildErpModulePermission`, `isErpPermissionKey`); enforcement completo chega junto das rotas dos primeiros módulos de domínio | ✅ `erp-permissions` (commit D) |
| **Central de Execução V1/V2** — Live Board + Run Player | ✅ `686fda58` / `f98c6717` |
| **Módulo Fiscal F1–F4** — contrato/SPEDY/schema, secrets/webhooks/live events, entrada + créditos + manifestação, XML/DANFE + fila UI, **split payment → Financeiro** | ✅ `cc1c5117`…`2b7d5d47` |

**Pendente (próximas fases):** ciclo comercial
(Compras/Vendas/Faturamento), módulos de operação/logística/contábil, providers de
memória (M2) e enforcement de permissões por módulo nas rotas de domínio.

---

## Apêndice A — Fatos verificados no repositório (evidências)

- `git log origin/master..HEAD` vazio; `git status` limpo → fork sem commits próprios.
- Commit base: `05b35d46` (2026-08-22), remote `EduradoPessoa/paperclip-erp`.
- Pipelines: `packages/db/src/schema/pipelines.ts`, `pipeline_cases.ts`;
  `server/src/routes/pipelines.ts` (51 rotas); `ui/src/pages/Pipelines.tsx`,
  `PipelineSettings.tsx`; CLI `paperclipai pipelines`; `docs/pipelines-tutorial.md`;
  `pnpm smoke:pipelines-tutorial`.
- Cases: `packages/db/src/schema/cases.ts`; `server/src/routes/cases.ts`; gate
  `CasesExperimentalGate.tsx`.
- Finance: `packages/db/src/schema/finance_events.ts`; `server/src/services/finance.ts`;
  rotas `finance-events`/`finance-summary`/`finance-by-biller`/`finance-by-kind`.
- Memória: `doc/memory-landscape.md`; `doc/plans/2026-03-17-memory-service-surface-api.md`;
  sem tabelas `memory_*` no schema → não implementada.
- Segurança/auditoria: `activity_log.ts`, `company_secrets.ts`, `principal_permission_grants.ts`,
  `agent_api_keys.ts`, `issue.updated` receipts, `decision_triage_events.ts`.
- Modo de deploy: `local_trusted` e `authenticated` (`doc/DEPLOYMENT-MODES.md`).

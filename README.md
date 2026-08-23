<div align="center">

# 🏢 Paperclip ERP

### O ERP genérico, modular e multitenant dirigido por agentes de IA.

**Processos claros e personalizáveis · Auditoria completa · Segurança forte ·
Humano sempre no controle · Memória que aprende com a execução.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D24.11-brightgreen)](package.json)
[![Database](https://img.shields.io/badge/database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](doc/DATABASE.md)
[![Powered by Paperclip](https://img.shields.io/badge/powered%20by-Paperclip-7C3AED)](https://github.com/paperclipai/paperclip)

---

**Se o Paperclip é o sistema nervoso de empresas de agentes de IA,
o Paperclip ERP é o corpo que ele opera: a empresa em si.**

Um ERP para empresas de **vários nichos** — indústria, comércio, serviços, logística —
onde **agentes de IA executam o trabalho operacional** (compras, vendas, financeiro,
estoques, produção, logística, contabilidade) e **humanos decidem**: aprovar, revisar,
ajustar e auditar cada passo.

</div>

---

## 💡 Por que Paperclip ERP?

ERPs tradicionais são monolíticos: caros, difíceis de customizar por nicho e com
processos engessados. Agentes de IA, por outro lado, já executam trabalho operacional —
mas sem um **control plane**, atuam sem supervisão, sem auditoria e sem aprender com o
que fizeram.

| ❌ Sem o Paperclip ERP | ✅ Com o Paperclip ERP |
|---|---|
| Você mantém planilhas, ERPs legados e dezenas de abas de agentes, sem saber quem fez o quê. | **Um painel único** para a operação inteira: processos, documentos, agentes e custos. |
| Cada cliente/nicho exige customização profunda e cara. | **Módulos plugáveis + processos configuráveis por empresa** — o genérico pronto, o personalizado por configuração. |
| Dados de clientes e financeiro espalhados, sem trilha confiável. | **Multitenancy real**: cada empresa isolada, com **auditoria completa** de toda operação. |
| Agentes rodam soltos, sem aprovação nem registro. | Agentes **sugerem → humanos aprovam → executam → relatam** — sempre auditável. |
| Erros e retrabalho se repetem para sempre. | **Memória de execução**: o sistema aprende com revisões e rejeições e melhora skills e processos. |
| Ninguém vê o que está acontecendo agora. | **Central de Execução**: acompanhamento visual ao vivo do que cada agente está fazendo. |

---

## ✨ Destaques

<table>
<tr>
<td align="center" width="33%">
<h3>🧩 Modular por design</h3>
16 módulos — Compras, Vendas, Financeiro, Estoques, PCP, WMS, TMS… — cada um um pacote de processos, documentos, automação, skills e telas. Ative só o que o nicho precisa.
</td>
<td align="center" width="33%">
<h3>🏢 Multitenant de verdade</h3>
Uma instância, muitas empresas. Toda entidade é company-scoped, com fronteiras forçadas em rotas e serviços. Isolamento completo de dados e trilhas.
</td>
<td align="center" width="33%">
<h3>🛡️ Segurança forte</h3>
API keys com hash, segredos criptografados, refs de secret, redação em logs, permission grants com escopo e roles por usuário e agente.
</td>
</tr>
<tr>
<td align="center">
<h3>🔁 Processos personalizáveis</h3>
O motor de <strong>pipelines</strong> define estágios, transições, revisões humanas e automação por etapa. Cada empresa configura seu fluxo sem código.
</td>
<td align="center">
<h3>🤖 Agentes com humano no controle</h3>
Agentes de qualquer provedor (Claude, Codex, OpenClaw, HTTP…) operam os módulos sob o protocolo <strong>sugerir → aprovar → executar → relatar</strong>. O board pode pausar, revisar ou reverter qualquer coisa.
</td>
<td align="center">
<h3>🧠 Memória que aprende</h3>
Cada execução alimenta a memória da empresa: decisões de revisão, preferências de fornecedores, padrões de processo. Skills e rotinas melhoram com o uso.
</td>
</tr>
<tr>
<td align="center">
<h3>📜 Auditoria completa</h3>
Toda mutação vira evento imutável: quem, o quê, quando, com qual evidência. Histórico de documentos, de casos e de decisões, com before/after por campo.
</td>
<td align="center">
<h3>📊 Central de Execução</h3>
Acompanhe <strong>visualmente</strong> os agentes em tempo real: runs ativos por módulo, ferramenta atual, custo, duração — e o que <strong>aguarda a sua decisão</strong>.
</td>
<td align="center">
<h3>💰 Financeiro integrado</h3>
Ledger de eventos financeiros (direção, moeda, valor) + orçamentos com hard-stop + rastreio de custos por agente, tarefa, projeto e empresa.
</td>
</tr>
</table>

---

## 🗂️ Os 17 Módulos

| Módulo | O que cobre | Módulo | O que cobre |
|---|---|---|---|
| **Administração** | Empresas, usuários, permissões, configurações | **Faturamento** | Notas fiscais, séries/numeração, integrações fiscais |
| **Compras** | Requisição → cotação → pedido → recebimento | **Financeiro** | Contas a pagar/receber, conciliação, plano de contas, fluxo de caixa |
| **Ativo Imobilizado** | Fichas de ativo, depreciação, baixas, inventário | **PCP** | Ordens de produção, roteiros, capacidade, apontamento |
| **Estoques** | Itens, saldos, lotes/séries, custo médio, inventário cíclico | **Importação** | DI/DUIMP, custos de importação, documentos |
| **Custo** | Custo de produção, rateios, centros de custo | **Exportação** | Ordens de exportação, câmbio, documentos |
| **Vendas** | Leads, propostas, pedidos, funil comercial | **Contabilidade** | Partidas dobradas, plano de contas, competência × caixa, SPED |
| **WMS** | Endereçamento, separação, ondas, inventário por endereço | **OMS** | Pedidos multi-canal, promessa de entrega |
| **TMS** | Frete, CT-e, agendamento de coleta, rastreio | **Serviços** | Ordens de serviço, SLA, agendamento, faturamento |
| **Fiscal** | Emissão de DF-e (NF-e · NFC-e · NFS-e · CT-e · MDF-e) via **integrador agnóstico** (SPEDY e outros) · IBS/CBS · Imposto Seletivo · split payment · entrada (Compras) e saída (Faturamento) | — | — |

> **Ordem de construção por valor**: ciclo comercial (**Compras → Vendas → Faturamento →
> Fiscal → Financeiro**) → operações (Estoques, WMS, PCP, Serviços) → logística (TMS,
> Importação, Exportação, OMS) → contábil (Contabilidade, Ativo Imobilizado, Custo).
> O **Fiscal** acompanha a reforma tributária do consumo (IBS/CBS, Imposto Seletivo e
> split payment) e a emissão de documentos é sempre via integrador — o SPEDY é o
> primeiro, sem acoplamento a nenhum fornecedor (ver
> [`doc/plans/2026-08-23-modulo-fiscal.md`](doc/plans/2026-08-23-modulo-fiscal.md)).

---

## ⚙️ Como Funciona

O Paperclip ERP não é um ERP monolítico — é uma **plataforma**: um núcleo fino e forte
(o control plane) com **módulos de domínio empacotados como apps** por cima.

```
┌──────────────────────────────────────────────────────────────────────┐
│  UI — Board (telas de módulo + telas core: org, tarefas, execução)    │
├──────────────────────────────────────────────────────────────────────┤
│  CAMADA DE MÓDULOS — o que construímos sobre o núcleo                 │
│   • manifesto por módulo: pipelines, case types, routines,            │
│     skills, permissões, telas, extensões de schema                    │
│   • ex.: compras · vendas · financeiro · estoques · PCP · WMS · ...   │
├──────────────────────────────────────────────────────────────────────┤
│  NÚCLEO — control plane (motor Paperclip)                             │
│   • companies/agents/issues/goals (multitenancy real)                 │
│   • pipelines (processos) + cases (documentos de negócio)             │
│   • routines (automação), approvals, budgets, costs, finance          │
│   • activity_log, case_events, document_revisions (auditoria)         │
│   • auth: board + agent keys · secrets · permission grants            │
│   • plugins · skills catalog · conexões externas                      │
├──────────────────────────────────────────────────────────────────────┤
│  Dados: PostgreSQL (PGlite no dev) · storage local/S3 · providers     │
└──────────────────────────────────────────────────────────────────────┘
```

### Princípios de construção

1. **📄 Documento de negócio = case.** Pedido de compra, nota fiscal, ordem de serviço,
   ficha de ativo — tudo é um `case` em um pipeline dedicado, com campos tipados
   validados pelo manifesto do módulo. **Um pipeline por tipo de coisa.**
2. **🔁 Processo = pipeline.** Estágios, transições e regras configuráveis **por empresa**:
   o "genérico" vem dos templates do módulo; o "personalizável" vem da configuração local.
3. **⚙️ Regra = routine + serviço.** Cálculos (depreciação, custo médio, frete) são
   rotinas disparadas por automação de estágio — nunca lógica escondida na UI.
4. **🧩 Capacidade de agente = skill.** Cada módulo expõe skills que ensinam os agentes a
   operar seus processos com o protocolo de controle humano.
5. **🗄️ Extensão de dados = namespace de plugin.** Tabelas de domínio (saldo de estoque,
   contas a pagar) vivem fora do schema core, mantendo o núcleo atualizável.
6. **🔌 Integrações = conexões.** Bancos, marketplaces, transportadoras e órgãos fiscais
   entram por conexões/plugins — sem tocar no núcleo.
7. **🔒 Tudo company-scoped, tudo auditado.** Nenhuma rota de módulo foge das regras do
   núcleo: fronteiras de empresa, permissões e auditoria obrigatória.

### 🤝 Humano sempre no controle

Cada operação executada por um agente segue o mesmo protocolo:

```
  1. 📥 Contexto         O agente recebe o contexto do documento (case), o guidance
                         do processo e a memória relevante de execuções anteriores.
  2. 💡 Proposta         O agente cria/edita o documento ou sugere a transição de
                         estágio, com justificativa e evidências.
  3. 🛂 Gate humano      Transições para revisão, valores acima do limite e ações
                         governadas exigem aprovação humana (approval/revisão).
  4. 🚀 Execução         Aprovado, o agente executa via routine no estágio de
                         trabalho, atualizando campos e anexando artefatos.
  5. 📋 Relato           O agente publica um relatório estruturado: o que foi feito,
                         dados alterados (antes → depois), decisões, custo, evidências.
  6. 🧠 Aprendizado      O resultado (inclusive revisões e rejeições) alimenta a
                         memória e melhora skills, rotinas e o próprio processo.
```

### 📊 Central de Execução

Acompanhar os agentes de forma visual é parte do produto:

- **Live Board** — o que os agentes estão fazendo **agora**: runs ativos por módulo/
  pipeline/documento, ferramenta atual, custo, duração — e contadores do que **aguarda a
  sua decisão** (revisões, aprovações, bloqueios). Tempo real via WebSocket + fallback.
- **Run Player** — linha do tempo de cada execução: eventos, ferramentas, artefatos,
  custo acumulado (resumo → passos → transcript/logs brutos).
- **Process Flow** — kanban por estágio de pipeline: onde cada documento de negócio está.
- **Timeline & Auditoria** — retrospectiva em Gantt e trilha auditável por módulo.

---

## 🧱 Estado Atual

O Paperclip ERP nasce de um fork do [Paperclip](https://github.com/paperclipai/paperclip)
(MIT), cujo control plane já fornece, testado: multitenancy, agentes, tarefas com checkout
atômico, **pipelines** (processos), **cases** (documentos), **finance events** (ledger),
auditoria, segredos, plugins e integrações.

| ✅ Já existe (motor) | 🚧 Em construção (nossa camada) |
|---|---|
| Multitenancy real e segurança (secrets, keys, grants) | **Fase 1 ✅**: manifesto de módulos (`erp_modules`) · memória M1 (bindings + operações auditadas) · RBAC base (`erp:<módulo>:<ação>`) · **entidades mestras** (clientes, fornecedores, produtos, plano de contas) · **Financeiro base** (contas a pagar/receber com liquidação → ledger) |
| Pipelines: estágios, transições, revisão humana, automação | Entidades mestras: clientes, fornecedores, produtos, plano de contas |
| Cases: documentos de negócio com eventos e histórico | Memória de execução (bindings + operações + provedores) |
| Ledger financeiro (`finance_events`) e orçamentos | RBAC por módulo (`erp.<módulo>:<ação>`) |
| Auditoria: activity, case events, revisões de documentos | **Central de Execução V1/V2 ✅** (Live Board + **Run Player** com linha do tempo por run — ver [`doc/plans/2026-08-23-execucao-visual-agentes.md`](doc/plans/2026-08-23-execucao-visual-agentes.md)) |
| Agents, routines, approvals, plugins, conexões | Entidades mestras: clientes, fornecedores, produtos, plano de contas |
| | **Módulo Fiscal — F1–F3 ✅**: contrato `FiscalProvider` + adapter SPEDY + tabelas `fiscal_*` · webhooks/live events · secrets · fila fiscal (**UI no board**) · downloads e **persistência de XML/DANFE em `assets`** · entrada (Compras): lookup, confirmação com créditos, manifestação (ver [`doc/plans/2026-08-23-modulo-fiscal.md`](doc/plans/2026-08-23-modulo-fiscal.md)) · F4+: IBS/CBS pleno, split payment |

---

## 🗺️ Roadmap

| Fase | Entrega |
|---|---|
| **0 — Fundação** | Sincronização com upstream, CI (typecheck/test/build), identidade do produto |
| **1 — Núcleo ERP** | Memória de execução · manifesto de módulos · entidades mestras · Financeiro base · RBAC por módulo |
| **2 — Ciclo comercial + Fiscal** | Compras · Vendas · Faturamento · **Fiscal** (DF-e via integrador) · Financeiro — com agentes operando e humanos aprovando |
| **3 — Operações** | Estoques · WMS · PCP · Serviços |
| **4 — Logística e câmbio** | TMS (CT-e/MDF-e) · Importação · Exportação · OMS |
| **5 — Contábil** | Contabilidade · Ativo Imobilizado · Custo — SPED (alimentado pelos eventos fiscais) e exportações de auditoria |
| **Contínuo** | Central de Execução · skills de módulo · memória aprendendo das revisões · segurança (pentest de fronteiras) · rebase mensal |

---

## 🚀 Desenvolvimento Local

Requisitos: **Node.js 24.11+**, **pnpm 9.15+**. Banco embarcado (PGlite) — zero setup.

```bash
pnpm install
pnpm dev
```

API + UI sobem em `http://localhost:3100`.

```bash
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

| Comando | O que faz |
|---|---|
| `pnpm dev` | Dev completo (API + UI, watch) |
| `pnpm build` | Build de todos os pacotes |
| `pnpm typecheck` | Checagem de tipos |
| `pnpm test` | Suíte Vitest (padrão, barata) |
| `pnpm test:e2e` | Playwright (opt-in) |
| `pnpm db:generate` / `pnpm db:migrate` | Migrações |
| `pnpm smoke:pipelines-tutorial` | Smoke do motor de processos |

Reset do banco local: `rm -rf data/pglite && pnpm dev`.

---

## 📂 Repositório

```
server/                  # API REST + orquestração (Express)
ui/                      # Board React + Vite
packages/db/             # Schema Drizzle, migrações, clientes de DB
packages/shared/         # Tipos, constantes e validadores compartilhados
packages/plugins/        # Runtime de plugins (SDK, ferramentas, UI)
packages/skills-catalog/ # Catálogo de skills
cli/                     # CLI paperclipai (inclui comandos de pipelines)
skills/                  # Skills operacionais do runtime
doc/                     # Documentação e planos (doc/plans/)
```

## 📚 Documentos de Referência

- [`doc/plans/2026-08-23-erp-generico-modular-estrategia.md`](doc/plans/2026-08-23-erp-generico-modular-estrategia.md) — estratégia do ERP (diagnóstico, arquitetura, roadmap)
- [`doc/plans/2026-08-23-modulo-fiscal.md`](doc/plans/2026-08-23-modulo-fiscal.md) — módulo Fiscal (DF-e, reforma tributária IBS/CBS, integrador agnóstico)
- [`doc/plans/2026-08-23-execucao-visual-agentes.md`](doc/plans/2026-08-23-execucao-visual-agentes.md) — Central de Execução (acompanhamento visual dos agentes)
- [`doc/GOAL.md`](doc/GOAL.md), [`doc/PRODUCT.md`](doc/PRODUCT.md), [`doc/SPEC.md`](doc/SPEC.md), [`doc/SPEC-implementation.md`](doc/SPEC-implementation.md) — visão e contrato do motor
- [`doc/memory-landscape.md`](doc/memory-landscape.md) e [`doc/plans/2026-03-17-memory-service-surface-api.md`](doc/plans/2026-03-17-memory-service-surface-api.md) — especificação da memória
- [`docs/pipelines-tutorial.md`](docs/pipelines-tutorial.md) — tutorial do motor de processos

## 🤝 Contribuição

Contribuições são bem-vindas — veja [`CONTRIBUTING.md`](CONTRIBUTING.md) para o guia
completo e `doc/plans/` para os planos em andamento. Funcionalidades genéricas do motor
devem, quando possível, ser contribuídas de volta ao upstream
[`paperclipai/paperclip`](https://github.com/paperclipai/paperclip).

---

<div align="center">

**Paperclip ERP** — o ERP onde agentes trabalham, humanos decidem e tudo fica registrado.

MIT © 2026 · construído sobre o [Paperclip](https://github.com/paperclipai/paperclip) (MIT © Paperclip Labs, Inc)

</div>

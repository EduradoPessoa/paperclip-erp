# Módulo Fiscal — Documentos Fiscais Eletrônicos e Reforma Tributária

Data: 2026-08-23
Status: Plano de módulo — complementa `doc/plans/2026-08-23-erp-generico-modular-estrategia.md`
e `doc/plans/2026-08-23-execucao-visual-agentes.md`
Escopo: Compras (entradas) + Faturamento (saídas) + emissão de documentos fiscais via API
com **integrador agnóstico** (SPEDY como primeira implementação, sem acoplamento)

---

## 1. Objetivo

Emitir e gerenciar **documentos fiscais eletrônicos (DF-e)** — NF-e, NFC-e, NFS-e, CT-e,
MDF-e e futuros formatos — **alinhados à reforma tributária do consumo** (EC 132/2023 e
LC 214/2025): campos de IBS/CBS/IS, Imposto Seletivo e split payment.

O módulo atende dois fluxos de negócio:

- **Faturamento (saída)**: pedido de venda → documento fiscal autorizado → DANFE →
  informação de split payment para o Financeiro.
- **Compras (entrada)**: recebimento → consulta da NF-e do fornecedor → conferência →
  manifestação do destinatário → créditos de impostos → Estoques/Custo/Contabilidade.

A comunicação com SEFAZ/ambientes fiscais **nunca é feita diretamente pelo ERP**: ela
acontece por um **integrador** (gateway) escolhido por empresa. O núcleo define o contrato
(**Fiscal Provider**); o SPEDY é o primeiro provedor; outros entram sem mudar o núcleo.

---

## 2. Contexto Tributário (situação em 2026-08)

### 2.1 Cronograma da reforma

| Período | Marco |
|---|---|
| **2026 — ano de teste** | CBS e IBS com alíquotas de referência de **0,1%** (sem direito a créditos), para adaptação de sistemas. **A partir de agosto/2026**, os campos de IBS/CBS/IS (Nota Técnica **NT 2025.002**) tornam-se **obrigatórios em produção** na NF-e/NFC-e (leiaute 4.01+). NFS-e ganha novo modelo impresso com campos IBS/CBS. |
| **2027** | Início da cobrança efetiva de IBS/CBS (alíquotas plenas, com créditos); extinção de PIS/COFINS; início do **Imposto Seletivo (IS)**; **split payment** entra em faseamento (recolhimento na liquidação financeira — impacto direto em fluxo de caixa). |
| **2029/2032** | Novas obrigações acessórias e ajustes (ex.: DCTFWeb IBS/CBS). |
| **2033** | Fim do período de transição: ICMS/IPI extintos (regras de transição), regime definitivo de IBS/CBS. |
| **Futuro** | **DF-e (Documento Fiscal Eletrônico)** — ambiente nacional unificado em discussão para substituir NF-e/NFC-e/CT-e (ajuste SINIEF 49 adiado para 2027; os modelos atuais permanecem com campos IBS/CBS/IS). |

### 2.2 Implicações para o sistema

1. **Leiautes mudam por Nota Técnica** (NT 2025.002 para NF-e/NFC-e; NT 2026.002 para
   NFGas; NFS-e nacional/DPS). O **integrador** absorve a compatibilidade com cada
   ambiente/UF; a nossa camada mantém um contrato estável.
2. **Cálculo tributário por operação** passa a incluir, além de ICMS/IPI/PIS/COFINS
   (período de transição), os novos **IBS/CBS/IS** — inclusive o tratamento de créditos.
3. **Split payment** (a partir de 2027) exige que o documento fiscal carregue as
   informações de recolhimento na liquidação → integração direta com o **Financeiro**.
4. **Entrada é tão crítica quanto saída**: créditos de IBS/CBS e de tributos legados
   dependem de NF-e de entrada conferidas e manifestadas corretamente.

Fontes: [Vistra — mandatory IBS/CBS on NF-e in Aug/2026](https://www.vistra.com/insights/countdown-has-started-mandatory-ibscbs-reporting-will-hit-nf-e-august-2026) ·
[NT 2025.002 — leiaute NF-e/NFC-e (Oobj)](https://oobj.com.br/bc/wp-content/uploads/2025/10/NT_2025.002_v1.20_RTC_NF-e_IBS_CBS_IS.pdf) ·
[Regfollower — CBS/IBS fase obrigatória em agosto](https://regfollower.com/brazil-tax-reforms-moves-to-mandatory-phase-cbs-and-ibs-take-effect-in-august/) ·
[Mazzucco&Mello — calendário da reforma](https://br-mm.com/en/pilulas-tributarias-11/) ·
[SEFAZ Brasil explicado até 2033 (Invoicemonk)](https://invoicemonk.com/en/blog/sefaz-brazil-explained) ·
[Split payment e fluxo de caixa (Valor)](https://valor.globo.com/legislacao/fio-da-meada/post/2026/08/split-payment-e-o-fluxo-de-caixa-das-empresas.ghtml) ·
[Nota Técnica 2026.002 NFGas (Fiscal Requirements)](https://www.fiscal-requirements.com/news/5721-brazil-technical-note-2026002-nfgas-layouts-updated-for-new-ibs-cbs-and-icms-fields)

---

## 3. Escopo Funcional

### 3.1 Saída — Faturamento

- Modelos: **NF-e** (55), **NFC-e** (65), **NFS-e** (padrão nacional/DPS), **CT-e** (57),
  **MDF-e** (58), e preparação para o futuro **DF-e**.
- Ciclo de vida do documento: `rascunho → validado → transmitido → autorizado | rejeitado
  | denegado` e ações posteriores: `cancelado`, `inutilizado`, **CC-e (carta de correção)**.
- DANFE/DANFCE (PDF), XML oficial assinado, consulta de status, eventos (autorização,
  cancelamento, CC-e, EPEC quando aplicável).
- Dados de **split payment** no documento → Financeiro (contas a receber / conciliação).

### 3.2 Entrada — Compras

- Consulta de **NF-e do fornecedor por chave de acesso** (via integrador/ambiente).
- **Conferência** (quantidades, valores, impostos) com registro de divergências.
- **Manifestação do destinatário** (Ciência, Confirmação, Desconhecimento, Não
  realização) — obrigação do comprador.
- Geração de **créditos** (IBS/CBS creditáveis; ICMS; PIS/COFINS no período de transição)
  → alimenta Estoques (custo), Custo e Contabilidade.

### 3.3 Cálculo tributário (motor configurável)

- Regras por **produto (NCM/CEST)**, **regime** (Simples Nacional, Lucro Presumido/Real),
  **UF de origem/destino**, **operação** (entrada/saída), **destinatário** (contribuinte ou
  não).
- Tributos legados (ICMS, IPI, PIS, COFINS) **+ novos (IBS, CBS, IS)** com alíquotas de
  teste (0,1% em 2026) e plenas (2027+), controladas por **feature flags/calendário**.
- Limite explícito: o módulo cobre o essencial para **emitir e receber com a reforma**;
  escrituração contábil completa (SPED) permanece no módulo Contabilidade (Fase 5 do ERP),
  consumindo os eventos fiscais aqui gerados.

---

## 4. Arquitetura — Integrador Agnóstico (Fiscal Provider)

### 4.1 Princípio

Mesmo padrão do `MemoryAdapter` do Paperclip: **o núcleo é dono do contrato, do binding
por empresa e da auditoria; o provedor é dono da comunicação com a SEFAZ/ambiente e do
leiaute.** Nenhuma rota do ERP fala direto com SEFAZ; tudo passa pelo provedor ligado à
empresa.

### 4.2 Contrato `FiscalProvider` (tipos em `packages/shared/src/types/fiscal.ts`)

```ts
export type FiscalDocumentModel = "nfe" | "nfce" | "nfse" | "cte" | "mdfe" | "dfe";

export interface FiscalProviderCapabilities {
  documentModels: FiscalDocumentModel[];
  danfe: boolean;                        // geração de PDF (DANFE/DANFCE)
  webhooks: boolean;                     // callbacks de autorização/eventos
  splitPayment: boolean;                 // suporte a dados de split
  events: Array<"authorized" | "rejected" | "cancelled" | "cc-e" | "manifestation">;
}

export interface FiscalProvider {
  key: string;                           // ex.: "spedy", "focus", ...
  capabilities: FiscalProviderCapabilities;
  emit(req: FiscalEmitRequest): Promise<FiscalEmitResult>;         // transmitir
  cancel(req: FiscalCancelRequest): Promise<FiscalCancelResult>;   // cancelar c/ justificativa
  invalidate(req: FiscalInvalidateRequest): Promise<FiscalInvalidateResult>; // inutilizar numeração
  consult(req: FiscalConsultRequest): Promise<FiscalStatusResult>; // status/autorização
  downloadXml(req: FiscalDownloadRequest): Promise<{ xml: string; signedXml?: string }>;
  downloadDanfe(req: FiscalDownloadRequest): Promise<{ pdf: Uint8Array }>;
  listEvents(req: FiscalListEventsRequest): Promise<FiscalProviderEvent[]>;
}
```

Requisitos do contrato:

- **Idempotência**: `emit` é idempotente por chave de acesso/número-série — nunca
  transmitir duas vezes o mesmo documento (proteção contra duplicidade).
- **Proveniência**: toda chamada registra empresa, case de origem, issue/run do agente
  autor (se houver) e resultado — em `fiscal_events` (append-only).
- **Credenciais**: o binding guarda **apenas refs de `company_secrets`** (provider, chaves,
  certificado digital); valores nunca em logs nem em payloads de activity.

### 4.3 Binding por empresa

- Tabela `fiscal_provider_bindings` (company-scoped): `providerKey`, `enabled`,
  `documentModels[]`, `config` (refs de secrets), `sandbox/homologacao` flag.
- Resolução: empresa → binding efetivo (default por modelo de documento; permite um
  provedor para NF-e e outro para NFS-e, se necessário).
- Configuração pelo board; mudanças auditadas em `activity_log`.

### 4.4 SPEDY — primeiro provedor

- O SPEDY expõe uma **API REST** (`api.spedy.br`, spec OpenAPI pública) para emissão e
  gestão de documentos fiscais — escolhido como integrador inicial.
- Implementação: adapter `server/src/fiscal/providers/spedy.ts` que traduz o contrato
  `FiscalProvider` para os endpoints do SPEDY; o mapeamento exato é validado contra o
  OpenAPI do SPEDY na fase de implementação, em **ambiente de homologação SEFAZ**.
- Outros gateways (Focus, TecnoSpeed, WebmaniaBR, etc.) podem ser adicionados como novos
  providers (core ou plugin) sem alterar rotas/UI.

### 4.5 Modelo de dados (extensões — namespace do módulo)

| Tabela | Conteúdo |
|---|---|
| `fiscal_documents` | Documento fiscal: empresa, case de origem (pedido/faturamento/recebimento), modelo, chave de acesso, número/série, status do ciclo de vida, valores, tributos agregados, refs XML/PDF, dados de split payment |
| `fiscal_document_items` | Itens: NCM, CEST, CFOP, quantidades, valores, tributos por item |
| `fiscal_document_taxes` | Linhas de tributo: IBS, CBS, IS, ICMS, IPI, PIS, COFINS — base, alíquota, valor, creditável |
| `fiscal_events` | **Append-only**: rascunho, transmitido, autorizado, rejeitado (motivo), denegado, cancelado, inutilizado, CC-e, manifestação, webhook recebido — com ator (user/agent+runId) e payload |
| `fiscal_document_links` | Vínculos com cases/issues (origem), runs (autoria) e documentos do integrador (id externo) |

Relacionamento com `cases`: o **documento fiscal é uma tabela própria** (integridade e
validação fortes), vinculada 1:1 ao case do pipeline de origem (pedido de venda, pedido
de compra, recebimento) — segue a decisão D2 do plano estratégico (dados transacionais
fortes como tabelas próprias; cases para o documento de negócio).

### 4.6 Fluxos

**Faturamento (saída):**

```
pedido de venda (case) → faturamento (case) → rascunho fiscal (fiscal_document)
→ validação (regras do motor) → transmitir (FiscalProvider.emit)
→ autorização (webhook/polling) → DANFE + XML → split payment → Financeiro (contas a receber)
→ eventos em fiscal_events + memória de execução
```

**Compras (entrada):**

```
recebimento (case) → consulta NF-e por chave (FiscalProvider.consult) → conferência
→ manifestação do destinatário → créditos (IBS/CBS + legados) → Estoques/Custo/Contabilidade
→ contas a pagar
```

---

## 5. Segurança, Auditoria e Conformidade

- **Credenciais e certificados**: `company_secrets` com provider `local_encrypted`/AWS;
  refs nos bindings; redação nos logs (reutilizar `log-redaction.ts`).
- **Imutabilidade**: `fiscal_events` append-only sem UPDATE/DELETE; retenção legal
  (mínimo 5 anos; seguir regras específicas por documento/UF — configurável).
- **Atribuição**: toda transmissão/cancelamento/manifestação registra ator (agente com
  runId ou usuário), case de origem e payload do integrador.
- **Humano no controle**: emissão de saída pode ser **gated por estágio de review do
  pipeline** (ex.: faturamento autorizado pelo humano antes da transmissão);
  cancelamento exige permissão + justificativa obrigatória; tudo auditável no
  `fiscal_events` e visível na Central de Execução.
- **Idempotência/rate-limit**: chave de acesso única por documento; retry com backoff
  controlado; limite de chamadas ao integrador por empresa.

---

## 6. UI (Módulo Fiscal no Board)

- **Fila fiscal**: documentos aguardando transmissão/autorização e pendências humanas
  (manifestação do destinatário, cancelamentos a aprovar) — contadores também no
  **Live Board** da Central de Execução.
- **Lista de documentos** (entrada/saída) com filtros (modelo, status, período, UF).
- **Detalhe do documento**: timeline de `fiscal_events`, XML/DANFE, tributos
  (IBS/CBS/IS e legados), vínculos com cases e runs, botões de ação (cancelar, CC-e,
  manifestar) com confirmação e justificativa.
- **Configuração**: binding do integrador por empresa (provedor + credenciais via
  secrets + ambiente homologação/produção).

---

## 7. Fases de Implementação

| Fase | Entrega |
|---|---|
| **F1 — Fundação do provedor** | Contrato `FiscalProvider` + bindings + tabelas + adapter **SPEDY** (homologação SEFAZ) + emissão de **NF-e de saída** com ciclo básico (transmitir/consultar) |
| **F2 — Ciclo de vida completo** | Cancelamento, inutilização, CC-e, webhooks, DANFE/PDF, NFS-e (nacional/DPS); fila fiscal no board |
| **F3 — Entrada (Compras)** | Consulta por chave, conferência com divergências, manifestação do destinatário, créditos → Estoques/Custo |
| **F4 — Reforma tributária** | Campos IBS/CBS/IS no leiaute, motor de cálculo configurável (teste 0,1% → pleno 2027), **split payment → Financeiro**, DCTFWeb (2029) |
| **F5 — Expansão** | CT-e/MDF-e (TMS), NFC-e (varejo), preparação para **DF-e** |

F1–F3 entregam o fiscal do **ciclo comercial** (Fase 2 do plano ERP); F4 acompanha o
calendário da reforma; F5 acompanha TMS/varejo e o futuro DF-e.

---

## 8. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Mudança regulatória constante (NTs, cronograma da reforma) | Integrador absorve compatibilidade; nosso contrato permanece estável; feature flags por NT; testes de homologação por UF |
| **Split payment** impacta fluxo de caixa (Financeiro) | Desenhar F4 em conjunto com o módulo Financeiro (contas a receber/reconciliar) |
| Acoplamento ao SPEDY | Contrato `FiscalProvider` + mock provider em testes; UI/rotas nunca dependem de campos do SPEDY |
| Emissão duplicada / perda de XML | Idempotência por chave de acesso; repositório de XML assinado no storage (assets) com hash SHA-256 |
| Dados fiscais sensíveis | Secrets para credenciais/certificados; `fiscal_events` imutável; retenção legal configurável; redação |
| Rejeição/denegação pela SEFAZ | Fila de tratamento com motivo legível, relatório estruturado e memória (aprender com padrões de rejeição) |

---

## 9. Evidências verificadas no repositório (base aproveitada)

- `finance_events` (ledger) e `cost_events` — base para split payment e custos.
- Pipelines/cases — gate humano de emissão via estágios `review` e `approvals`.
- `company_secrets` + providers (`local_encrypted`, AWS) — credenciais do integrador.
- `activity_log`, `case_events`, `document_revisions` — trilhas para `fiscal_events`.
- Plugins + conexões (`app-definitions`) — caminho para novos provedores/integradores.
- Central de Execução (`doc/plans/2026-08-23-execucao-visual-agentes.md`) — superfície
  para fila fiscal e eventos em tempo real.

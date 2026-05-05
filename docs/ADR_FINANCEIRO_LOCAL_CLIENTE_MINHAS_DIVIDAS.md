# ADR / Plano — Financeiro Local do Cliente — Painel Fornecedores / «Minhas dívidas»

**Tipo:** Architectural Decision Record + plano executável  
**Projeto:** AGEmp / Finanças Pro  
**Escopo:** Evoluir a aba **Fornecedores** (papel **Cliente**) para uma superfície útil de **controle local-first das dívidas do cliente por fornecedor**, preservando a separação entre **plataforma remota pré-financeira** e **financeiro local**.

**Estado da fase:** **planejamento oficial documentado** — **implementação não iniciada** neste arquivo.

**Data do documento:** 2026-05-04

---

## Relação com decisões já fechadas

- **«Visão Fornecedores + Governança de vínculo/local»:** **fechada** — [`ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md`](./ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md). Entregou agrupamento de pedidos remotos, CTA **Solicitar novo valor** e governança local do cadastro/reconversão no **lado fornecedor** do modelo atual (`clients[]` locais).
- **Ponte pré-financeira / guardrails:** [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md), [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md).
- **Motor financeiro atual (`clients` → `loans` → `payments`):** [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) — **`calculations.js`** é área sensível.

Esta ADR **não** revoga as anteriores; **estende** o produto com um **segundo livro local**, exclusivo da perspectiva **«eu devo»**, sem tornar Firebase autoritativo.

---

## 1. Estado atual confirmado

- O núcleo financeiro do app permanece **local-first**, por escopo (`anonymous` · `account:{uid}`), conforme [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) e [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md).
- Firebase cobre **identidade**, **papéis**, **vínculos** e **`loanRequests`** como camada **pré-financeira e relacional**, **sem** financeiro autoritativo na nuvem — [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md).
- A aba **Fornecedores** (cliente) reúne hoje principalmente **vínculos aprovados** + **pedidos remotos** agrupados (superfície relacional); falta gestão explícita de **passivo local** com totais acionáveis (saldo, juros, quitação, histórico de pagamentos registrados pelo próprio cliente neste aparelho).
- **`payment.linkContext`** permanece **proibido** — [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md).

---

## 2. Problema de produto

- O cliente precisa de uma área equivalente em utilidade ao que o fornecedor já tem na aba **Clientes**: organizar **para quem deve**, **quanto deve**, **juros**, **expectativa de quitação**, **lembretes de vencimento** e **pagamentos que ele próprio registra**.
- Sem um modelo local dedicado, a UI tende a **misturar** intenção na plataforma (`loanRequest`) com obrigação financeira real — gerando expectativa incorreta de **espelho** ou **sincronização** com o fornecedor.

---

## 3. Conceitos distintos (obrigatório na UX e no modelo)

| Conceito | O que é | Onde vive |
|----------|---------|-----------|
| **Pedido remoto pré-financeiro** | Intenção/negociação na plataforma (`loanRequest`); status, valores combinados na nuvem **não** são extrato nem saldo oficial do app financeiro | Firestore (`loanRequests`), leitura/escrita conforme regras atuais |
| **Dívida local do cliente** | Registro **opcional**, criado pelo cliente, do que **ele** decide acompanhar como passivo neste aparelho | `localStorage`, escopo da conta — artefato **`clientDebtLedger`** (ver §5) |
| **Contrato local do fornecedor** | Empréstimo que o fornecedor registra para um **devedor local** (`clients[]` / `loans[]` no aparelho do fornecedor) | `loanManagerData:{scope}` no aparelho do fornecedor |

**Invariante:** dívida local do cliente **não** é cópia garantida do contrato local do fornecedor; **não** há reconciliação automática nem sync.

---

## 4. Decisão arquitetural recomendada

1. Introduzir um **livro local separado** — **`clientDebtLedger`** — para dívidas do **próprio usuário** na perspectiva devedora, **fora** do array **`clients[]`** do modelo atual de «quem empresta para quem» neste app.
2. Manter **`loanRequests`** e **`links`** apenas como **contexto**, **filtros** e **prefill** na UI — **nunca** como gatilho silencioso de criação de dívida local.
3. **Primeira fase de implementação:** **não alterar** [`src/utils/calculations.js`](../src/utils/calculations.js). Derivar métricas locais via **adaptador/helper** que reproduza a **mesma semântica macro** do motor (taxa por contrato/dívida, juros antes do principal, regra de mês corrente, fallback de taxa **10** quando aplicável) **sem** consolidar esse livro no dashboard global até decisão da Subfase E.
4. **Não** criar **`payment.linkContext`**; pagamentos da dívida local seguem como registros financeiros simples **dentro** do ledger (ver §9).
5. **Não** criar contrato financeiro remoto; **não** usar Firebase como fonte de saldo devido.

---

## 5. Modelo de dados local recomendado (`clientDebtLedger`)

**Nome conceitual:** `clientDebtLedger`  
**Persistência:** nova chave escopada em `localStorage` (detalhe de nome técnico e migração ficam para a Subfase A).  
**Separação:** distinta de `loanManagerData:{scope}` (`clients`, `fundsTransactions`) e distinta do **`loanRequestConversionRegistry`** (histórico de conversões **do fornecedor** neste app).

### Estrutura-alvo (conceitual)

- **`suppliers[]`** — um item por **fornecedor com vínculo aprovado** (Fase 1).
  - Identificadores: `supplierId`, `linkId` (quando existir associação estável ao vínculo).
  - Opcional: cópias de **rótulo amigável** / snapshot já usados na UI relacional (somente para exibição).
  - `archivedAt?`, `notes?`.
- **`debts[]`** por fornecedor — dívidas locais independentes.
  - `id`, `createdAt`, `origin`: `manual` | `fromApprovedRequest`.
  - `loanRequestId?` quando originada a partir de contexto de pedido **aprovado** (referência **opcional**, não autoritativa).
  - Campos financeiros mínimos alinhados ao motor atual na prática: `principalAmount`, `interestRate`, `startDate` (`YYYY-MM-DD`), `payments[]`.
  - Metadados UX: `localNote`, `dueDay` ou `dueDate` como **lembrete informativo** local na Fase 1 (ver §10).
  - Estado: `active` | `settledLocally` | `archived` (enum conceitual; definir no código na Subfase A).

### Relações opcionais com plataforma

- **`loanRequest` aprovado** pode pré-preencher valor/notas/datas ao criar uma **nova entrada** em `debts[]`, mediante confirmação explícita do usuário (§6).
- **Nunca** atualizar automaticamente principal/taxa/saldo por mudanças remotas em `loanRequests`.

---

## 6. Como criar uma dívida local do cliente

### 6.1 A partir de pedido remoto **aprovado**

- Oferecer CTA **«Registrar no meu financeiro local»** (nome final microcopy a definir na implementação).
- Pré-preencher campos plausíveis a partir do pedido (`approvedAmount`, notas, timestamps de referência).
- Exibir confirmação explícita: *«Isto cria apenas um registro neste aparelho. Não sincroniza com o fornecedor nem substitui o controle dele.»*
- **Não** gravar nada remoto; **não** disparar conversão Bloco 2 (fluxo exclusivo do **fornecedor**).

### 6.2 Manualmente

- Permitir criar dívida **local** dentro de um fornecedor já **vinculado/aprovado** (Fase 1 — §11).
- Campos mínimos: principal, taxa, data inicial, observações; histórico de pagamentos posterior.

---

## 7. O que a aba **Fornecedores** deve mostrar (alvo)

Separação visual **obrigatória** em dois blocos:

1. **Plataforma** — vínculos e pedidos remotos (`loanRequests`): status, valores pré-financeiros, CTAs de solicitação/cancelamento conforme fluxos existentes / futuros refinamentos.
2. **«Minhas dívidas» (local)** — somente valores sob **`clientDebtLedger`**:
   - totais por fornecedor e globais (neste aparelho);
   - indicadores de juros / saldo / quitação estimada **derivados localmente**;
   - próximos vencimentos/lembretes (conforme §10);
   - atalhos para **detalhe do fornecedor**.

Microcopy deve impedir interpretação de **extrato oficial conjunto** ou **saldo sincronizado** com a contraparte.

---

## 8. O que a tela de **detalhe do fornecedor** deve mostrar

- Cabeçalho: identidade do fornecedor + estado do vínculo (contexto relacional).
- Aba/seção **Plataforma**: lista de pedidos remotos daquele fornecedor + **Solicitar novo valor**.
- Aba/seção **Minhas dívidas locais**:
  - lista de dívidas (`debts`);
  - para cada dívida: saldo principal atual, expectativa de juros do ciclo, quitação estimada, lembrete de vencimento;
  - histórico de **pagamentos registrados pelo cliente** neste aparelho;
  - ações: registrar pagamento, encerrar/arquivar dívida local, criar nova dívida (manual ou a partir de pedido aprovado).

---

## 9. Pagamentos locais do cliente

- Pagamentos são **lançamentos locais** dentro de cada `debt`: data (`YYYY-MM-DD`), valor, observação opcional.
- **Sem** `payment.linkContext`; qualquer etiqueta contextual opcional futura deve seguir apenas **`loan.linkContext`-equivalente no modelo da dívida** se um dia existir snapshot ao nível da dívida — **fora do escopo da Fase 1**, preferindo não espelhar mecanicamente o modelo do fornecedor sem decisão explícita.
- Pagamentos **não** comunicam com Firebase e **não** alteram `loanRequests`.

---

## 10. Vencimentos e juros

- **Juros:** na primeira implementação, manter **compatibilidade conceitual** com o motor atual (taxa mensal sobre saldo, pagamento abate juros antes do principal, fallback **10%**, empréstimo no mês corrente sem expectativa no próprio mês) via **helper/adaptador**, **sem editar** `calculations.js`.
- **Vencimento:** na Fase 1, tratar como **lembrete local** (`dueDay` / data alvo), não como novo motor de mora/multa/dia corrido, até decisão explícita em fase posterior.

---

## 11. Fase 1 — escopo estrito do produto

- Somente dívidas associadas a **fornecedores com vínculo aprovado** (`LINK_STATUSES.APPROVED` na lista já carregada no app).
- **Sem** «credor avulso» sem vínculo na primeira entrega (evita duplicar semântica do cadastro local genérico e reduz ambiguidade).

---

## 12. Impacto esperado por área (quando implementado)

| Área | Impacto |
|------|---------|
| [`src/App.jsx`](../src/App.jsx) | Carregar/salvar ledger escopado; compor KPIs para aba **Fornecedores** |
| [`src/components/ClientSuppliersPanel.jsx`](../src/components/ClientSuppliersPanel.jsx) ou extratos | Shell da nova UX com split **Plataforma** / **Minhas dívidas** |
| [`src/utils/storageScope.js`](../src/utils/storageScope.js) | Nova chave escopada para `clientDebtLedger` |
| Novo utilitário de persistência/normalização | Serialização, migração benigna, validação defensiva |
| Novo helper de derivação | Cálculos locais espelhando semântica do motor sem alterar `calculations.js` |
| [`src/utils/calculations.js`](../src/utils/calculations.js) | **Fora do escopo da primeira implementação** |
| Firebase / [`firestore.rules`](../firestore.rules) | **Sem** nova coleção autoritativa de dívida; opcionalmente apenas **leituras já existentes** para contexto |

---

## 13. Subfases de implementação (oficiais)

- **Subfase A — Fundamentos locais:** storage `clientDebtLedger` + normalização + helpers de cálculo/derivação + testes unitários.
- **Subfase B — Resumo na aba Fornecedores:** KPIs «Minhas dívidas» + lista por fornecedor **sem** alterar dados remotos.
- **Subfase C — Detalhe do fornecedor:** dívidas locais + pagamentos + pedidos remotos lado a lado, CTAs claros.
- **Subfase D — Operações secundárias:** vencimentos/lembretes refinados, arquivamento local do ledger, **backup/export/import** do novo artefato (separado ou junto ao backup existente — decisão técnica na implementação, preservando compatibilidade).
- **Subfase E — Avaliação:** eventual integração ao **Painel**/motor central ou fusão conceitual com `clients[]` — **somente** com ADR próprio + decisão explícita sobre `calculations.js`.

---

## 14. Critérios de aceite (macro)

- Dois blocos distinguíveis na UI: **Plataforma** vs **Minhas dívidas locais**.
- **Nenhuma** transição remota (`loanRequest`) cria/atualiza dívida local **automaticamente**.
- Toda dívida local nasce por **ação explícita** do cliente (confirmação clara na UX).
- Fase 1: apenas fornecedores com vínculo **aprovado**.
- Pedidos **`loanRequests`** continuam pré-financeiros; mudanças remotas **não** reescrevem saldos locais sem ação local.
- **Sem** `payment.linkContext`; **sem** sync financeiro remoto; **sem** contrato remoto.
- **`calculations.js`** permanece **inalterado** na primeira entrega técnica desta linha (Subfases A–D).

---

## 15. Testes necessários (quando implementado)

- Normalização/migração benigna do `clientDebtLedger`.
- Helpers de derivação: juros, amortização, saldo zero, fallback de taxa, cenários com pagamentos parciais.
- Fluxos UX: criar dívida manual; criar a partir de pedido **aprovado** com confirmação; garantir que **`approved` remoto sozinho** não cria linha local.
- Regressão: **`loanRequests`** e vínculos **não** passam a gravar financeiro central (`clients[]`) por conta desta feature.
- Backup/import (Subfase D): compatibilidade com backups antigos sem o novo campo.

---

## 16. Riscos

- Expectativa do usuário de que o app «**valida**» contra o fornecedor ou espelha o contrato remoto — mitigar com microcopy e ausência de sync.
- Divergência inevitável entre valor **aprovado na plataforma** e valor **registrado localmente** pelo cliente.
- Duplicação mental entre **`clients[]`** (fornecedor) e **`clientDebtLedger`** (cliente) — mitigar com nomenclatura e navegação por papel.
- Pressão futura para mexer em **`calculations.js`** ou dashboard global antes da Subfase E — resistir até decisão formal.

---

## 17. Guardrails (obrigatórios)

- Financeiro do cliente **continua local-first**, apenas neste aparelho/escopo.
- Firebase **continua** sendo apenas **vínculo** / **pedido pré-financeiro** nesta linha — não fonte de saldo.
- **Não** criar contrato financeiro remoto.
- **Não** sincronizar financeiro com o fornecedor.
- **Não** criar **`payment.linkContext`**.
- **Não** alterar **`calculations.js`** na primeira fase (**Subfases A–D**).
- **Não** usar vínculo remoto como permissão obrigatória para registrar pagamento local (é livro próprio do cliente — vínculo só delimita **fornecedores elegíveis na Fase 1**).

---

## 18. Próxima ação recomendada

1. Obter **aprovação explícita de produto** desta ADR (escopo Fase 1 + subfases).
2. Executar **Subfase A** primeiro (dados + testes), antes de qualquer UI ampla.
3. Registrar QA específico ao encerrar cada subfase (matriz nova ou extensão da existente — decisão na Subfase A).

---

## 19. Histórico

| Data | Nota |
|------|------|
| 2026-05-04 | Versão inicial — ADR/plano documental; sem mudanças em `src/`, `firestore.rules`, `calculations.js` nem testes. |

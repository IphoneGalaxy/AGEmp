# ADR / Plano — Financeiro Local do Cliente — Painel Fornecedores / «Minhas dívidas»

**Tipo:** Architectural Decision Record + plano executável  
**Projeto:** AGEmp / Finanças Pro  
**Escopo:** Evoluir a aba **Fornecedores** (papel **Cliente**) para uma superfície útil de **controle local-first das dívidas do cliente por fornecedor**, preservando a separação entre **plataforma remota pré-financeira** e **financeiro local**.

**Estado da fase:** **funcionalmente fechada nesta etapa** (entrega «Minhas dívidas» — Fase 1 documentada): Subfases **A**, **B**, **C**, **D1**, **D2** e **D3** **concluídas** (`5fc8a58`, `e24eb25`, `0f2c43b`, `40fa3a4`, `eedbd2e`, smoke **D3** registrado **2026-05-17**). **Pacote «Pré-Sync Local Hardening»** (UX fronteira plataforma/local, lembretes derivados locais, export JSON específico do ledger — **sem** import desse arquivo nesta entrega) **fechado documentalmente** (**Onda 2B**, **2026-05-16** — [`plans/completed/PRE_SYNC_LOCAL_HARDENING.md`](./plans/completed/PRE_SYNC_LOCAL_HARDENING.md); commits **`d6f69af`**, **`8228b5c`**, **`b86ae9b`**). O **`clientDebtLedger`** permanece **dados locais neste aparelho** (por escopo), **separado** de **`clients[]`** e de **`loanRequestConversionRegistry`**, incluído em backup/export/import/auto-backup, **sem sincronização financeira remota** com o fornecedor e **sem** Firebase como fonte financeira autoritativa do passivo local; **`pedido aprovado` na plataforma não cria dívida local automaticamente**. Evoluções (**Subfase E**, Painel global, alinhamento ao motor central, **importação do JSON dedicado**, CSV, UX avançada) ficam **backlog** mediante ADR/decisão própria — §18.

**Data do documento:** 2026-05-04 · **Registros D1/D2:** 2026-05-16 · **Registro D3 (smoke + docs):** 2026-05-17 · **Pacote Pré-Sync — registro §21:** 2026-05-16

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
- A aba **Fornecedores** (cliente) reúne **vínculos aprovados** + **pedidos remotos** agrupados (**pré-financeiro**, sem saldo oficial na nuvem) e, em paralelo, o bloco **«Minhas dívidas»** (**dados locais neste aparelho**) derivado de **`clientDebtLedger`**, com **detalhe por fornecedor** (dívidas e pagamentos locais, pedidos na plataforma só como contexto — sem criação automática de dívida local).
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
| Backup manual / importação / auto-backup | **`clientDebtLedger`** incluído no mesmo pacote JSON que caixa + **`clients[]`** (`40fa3a4`); backups antigos **sem** o campo continuam válidos (ledger efetivo vazio normalizado); **sem** alterar **`calculations.js`**, **`firestore.rules`**, Firebase SDK nem **`payment.linkContext`** |
| Novo helper de derivação | Cálculos locais espelhando semântica do motor sem alterar `calculations.js` |
| [`src/utils/calculations.js`](../src/utils/calculations.js) | **Fora do escopo da primeira implementação** |
| Firebase / [`firestore.rules`](../firestore.rules) | **Sem** nova coleção autoritativa de dívida; opcionalmente apenas **leituras já existentes** para contexto |

---

## 13. Subfases de implementação (oficiais)

- **Subfase A — Fundamentos locais:** **concluída** (`5fc8a58`) — storage `clientDebtLedger` + normalização + helpers de cálculo/derivação + testes unitários.
- **Subfase B — Resumo na aba Fornecedores:** **concluída** (`e24eb25`) — KPIs «Minhas dívidas» + lista por fornecedor **sem** alterar dados remotos.
- **Subfase C — Detalhe do fornecedor:** **concluída** (`0f2c43b`) — dívidas locais + pagamentos + pedidos remotos lado a lado, CTAs claros; confirmação explícita para dívida local; **sem** sync financeiro remoto.
- **Subfase D — Operações secundárias (entrega desta etapa fechada):**
  - **D1 — Backup/export/import/autoBackup:** **concluída** (`40fa3a4`) — campo raiz **`clientDebtLedger`** no JSON de backup manual e em `data` dos snapshots automáticos; import e restauração aplicam **`normalizeClientDebtLedger`** (ausência do campo ⇒ ledger vazio válido); ledger permanece **fora** de **`clients[]`**, **fora** de **`loanRequestConversionRegistry`** e **fora** do Firebase como autoritativo financeiro; **`calculations.js`**, **`firestore.rules`**, Firebase SDK e **`payment.linkContext`** **não** foram alterados nesta linha.
  - **D2 — Registro documental (fecho da D1):** **`eedbd2e`** (**2026-05-16**) — atualização dos docs vivos — **sem** mudança em `src/`.
  - **D3 — Registro documental + smoke manual final:** **concluída** (**2026-05-17**) — ver §20; operador humano atesta **OK integral** nos cenários listados; **sem NOK crítico informado** — **sem** mudança em `src/` nesta rodada documental.
  - **Backlog evolutivo (não é falha de encerramento):** refinamentos de vencimentos/lembretes **locais neste aparelho**; refinamento visual da aba Fornecedores / detalhe do fornecedor; limites de **`localStorage`** conforme volume de dívidas/backups; exportação/relatório específico das dívidas do cliente; **Subfase E** / Painel global / possível alinhamento futuro ao **`calculations.js`** — **somente** com ADR própria; **sync financeiro remoto** continua **fora de escopo** até decisão explícita.
- **Subfase E — Avaliação:** eventual integração ao **Painel**/motor central ou fusão conceitual com `clients[]` — **somente** com ADR próprio + decisão explícita sobre `calculations.js` (**não iniciar** sem ADR).

---

## 14. Critérios de aceite (macro)

- Dois blocos distinguíveis na UI: **Plataforma** vs **Minhas dívidas locais**.
- **Nenhuma** transição remota (`loanRequest`) cria/atualiza dívida local **automaticamente**.
- Toda dívida local nasce por **ação explícita** do cliente (confirmação clara na UX).
- Fase 1: apenas fornecedores com vínculo **aprovado**.
- Pedidos **`loanRequests`** continuam pré-financeiros; mudanças remotas **não** reescrevem saldos locais sem ação local.
- **Sem** `payment.linkContext`; **sem** sync financeiro remoto; **sem** contrato remoto.
- **`calculations.js`** permanece **inalterado** na entrega desta linha até **Subfase E** (se alguma vez autorizada por ADR).
- Backup/import/auto-backup: arquivo `.txt` inclui **`clientDebtLedger`** normalizado; restauração **substitui** o ledger do escopo atual pelo do arquivo (sem merge), com confirmação no fluxo manual já existente no app.
- **Smoke manual Subfase D3:** executado com **sucesso**, **sem NOK crítico** — §20.

---

## 15. Testes necessários (quando implementado)

- Normalização/migração benigna do `clientDebtLedger`.
- Helpers de derivação: juros, amortização, saldo zero, fallback de taxa, cenários com pagamentos parciais.
- Fluxos UX: criar dívida manual; criar a partir de pedido **aprovado** com confirmação; garantir que **`approved` remoto sozinho** não cria linha local.
- Regressão: **`loanRequests`** e vínculos **não** passam a gravar financeiro central (`clients[]`) por conta desta feature.
- Backup/import (**D1 — entregue):** compatibilidade com backups antigos sem o campo `clientDebtLedger`; dados inválidos absorvidos por **`normalizeClientDebtLedger`**; cobertura em `storage.test.js` / `autoBackup.test.js` (Vitest).
- **Smoke manual D3:** evidência humana complementar registada em §20 (**OK integral**, sem NOK crítico).

---

## 16. Riscos

- Expectativa do usuário de que o app «**valida**» contra o fornecedor ou espelha o contrato remoto — mitigar com microcopy e ausência de sync.
- Divergência inevitável entre valor **aprovado na plataforma** e valor **registrado localmente** pelo cliente.
- Duplicação mental entre **`clients[]`** (fornecedor) e **`clientDebtLedger`** (cliente) — mitigar com nomenclatura e navegação por papel.
- Pressão futura para mexer em **`calculations.js`** ou dashboard global antes da Subfase E — resistir até decisão formal.
- **Residual pós-D1:** possível divergência futura entre derivações do ledger e o motor central até eventual alinhamento por decisão de produto (**Subfase E**).
- **Residual pós-D1:** maior volume de dados em **`localStorage`** (snapshots automáticos + ledger); monitorar quota e comportamento já existente de fallback quando o armazenamento enche.

---

## 17. Guardrails (obrigatórios)

- Financeiro do cliente **continua local-first**, apenas neste aparelho/escopo.
- Firebase **continua** sendo apenas **vínculo** / **pedido pré-financeiro** nesta linha — não fonte de saldo.
- **Não** criar contrato financeiro remoto.
- **Não** sincronizar financeiro com o fornecedor.
- **Não** criar **`payment.linkContext`**.
- **Não** alterar **`calculations.js`** nesta linha até **Subfase E** ou ADR própria (**Subfases A–D3** entregues nesta etapa).
- **Não** usar vínculo remoto como permissão obrigatória para registrar pagamento local (é livro próprio do cliente — vínculo só delimita **fornecedores elegíveis na Fase 1**).

---

## 18. Próxima ação recomendada

1. Tratar evoluções como **backlog priorizado pelo produto** — §13 (Subfase D backlog) e §16 (riscos residuais); **não** abrir integração ao Painel global (**Subfase E**), sync financeiro remoto nem alteração a **`calculations.js`** sem **ADR própria**.
2. **Backlog explícito:** quota/tamanho de **`localStorage`** conforme volume de dívidas/backups; possível alinhamento futuro do **`clientDebtLedger`** com **`calculations.js`** mediante ADR própria; possível integração futura com dashboard global mediante ADR própria; **importação/restauração** a partir do **JSON específico** «Minhas dívidas» (distinto do backup completo); formato **CSV** ou relatórios adicionais; lembretes/notificações mais avançados — **sync financeiro remoto** continua **fora do escopo** até decisão própria. *(Entregues e arquivadas — [`plans/completed/PRE_SYNC_LOCAL_HARDENING.md`](./plans/completed/PRE_SYNC_LOCAL_HARDENING.md):* refinamento UX fronteira **Plataforma** vs **dados locais**, lembretes derivados **`dueDate`/`dueDay`**, export JSON específico tipado.)*

---

## 19. Histórico

| Data | Nota |
|------|------|
| 2026-05-04 | Versão inicial — ADR/plano documental; sem mudanças em `src/`, `firestore.rules`, `calculations.js` nem testes. |
| 2026-05-16 | **Subfase D1 entregue no código** (`40fa3a4`): backup/export/import/auto-backup incluem **`clientDebtLedger`** normalizado; compatível com backups antigos; **`calculations.js`**, **`firestore.rules`**, Firebase SDK e **`payment.linkContext`** intocados; **Subfase D2** atualiza só documentação viva (este arquivo e correlatos). |
| 2026-05-16 | **Pacote «Pré-Sync Local Hardening» — Onda 2B documental:** UX/lembretes/export JSON específico + correção `debtStatusLabelPt`; commits **`d6f69af`**, **`8228b5c`**, **`b86ae9b`**; smoke §21 **OK**; plano arquivado [`plans/completed/PRE_SYNC_LOCAL_HARDENING.md`](./plans/completed/PRE_SYNC_LOCAL_HARDENING.md); guardrails §17 preservados — **sem** sync financeiro remoto neste pacote. |
| 2026-05-17 | **Subfase D3 documental:** smoke manual final **OK integral**, **sem NOK crítico** (§20); linha «Minhas dívidas» registada como **funcionalmente fechada nesta etapa**; **`eedbd2e`** (D2) + docs D3 — **sem** `src/`. |

---

## 20. Smoke manual — Subfase D3 (registro operador humano)

**Data do registro:** 2026-05-17 · **Resultado:** **OK integral** · **NOK crítico:** **nenhum informado**

Execução humana confirmou (entre outros):

- criar dívida manual em fornecedor com vínculo aprovado — **OK**
- registar pagamento parcial — **OK**
- criar dívida local a partir de pedido **approved**, com confirmação explícita — **OK**
- **pedido approved não cria dívida local automaticamente** — **OK**
- exportar backup e verificar presença de **`clientDebtLedger`** — **OK**
- importar/restaurar backup e confirmar retorno coerente dos **dados locais neste aparelho** — **OK**
- troca de conta/escopo **sem** misturar dados entre sessões — **OK**
- **fornecedor não acede automaticamente ao financeiro local do cliente** (ledger não sincronizado na plataforma como extrato conjunto) — **OK**
- painel/dashboard e cálculos principais do núcleo existente **sem regressão observada** neste smoke — **OK**

**Nota:** Firebase permanece camada **pré-financeira / relacional** para pedidos e vínculos — **não** fonte autoritativa do **`clientDebtLedger`**.

---

## 21. Smoke manual — Pacote «Pré-Sync Local Hardening» (Onda 2B)

**Data do registro:** **2026-05-16** · **Resultado:** **OK** · **NOK crítico:** **nenhum informado** após **`b86ae9b`**

Execução humana confirmou (entre outros):

- aba **Fornecedores** operacional — **OK**
- separação **Plataforma** vs **dados locais neste aparelho** — **OK**
- lembretes derivados **sem** alteração ao motor central — **OK**
- dívida a partir de pedido **approved** + reabrir **Ver detalhes** **sem** tela branca — **OK**
- export JSON específico baixa e contém **`clientDebtLedger`**; raiz **sem** **`clients`** / **`fundsTransactions`** — **OK**

**Commits de referência do pacote:** **`d6f69af`** (Onda 1) · **`8228b5c`** (Onda 2A) · **`b86ae9b`** (correção). **Plano:** [`plans/completed/PRE_SYNC_LOCAL_HARDENING.md`](./plans/completed/PRE_SYNC_LOCAL_HARDENING.md).

**Guardrails:** local-first; **sem** sync financeiro remoto; **`calculations.js`**, **`firestore.rules`**, Firebase SDK e **`payment.linkContext`** **intocados** por este pacote; export específico **não substitui** backup completo nem declara fluxo de import nesta entrega.

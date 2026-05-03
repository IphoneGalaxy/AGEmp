# Firestore — `loanRequests` (v1 pré-financeira)

**Contrato funcional:** [`LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`](./plans/completed/LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md)  
**Helpers:** [`src/firebase/loanRequests.js`](../src/firebase/loanRequests.js) · **Firestore (CRUD cliente/fornecedor):** [`src/firebase/loanRequestsFirestore.js`](../src/firebase/loanRequestsFirestore.js)  
**Rules:** [`firestore.rules`](../firestore.rules) (funções `loanRequest*`)  
**QA executável (pacote v1):** [`QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md)  
**QA pacote v1.1 (RB + CN — fechado):** [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md)

**Planejamento histórico (execução v1, não plano ativo):** [`plans/completed/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md`](./plans/completed/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md)

**Pacote v1:** **fechado formalmente** após smoke manual real OK (sem NOK crítico) — ver [`QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md) e LKG **`lkg-2026-05-01-loanrequest-v1-complete`** em [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) §4.

**Pacote v1.1 (RB + CN):** **fechado formalmente** — [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md); LKG integral **`lkg-2026-05-03-loanrequest-v1-1`** (marco intermediário só RB: **`lkg-2026-05-03-loanrequest-v1-1-rb`**).

## Coleção

- Path: `loanRequests/{loanRequestId}` (`loanRequestId` gerado pelo cliente, ex. ID auto do Firestore).
- Leitura (`get` / `list`): apenas `clientId` ou `supplierId` igual ao usuário autenticado; em consultas, usar `where` com esses campos para compatibilidade com as rules.
- `delete`: não permitido pelas rules.

## Modelo de documento (v1)

| Campo | Tipo | Criação | Observação |
|--------|------|---------|------------|
| `supplierId` | string | obrigatório | imutável |
| `clientId` | string | obrigatório | imutável |
| `linkId` | string | obrigatório | ID do doc em `links/`; imutável |
| `requestedAmount` | **int** (centavos BRL) | obrigatório | 1 ≤ valor ≤ 9_999_999_999; imutável |
| `clientNote` | string | obrigatório | até 1000 caracteres; imutável; pode ser `""` |
| `status` | string | obrigatório (`pending`) | ver transições nas rules |
| `createdAt` | timestamp | obrigatório (`request.time` no servidor) | imutável |
| `updatedAt` | timestamp | obrigatório | nas transições negociais (cancelamento / fornecedor / CN) atualiza (`serverTimestamp`). **Exceção v1.1 RB:** marcadores `readBy*` não alteram `updatedAt`. |
| `supplierNote` | string | opcional | até 1000 caracteres; só fornecedor; ausente na criação |
| `approvedAmount` | int | opcional | só em `approved`: igual a **`requestedAmount`** (aprovação direta pelo fornecedor) **ou** igual a **`counterofferAmount`** (cliente aceitou contraposta) |
| `respondedAt` | timestamp | opcional | `approved` · `rejected`; na fatia CN também quando o cliente aceita ou declina a contraposta a partir de `counteroffer`. |
| `cancelledAt` | timestamp | opcional | `cancelled_by_client` |
| `counterofferAmount` | int (centavos BRL) | opcional (**v1.1 CN**) | só após ramo dedicado **fornecedor** → `counteroffer`; mesmos limites que `requestedAmount`; **≠** `requestedAmount`; **rodada única** |
| `counterofferedAt` | timestamp | opcional (**v1.1 CN**) | preenchido quando o fornecedor envia a contraposta |
| `readByClientAt` | timestamp | opcional | **v1.1 RB**: metadado de leitura do cliente (`clientId`), sem relação jurídica; ausente para pedidos só v1 anterior |
| `readBySupplierAt` | timestamp | opcional | **v1.1 RB**: metadado de leitura do fornecedor (`supplierId`) |

**Status pré-financeiros** (`loanRequests`): incluem `pending`, `under_review`, `counteroffer` (efeito de “aberto” no app também para duplicidade por `linkId`), terminais `approved`, `rejected`, `cancelled_by_client`, `counteroffer_declined`. **`converted_to_contract`** não é usado (continua fora deste modelo).

**Fatia RB (`readBy*`)**: apenas o papel correspondente pode escrever o próprio campo; diff **somente** o marcador; **`updatedAt` não muda** (política B); estados permitidos incluem **`counteroffer`** e **`counteroffer_declined`** (ver `loanRequestStatusAllowsReadMarkers` em `firestore.rules`).

## Valores em centavos

Ex.: R$ 100,00 → `10000`. Limites alinhados ao contrato Subfase 1 (0,01 a 99.999.999,99 BRL).

## Duplicidade (1 pedido aberto por `linkId`)

As **rules não verificam unicidade entre documentos** (limitação do Firestore Security Rules). Na **UI de criação** (`createLoanRequest` / cliente), antes de gravar:

1. Consultar `loanRequests` com **`where('clientId', '==', clientUid)`** (compatível com as rules ao listar) e **`where('linkId', '==', linkId)`** e **`where('status', 'in', ['pending', 'under_review', 'counteroffer'])`**, `limit(1)` — ver `findOpenLoanRequestForLinkId(linkId, clientUid)`.
2. Se existir documento, abortar criação ou orientar o usuário.

Índices compostos relevantes em [`firestore.indexes.json`](../firestore.indexes.json) incluem **`clientId` + `linkId` + `status`** (pré-check de duplicidade) e opcionalmente `linkId` + `status` (legado/evolução).

**UI cliente (Subfase 3):** Configurações → Conta → “Abrir solicitações” (`LoanRequestsClientPanel.jsx`) — chama `findOpenLoanRequestForLinkId(linkId, clientUid)` antes de gravar.

**UI fornecedor:** `LoanRequestsSupplierPanel.jsx` — além das transições v1 (`pending` → `under_review`; `pending` | `under_review` → `approved` com **`approvedAmount` = `requestedAmount`** ou → `rejected`), **Fatia CN v1.1**: `pending` | `under_review` → **`counteroffer`** com **`counterofferAmount`**, **`counterofferedAt`**, mesmo **`updatedAt`** (sentinela única), `supplierNote` opcional (**omitido se vazio**). **Rodada única**: nas Security Rules só há **nova** contraproposta válida quando **não existe** um par já “commitado” (**valor em centavos inteiro válido** + **`counterofferedAt` timestamp** via `loanRequestHasCommittedCounteroffer` — chaves com **`null`/inválidas** não bloqueiam a primeira rodada).

**UI cliente — contraposta pendente (`counteroffer`):** `LoanRequestsClientPanel.jsx`: aceitar → `approved` com **`approvedAmount` = valor armazenado em `counterofferAmount`**; ou declinar → **`counteroffer_declined`** (terminal). **Cancelar pelo cliente não está disponível** nesse estado (só `pending` | `under_review`).

## Índices compostos

Arquivo: [`firestore.indexes.json`](../firestore.indexes.json)

- `clientId` ASC, `createdAt` DESC — lista do cliente.
- `supplierId` ASC, `createdAt` DESC — lista do fornecedor (**UI Subfase 4**: Conta → Pedidos recebidos).
- `linkId` ASC, `clientId` ASC, `status` ASC — pré-check duplicidade com escopo cliente (queries compatíveis com rules).

Após alterar índices: `firebase deploy --only firestore:indexes` (ou deploy completo do Firestore).

## Vínculo revogado / não aprovado

Toda **escrita** que altera o pedido exige `links/{linkId}` com `status == 'approved'` e participantes coerentes. Se o vínculo deixar de estar aprovado, **updates** passam a falhar; **leitura** do histórico continua permitida para participantes.

Para **nova solicitação após vínculo encerrado** (`rejected`, `cancelled_by_client`, `revoked_by_supplier`), o mesmo documento deterministic `links/{supplierId__clientId}` é reaberto pelo cliente como `pending` (ver `createLinkRequest` em `links.js` e transição nas rules).

## Deploy

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

**Contrato forma v1 / v1.1:** Subfase 1 — [`plans/completed/LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`](./plans/completed/LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md); **v1.1 RB + CN** — [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./plans/completed/LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md) (histórico / arquivado).

**Pacote loanRequest v1** (baseline): **fechado** — QA em [`plans/completed/QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md).

**Fatias v1.1 em código neste repo:** **RB** (`readBy*`); **CN**: estados `counteroffer` e `counteroffer_declined` com contraposta de rodada única. **Suite de rules (emulador):** `npm run test:rules:loanRequests` — executa **`loanRequestsCreate.rules.test.js`** + **`loanRequestsCounteroffer.rules.test.js`** dentro do Firestore Emulator (requer JDK 21+; ver `scripts/run-firestore-rules-tests.ps1`).

Modelo atual: tabela acima inclui **`counterofferAmount`**, **`counterofferedAt`** e estados CN; escritas CN atualizam `updatedAt` como demais transições negociais **fora RB**.

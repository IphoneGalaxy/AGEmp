# Firestore — `loanRequests` (v1 pré-financeira)

**Contrato funcional:** [`LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`](./LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md)  
**Helpers:** [`src/firebase/loanRequests.js`](../src/firebase/loanRequests.js) · **Firestore (CRUD cliente/fornecedor):** [`src/firebase/loanRequestsFirestore.js`](../src/firebase/loanRequestsFirestore.js)  
**Rules:** [`firestore.rules`](../firestore.rules) (funções `loanRequest*`)

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
| `updatedAt` | timestamp | obrigatório | atualizado a cada escrita |
| `supplierNote` | string | opcional | até 1000 caracteres; só fornecedor; ausente na criação |
| `approvedAmount` | int | opcional | só em `approved`; igual a `requestedAmount` |
| `respondedAt` | timestamp | opcional | `approved` / `rejected` |
| `cancelledAt` | timestamp | opcional | `cancelled_by_client` |

**Proibido na v1:** `counterofferAmount`, `readByClientAt`, `readBySupplierAt` (e status `counteroffer` / `converted_to_contract`).

## Valores em centavos

Ex.: R$ 100,00 → `10000`. Limites alinhados ao contrato Subfase 1 (0,01 a 99.999.999,99 BRL).

## Duplicidade (1 pedido aberto por `linkId`)

As **rules não verificam unicidade entre documentos** (limitação do Firestore Security Rules). Na **Subfase 3 (UI + fluxo)**, antes de criar:

1. Consultar `loanRequests` com `where('linkId', '==', linkId)` e `where('status', 'in', ['pending', 'under_review'])`, `limit(1)`.
2. Se existir documento, abortar criação ou orientar o usuário.

Índice composto: `linkId` + `status` — ver [`firestore.indexes.json`](../firestore.indexes.json).

**UI cliente (Subfase 3):** Configurações → Conta → “Abrir solicitações” (`LoanRequestsClientPanel.jsx`) — chama `findOpenLoanRequestForLinkId` antes de gravar.

**UI fornecedor (Subfase 4):** Configurações → Conta → “Abrir pedidos recebidos” (`LoanRequestsSupplierPanel.jsx`). Transições: `pending` → `under_review`; `pending` | `under_review` → `approved` (com `approvedAmount` igual ao `requestedAmount` do documento) ou `rejected`; `supplierNote` opcional (até 1000 caracteres).

## Índices compostos

Arquivo: [`firestore.indexes.json`](../firestore.indexes.json)

- `clientId` ASC, `createdAt` DESC — lista do cliente.
- `supplierId` ASC, `createdAt` DESC — lista do fornecedor (**UI Subfase 4**: Conta → Pedidos recebidos).
- `linkId` ASC, `status` ASC — checagem de duplicidade aberta.

Após alterar índices: `firebase deploy --only firestore:indexes` (ou deploy completo do Firestore).

## Vínculo revogado / não aprovado

Toda **escrita** que altera o pedido exige `links/{linkId}` com `status == 'approved'` e participantes coerentes. Se o vínculo deixar de estar aprovado, **updates** passam a falhar; **leitura** do histórico continua permitida para participantes.

## Deploy

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

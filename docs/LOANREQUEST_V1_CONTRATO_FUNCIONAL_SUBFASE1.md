# LoanRequest v1 — contrato funcional (Subfase 1 concluída)

**Tipo:** especificação curta congelada para o primeiro PR técnico (modelo remoto + rules — Subfase 2).  
**Origem:** `docs/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md` + fontes oficiais do repositório.  
**Data de congelamento:** 2026-04-30.

---

## Guardrails (inalteráveis nesta fase)

- Pré-financeiro/relacional apenas; sem sync financeiro remoto; sem conversão automática em contrato.
- Sem `payment.linkContext`; sem alterações em `calculations.js`; vínculo remoto não é permissão financeira local.
- Financeiro local permanece por escopo `anonymous` e `account:{uid}`.

---

## Escopo v1 congelado

| Decisão | Escolha |
|--------|---------|
| `under_review` na v1 | **Sim** — fornecedor pode marcar `pending` → `under_review`. |
| `counteroffer` na v1 | **Não** — fica para **v1.1** (menor superfície de rules, QA e campos). |
| Leitura `readByClientAt` / `readBySupplierAt` | **Não** na v1 — adiar (sem FCM; primeiro PR focado em CRUD e transições). |

---

## Status utilizados na v1

- **Abertos (não terminais):** `pending`, `under_review`
- **Terminais:** `approved`, `rejected`, `cancelled_by_client`
- **Documentados mas inativos na v1:** `counteroffer`, `converted_to_contract` (não expor como ação nem transição).

---

## Duplicidade (regra final)

- **No máximo um pedido “aberto” por `linkId`.**
- **Aberto** = `status ∈ { pending, under_review }`.
- Após qualquer terminal (`approved`, `rejected`, `cancelled_by_client`), novo pedido para o mesmo `linkId` é permitido.
- Validação esperada na Subfase 2: checagem na criação (cliente) + consistência em regras/transações conforme desenho técnico.

---

## Limites de valor (`requestedAmount`)

- Moeda **BRL**; **2 casas decimais**; tipo de armazenamento (número, centavos, string decimal) definido na Subfase 2.
- **Mínimo:** 0,01.
- **Máximo:** 99.999.999,99 (teto numérico explícito para evitar abuso e overflow de UX).

---

## Limites de nota

- `clientNote` e `supplierNote`: opcionais; **máximo 1000 caracteres** UTF-8 após trim; string vazia permitida.
- **Quebra de linha:** normalizar `\r\n` → `\n` na persistência (detalhe na Subfase 2).

---

## Transições permitidas na v1

**Cliente**

- Cria documento: sempre `status = pending` (campos obrigatórios de vínculo: `supplierId`, `clientId`, `linkId`, `requestedAmount`).
- `pending` → `cancelled_by_client`
- `under_review` → `cancelled_by_client`

**Fornecedor**

- `pending` → `under_review`
- `pending` ou `under_review` → `approved`
- `pending` ou `under_review` → `rejected`

**Não permitido na v1**

- `under_review` → `pending` (sem “desmarcar análise”).
- Qualquer transição a partir de status terminais.
- Qualquer transição para `counteroffer` ou `converted_to_contract`.

**Semântica de aprovação (sem contraproposta)**

- Em `approved`, **`approvedAmount` é obrigatório** e **deve ser numericamente igual a `requestedAmount`** (após normalização de decimais).

**Timestamps**

- `createdAt` / `updatedAt`: sempre atualizados nas escritas permitidas.
- `respondedAt`: preenchido quando o fornecedor leva a `approved` ou `rejected`.
- `cancelledAt`: preenchido quando o cliente leva a `cancelled_by_client`.

---

## Imutabilidade na v1

- Após criação, **não editar:** `supplierId`, `clientId`, `linkId`, `requestedAmount`, `clientNote`.
- `supplierNote` e campos de status/timestamps/resposta do fornecedor são mutáveis nas transições permitidas.

---

## Vínculo revogado / não aprovado

- Criação exige vínculo **aprovado** coerente com `linkId`, `supplierId`, `clientId` (espelhado nas rules).
- Se o vínculo deixar de estar aprovado **após** criação: **bloquear novas transições** que alterem o pedido (leitura histórica permitida conforme rules); estratégia exata (snapshot vs consulta ao `links`) é da Subfase 2.

---

## Fora do escopo explícito da v1

- `counteroffer`, `converted_to_contract`, leituras `readBy*`.
- FCM, Cloud Functions, fila assíncrona.
- UI (qualquer tela); este documento só fecha contrato funcional.
- Ordenação avançada, filtros complexos, export de pedidos, analytics.
- Qualquer escrita no domínio financeiro local ou em coleções financeiras remotas.

---

## Checklist de aceite — primeiro PR técnico (Subfase 2)

- [ ] Coleção/path `loanRequests` definido; campos mínimos e tipos documentados na spec técnica da Subfase 2.
- [ ] Rules impedem leitura/escrita por usuários que não sejam `clientId` ou `supplierId` do documento.
- [ ] Criação restrita a papel efetivo **client**; transições de fornecedor restritas a papel **supplier**; `accountRoles` com fallback ao `role` legado refletido nas rules ou camada de validação única.
- [ ] Criação valida vínculo aprovado e coerência `linkId`/`supplierId`/`clientId`.
- [ ] Criação rejeita segundo pedido **aberto** para o mesmo `linkId`.
- [ ] `requestedAmount` respeita mínimo/máximo e precisão decimal acordada.
- [ ] Notas respeitam tamanho máximo após trim.
- [ ] Todas as transições fora da matriz acima são rejeitadas.
- [ ] Terminais não aceitam atualização de estado (exceto política futura explícita — hoje: nenhuma).
- [ ] Nenhuma escrita em clientes/contratos/pagamentos/caixa/dashboard/backups locais ou remotos financeiros.
- [ ] `converted_to_contract` e `counteroffer` inativos (sem paths de update que os ativem).

---

## Referências

- `docs/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md`
- `docs/NEXT_PHASE_OFFICIAL.md`
- `docs/HANDOFF_MASTER.md`
- `docs/CHECKPOINT_CHECKLIST.md`

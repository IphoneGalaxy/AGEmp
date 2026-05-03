# Matriz QA — `loanRequest` v1 (pré-financeira)

**Status:** **FECHADO** — pacote v1 encerrado formalmente após **smoke manual real** (dois usuários) **sem NOK crítico** (registro 2026-05-01). Matriz abaixo foi critério de aceite; resultado consolidado em § **Registro formal — gate manual**.  
**Contrato funcional:** [`LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`](./LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md)  
**Camada Firestore:** [`FIRESTORE_LOANREQUESTS.md`](../../FIRESTORE_LOANREQUESTS.md)  
**Complemento:** regressão geral em [`QA_MATRIX_GENERAL.md`](../../QA_MATRIX_GENERAL.md); vínculo/`linkContext` em [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](../../QA_MATRIX_LINK_OPERATIONAL_VIEW.md).

**Planejamento histórico (execução v1):** [`PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md`](./PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md) — arquivo concluído em `docs/plans/completed/`; não substitui docs vivos como fonte prioritária.

**Próximo planejamento (não altera o fechamento desta matriz):** [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md) (arquivado no mesmo diretório) · [`QA_MATRIX_LOANREQUEST_V1_1.md`](../../QA_MATRIX_LOANREQUEST_V1_1.md)

Registrar data, ambiente (build/commit), operador e **OK / NOK / N/A** por linha. NOK crítico bloqueia promoção a LKG que inclua esta fatia.

---

## Guardrails globais (obrigatórios)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| G1 | Criar/responder/cancelar `loanRequest` | Não escreve clientes financeiros no Firestore | |
| G2 | Idem | Não escreve contratos financeiros remotos | |
| G3 | Idem | Não escreve pagamentos financeiros remotos | |
| G4 | Idem | Caixa, dashboard e cálculos locais inalterados (`calculations.js` intocado) | |
| G5 | Fluxo completo | `payment.linkContext` continua inexistente | |
| G6 | Usuário **sem** conta | App financeiro local disponível; fluxo remoto de pedidos simplesmente não se aplica | |
| G7 | Backup/export/import local | Pedidos remotos **não** entram como domínio financeiro local | |

---

## Conta, papéis e vínculo

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| R1 | Cliente com papel efetivo `client` + vínculo **aprovado** | Acesso a Conta → Abrir solicitações; vê fornecedor na lista | |
| R2 | Cliente **sem** vínculo aprovado | Mensagem clara; não envia pedido | |
| R3 | Conta sem papel cliente (ou papel não confirmado) | Entrada “Abrir solicitações” não disponível ou orientação coerente | |
| R4 | Fornecedor com papel efetivo `supplier` | Conta → Abrir pedidos recebidos lista pedidos em que é `supplierId` | |
| R5 | Conta sem papel fornecedor | Entrada de pedidos recebidos não disponível ou orientação coerente | |
| R6 | `accountRoles` + fallback `role` legado | Criação/resposta respeitam regras (cliente cria; fornecedor responde) | |
| R7 | Terceiro (outro UID) | Não lê pedido alheio (Firestore/recusa de query) | |

---

## Criação (cliente)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| C1 | Valor válido, nota vazia | Pedido criado `pending`; toast/confirmação coerente | |
| C2 | Valor válido + nota ≤ 1000 chars | Persistido; contador de caracteres coerente na UI | |
| C3 | Valor vazio / zero / negativo / acima do teto | Bloqueio com mensagem clara (sem escrita) | |
| C4 | Segundo pedido **aberto** mesmo `linkId` (`pending` ou `under_review`) | Bloqueio com mensagem de duplicidade | |
| C5 | Campos remotos | `supplierId`, `clientId`, `linkId` coerentes com vínculo aprovado | |
| C6 | Após criar | Lista local de clientes/contratos/caixa/dashboard **inalterada** | |

---

## Listagem e erros

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| L1 | Cliente | Lista “Meus pedidos enviados” coerente com Firestore | |
| L2 | Fornecedor | Lista “Pedidos recebidos” coerente | |
| L3 | Lista vazia | Empty state legível (cliente e fornecedor) | |
| L4 | Falha de rede / permissão | `role="alert"`; app financeiro local continua utilizável | |
| L5 | Atualizar lista | Recarrega sem quebrar estado global do app | |

---

## Resposta (fornecedor) e transições v1

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| S1 | `pending` → `under_review` | Permitido; cliente vê “Em análise” | |
| S2 | `pending` ou `under_review` → `approved` | `approvedAmount` = `requestedAmount`; `respondedAt` preenchido | |
| S3 | `pending` ou `under_review` → `rejected` | Terminal; sem volta a aberto | |
| S4 | Contraproposta / status `counteroffer` | **Fora da v1 — N/A** (não deve existir ação nem campo) | |
| S5 | Cliente cancela `pending` | `cancelled_by_client` | |
| S6 | Cliente cancela `under_review` | `cancelled_by_client` se permitido pelo contrato/rules | |
| S7 | Transição inválida (ex.: terminal → aberto) | Firestore/rules ou payload rejeita | |
| S8 | Pedido encerrado no painel fornecedor | Mensagem de encerramento; sem botões de ação | |

---

## Cancelamento e leitura (cliente)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| K1 | Cancelar pedido aberto | Lista atualiza; não altera financeiro local | |
| K2 | Pedido `approved` / `rejected` | Cliente vê nota do fornecedor (se houver), data de resposta e reforço “não cria contrato” no aprovado | |

---

## UX e microcopy

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| U1 | Textos introdutórios | Não sugerem financeiro sincronizado na nuvem | |
| U2 | Pedido aprovado | Copy deixa explícito que **não** criou contrato no app | |
| U3 | Mobile | Cards legíveis; alvos de toque ≥ sensação de 44px onde há botão | |
| U4 | Status | Rótulo textual sempre visível (não só cor) | |

---

## Regressão local-first (após fluxos acima)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| F1 | Dashboard / caixa / clientes / contratos / pagamentos | Iguais aos valores esperados antes dos testes de pedido | |
| F2 | Export/import | Funciona como antes do ciclo de pedidos | |

---

## Critério de saída do pacote v1

- Todos **G*** e **F*** com OK.  
- **R*, C*, L*, S* (exceto S4 N/A), K*, U*** sem NOK crítico.  
- Smoke manual com **dois usuários reais** (fornecedor + cliente) executado pelo menos uma vez antes de promover LKG que inclua esta fatia.

**Este critério foi satisfeito** — ver § Registro formal abaixo.

---

## Registro formal — gate manual (smoke real, fechamento v1)

| Campo | Registro |
|-------|----------|
| **Resultado** | **OK integral** — **sem NOK crítico** |
| **Escopo exercitado** | Conta → **Abrir solicitações** e **Abrir pedidos recebidos**; vínculo aprovado alimentando criação do pedido; fluxos **aprovado / rejeitado / cancelado** refletindo nos dois lados |
| **Guardrail financeiro** | **Financeiro local permaneceu intacto** após os pedidos (sem alteração atribuível ao fluxo `loanRequest`) |
| **Operador** | Humano (atestado para fins de governança deste repositório) |
| **Data do registro documental** | 2026-05-01 |
| **Commit documental / peel da tag LKG** | Verificar no clone atualizado: `git rev-parse lkg-2026-05-01-loanrequest-v1-complete^{commit}` |
| **Tag LKG** | `lkg-2026-05-01-loanrequest-v1-complete` (annotated) |

### Consolidado por grupo (atestado no smoke)

| Grupo | IDs | Resultado |
|-------|-----|-----------|
| Guardrails | G1–G7 | **OK** |
| Conta / vínculo | R1–R7 | **OK** |
| Criação | C1–C6 | **OK** |
| Listagem / erros | L1–L5 | **OK** |
| Resposta fornecedor | S1–S3, S5–S8; S4 **N/A** | **OK** / **N/A** |
| Cancelamento / leitura cliente | K1–K2 | **OK** |
| UX / microcopy | U1–U4 | **OK** |
| Regressão local-first | F1–F2 | **OK** |

*(Detalhamento linha a linha das tabelas acima permanece como especificação; o smoke real validou o comportamento esperado em conjunto.)*

---

## Histórico

| Data | Nota |
|------|------|
| 2026-04-30 | Criação da matriz executável para fechamento Subfase 5 (pacote v1). |
| 2026-05-01 | **Fechamento formal:** smoke manual real bem-sucedido; gate OK integral sem NOK crítico; pacote v1 **FECHADO**. Tag **`lkg-2026-05-01-loanrequest-v1-complete`** (annotated). |
| 2026-05-01 | Planejamento-mestre da execução v1 movido para [`PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md`](./PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md) (`docs/plans/completed/`); ver [`plans/README.md`](../README.md). |

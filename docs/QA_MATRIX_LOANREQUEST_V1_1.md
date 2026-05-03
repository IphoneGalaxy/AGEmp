# Matriz QA — `loanRequest` v1.1 (pré-financeira — planejada)

**Status:** **EXECUTÁVEL após implementação** — até lá, apenas planejamento.  
**Pacote anterior fechado:** [`QA_MATRIX_LOANREQUEST_V1.md`](./QA_MATRIX_LOANREQUEST_V1.md) (v1 + LKG `lkg-2026-05-01-loanrequest-v1-complete`)  
**Especificação v1.1:** [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md) · [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md)

Registrar data, ambiente (`build`/commit/tag), operador e **OK / NOK / N/A** por linha. **NOK crítico bloqueia** promoção a LKG que inclua estas fatias.

---

## Como usar esta matriz (duas promoções opcionais)

A governança v1.1 pode promover primeiro só **Fatia RB** (`readBy*`) ou fechar **`loanRequest` v1.1** completo só após RB + CN (contraproposta). Ao executar apenas Fatia RB, marque todas as linhas **CN*** como **N/A** até a segunda entrega.

| ID da fatia | Conteúdo |
|-------------|----------|
| **RB** | `readByClientAt` · `readBySupplierAt` |
| **CN** | `counteroffer` + terminal `counteroffer_declined` + decisão cliente |

---

## Guardrails globais (obrigatórios — herança v1 estendida)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| G1 | Fluxos RB/CN conforme aplicável | Não altera dados financeiros locais (dashboard/clientes/contratos/pagamentos/caixa) | |
| G2 | Idem | Não grava coleções autoritativas financeiras remotas | |
| G3 | Idem | `calculations.js` permanece efetivamente intocado pela fatia RB/CN | |
| G4 | Idem | `payment.linkContext` continua inexistente após cenários RB/CN | |
| G5 | Usuário sem conta | App financeiro local disponível como hoje sem dependência obrigatória de pedidos remotos | |
| G6 | Backup/export/import | Pedidos continuam **fora** do domínio financeiro serializado localmente | |

---

## Conta, papéis e vínculo (regressão mínima v1 → v1.1)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| R1 | Smoke dois usuários reais cliente+fornecedor | Continua sendo critério mínimo de confiança em promoção marcada pela governança | |
| R2 | Terceiros | Pedido não acessível/fora das queries permitidas conforme [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) após atualização das rules | |
| R3 | `accountRoles` + fallback legacy | Todas escritas/leituras respeitam papéis efetivos atualizados | |

---

## Fatia RB — leituras `readBy*`

### Regras e shape

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| RB1 | Participante atualiza apenas **seu** `readBy*` | Outro lado não consegue forjar timestamp alheio | |
| RB2 | `readBy*` vazio em doc legado criado só em v1 | UI/Rules coexistem sem quebrar leituras | |
| RB3 | Múltiplas aberturas de detalhe | Política de monotonia servidor documentada aplicada conforme especificação A/B de `updatedAt` | |

### UX / produto RB

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| RB4 | Lista/detalhes pedido | Indicadores discretos (texto forte + opcional marcação suave conforme DESIGN) — não prometem garantia/notificação | |
| RB5 | Microcopy | **Não** sugere obrigação de resposta, financeiro sincronizado na nuvem nem contrato | |

### Regressão fluxos já fechados v1 durante RB apenas

Executar cenários **`pending`/`under_review`/aprovar/recusar/cancelar** da matriz v1 marcando apenas OK se **idênticos** ao comportamento validado antes; qualquer regressão ⇒ NOK **crítico**.

---

## Fatia CN — contraproposta (rodada única)

### Criação e unicidade por vínculo

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| CN1 | Novo campo `counteroffer*` | só aparece quando `status` permite | |
| CN2 | `counterofferAmount` válido vs limites v1 (`LOANREQUEST...SUBFASE1`) | escritas válidas apenas nos limites de centavos | |
| CN3 | “Segundo pedido aberto mesmo `linkId`” durante `pending/under_review/counteroffer` | bloqueado / impossibilitado igual espírito v1 (+ novo status aberto) | |

### Fornecedor

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| CN4 | Pendente/em análise → contraproposta | Estado `counteroffer`; timestamp `counterofferedAt` coerente; valor ≠ solicitado obrigatório | |
| CN5 | Fornecedor ainda pode aprovar/recusar sem contraposta | regressão igual v1 onde aplicável | |
| CN6 | Transições ilegais (ex.: `counteroffer` ⇒ `pending`) | rejeitadas por helpers/rules | |

### Cliente na contraposta

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| CN7 | `counteroffer` → aceitar | `approved` · `approvedAmount == counterofferAmount` · texto reforço “**não cria contrato**” aparece igual ou mais forte ao v1 | |
| CN8 | `counteroffer` → declinar | terminal `counteroffer_declined`; rotulagem clara de que encerrou apenas o pedido remoto/pre-financeiro | |
| CN9 | Cliente cancela pedido apenas estados já permitidos v1 OU conforme atualização textual | regressão igual v1 + novas permissões apenas se decididas no PR | |

### UX obrigatório CN

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| CN10 | Estado “Contraposta” visual | Hierarquia: valor solicitado + valor contra + status textual além da cor (**DESIGN**/acessível) | |
| CN11 | Mobile | Mantém alvos mínimos (44px onde botão conforme projeto) ou exceções documentadas apenas inline compacto | |

### Regressão local-first obrigatória

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| F1 | Após cenários RB+CN combinados esperados pelo smoke atual | valores financeiros locais antes/depois inalterados atribuível ao fluxo remoto pré-financeiro | |
| F2 | Export/import | igual ao cenário antes do smoke | |

---

## Critério de saída sugerido (pré-promoção LKG incluindo v1.1)

- Todos os **G\*** esperados pela fatia marcada ⇒ OK.  
- **RB\*** com OK quando RB entregue.  
- **CN\*** com OK quando CN entregue.  
- Zero NOK **crítico** em regressão v1 (§ RB último bloco) e **F1–F2** OK sempre que qualquer lado da v1.1 estiver vivo no build.

*(Detalhar build/tag exato quando houver primeira execução real.)*

---

## Histórico

| Data | Nota |
|------|------|
| 2026-05-03 | Criação da matriz planejável v1.1 alinhada à ordem de entrega oficial documentada (`readBy*` → `counteroffer`). |

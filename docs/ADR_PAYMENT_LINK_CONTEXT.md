# ADR — Estado atual de vínculo em pagamento (`payment.linkContext`)

**Tipo:** Architectural decision record · **Escopo decisão atual**  
**Projeto:** AGEmp / Finanças Pro

## Status da decisão (hoje)

- **Aceita e válida até revisão futura**: pagamentos **não** persistem `payment.linkContext`.  
  A exibição de contexto relacionado ao vínculo na lista de pagamentos usa **somente derivação** a partir do snapshot local do contrato (`loan.linkContext`), conforme implementação atual e [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md).

## Contexto

- **`client.linkContext`**: primeira anotação no cadastro do cliente (metadado local opcional reversível).
- **`loan.linkContext`**: snapshot local opcional do contrato, pode divergir do cliente.
- **Pagamento**: permanece apenas registro financeiro local clássico no modelo atual (identificador temporal e valor dentro do contrato), **sem** campo `payment.linkContext` persistido.
- Diretrizes congeladas: domínio financeiro **local-first** nesta linha de evolução; **sem sync financeiro remoto**; [`calculations.js`](../src/utils/calculations.js) fora das decisões opcionais de metadados de vínculo.

## Decisão

1. **Manter decisão atual**: não adicionar `payment.linkContext` à persistência até existir revisão deliberada segundo critérios abaixo.

2. **Semântica de exibição hoje**: o que aparece próximo a um pagamento no UI é **somente reflexo espelho** do que está em `loan.linkContext` no momento da visualização/listagem derivada pelo utilitário de exibição.

3. **Consequências deliberadas já assumidas pela arquitetura atual**  
   Alterar/atualizar o snapshot `loan.linkContext` num contrato com histórico de pagamentos **pode mudar retrospectivamente apenas a etiqueta/UI do vínculo** associada aos pagamentos antigos porque não há captura pró-pagamento persistida separadamente. Isso já está documentado também em [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) sob “o vínculo local ainda não gera auditoria imutável por pagamento”. Não interpretar como regressão só por essa característica até que exista novo requisito explícito de histórico imutável linha por linha financeira contextualizada.

## Opção futura (não ativa — critérios de reabrir)

Um snapshot persistido próprio **`payment.linkContext`** somente será considerado se **simultaneamente** houver pelo menos uma destas justificativas fortes já formalizadas com PM/Produto/arquiteto:

| Gatilho | Descrição mínimo |
|---------|---------------------|
| A | Requisitos explícitos de **auditoria imutável** por lançamento financeiro já identificado unicamente onde o snapshot do vínculo do contrato seja insuficiente. |
| B | Projeto decidido oficialmente iniciar alguma forma de **sincronização financeira autoritativa** multi-dispositivos ou servidor que exija anotações coladas ao evento econômico (ainda assim exigiria desenho de migrações e conflitos fora deste snapshot ADR atual). |

Enquanto nenhuma condição forte estiver decidida formalmente na governança do produto (`HANDOFF`/checkpoint + commit de ADR atualizado futuro), esta ADR preserva estado **negativo opcional**.

## Impacto arquitetural se `payment.linkContext` fosse revisitado algum dia

Alto impacto porque afeta:

- `src/utils/storage.js` / normalização e compatibilidade de backups antigos
- formato import/export/auto-backups
- testes de migração e integridade de regressão QA geral/manual

Por isso a barreira atual é **elevada conscientemente**.

## Como esta ADR relaciona outros documentos

| Documento | Papel |
|-----------|-------|
| [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md) | Regressão geral garantindo ausência física campo pagamento próprio até decisão revisitada oficialmente aqui atualizada futuramente |
| [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md) | Guardrail explícito de ausência campo pagamento próprio já existente antes desta formalização mais global |

---

### Histórico

| Data | Change |
|------|--------|
| 2026-04-29 | Primeira versão; alinhada aos critérios consolidados pós-LKG e governança atual. |

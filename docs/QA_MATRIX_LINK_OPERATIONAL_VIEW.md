# Matriz QA — visão operacional local por vínculo

Checklist regressivo quando a decisão consolidada em [`LINK_OPERATIONAL_VIEW.md`](./LINK_OPERATIONAL_VIEW.md) estiver materializada nas telas/utils.

Guardrails obrigatórios (critérios de falha grave):

| # | Critério | Esperado |
|---|----------|----------|
| G1 | `payment.linkContext` | Não existe em armazenamento nem em backup/import. |
| G2 | `calculations.js` | Inalterado; totais/caixa/dashboard não mudam pela visão por vínculo. |
| G3 | Domínio financeiro na nuvem | Nenhum cliente/contrato/pagamento/caixa gravado remotamente nesta linha. |
| G4 | Escopo `anonymous` vs `account:{uid}` | Dados permanecem isolados por escopo atual. |

## 1. Dados derivados (`linkOperationalDerive`)

- Contagem por `linkId` combina apenas `client.linkContext` e `loan.linkContext`.
- Contratos só em `loan`; pagamentos só entram como **quantidade** de itens em `loan.payments` nos contratos anotados com aquele vínculo.
- `linkId` só em préstimos (sem cliente anotado) aparece nas opções; rótulo e contagens devem faz sentido.

## 2. Aba Clientes (`ClientsList`)

- Filtros Todos / Com anotação / Sem anotação inalterados em comportamento.
- Refinar por vínculo mostra texto enriquecido (clientes, contratos, pag. nos contratos anotados).
- Com vínculo selecionado, linha auxiliar não sugere sincronização com nuvem nem promete dados financeiros remotos.

## 3. Fluxos combinados pré-existentes

- Criação de cliente herda vínculo ao filtro ainda válido.
- Lote só com refinamento válido conforme já existente.
- Ao abrir `ClientView`, contratos/filtros de empréstimo e lista de pagamentos seguem apenas `loan.linkContext` para exibição.

## 4. Backups / importação

- Export/import com cliente + contratos anotados e sem `linkContext` legado preserva comportamento anterior.
- Dados pré-`interestRate`/formato antigo: sem regressão de migração.

## 5. Mobile / UX (`DESIGN` / `BRAND` / `PROJECT_OVERRIDES`)

- Texto novo legível sem poluir valores monetários prioritários.

## 6. Automação

- `npx vitest run` incluindo novos testes de `linkOperationalDerive`.
- `npm run build`.

| Data | Nota |
|------|------|
| 2026-04-29 | Checklist inicial alinhado a `LINK_OPERATIONAL_VIEW`. |

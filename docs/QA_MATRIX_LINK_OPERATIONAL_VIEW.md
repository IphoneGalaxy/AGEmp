# Matriz QA — visão operacional local por vínculo

**Referência principal de materialização (lista Clientes + utils):** tag **`lkg-2026-04-28-link-operational-view`** · commit **`28f7936`**.

**Fechamento do bloco `ClientView` (overlay):** tag **`lkg-2026-04-30-clientview-operational-link-block-complete`** — confirmar commit com `git rev-parse lkg-2026-04-30-clientview-operational-link-block-complete`; cobre resumo operacional, espelho em pagamentos e estados vazio/erro/divergência; antecessores úteis: `lkg-2026-04-29-clientview-operational-link-reading`, `lkg-2026-04-30-clientview-payment-derived-reading`.

Checklist regressivo quando a decisão consolidada em [`LINK_OPERATIONAL_VIEW.md`](./LINK_OPERATIONAL_VIEW.md) estiver materializada nas telas/utils, **e** para regressão específica do overlay [`ClientView.jsx`](../src/components/ClientView.jsx) após mudanças na linha de vínculo.

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
- `linkId` só em préstimos (sem cliente anotado) aparece nas opções; rótulo e contagens devem fazer sentido.

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

- `npx vitest run` incluindo novos testes de `linkOperationalDerive`, `clientLoanLinkContextSummary` e `paymentLinkContextDisplay`.
- `npm run build`.

## 7. Overlay `ClientView` — leitura operacional por vínculo

- Card opcional de vínculo deixa claro que é **neste aparelho** e não envia financeiro remoto.
- **Leitura operacional local:** contagens e mensagens batem com contratos anotados vs `client.linkContext` (incluindo “todos sem anotação”, só cliente anotado, só contratos anotados).
- **Divergência:** quando contratos usam `linkId` diferente do cliente, há aviso explícito como organização local (sem alterar totais).
- **Lista remota** (`listUserLinks`): loading; erro com `role="alert"` e texto de que o financeiro local segue ok; vazio sem vínculos aprovados; select + anotar/remover no cliente.
- **Contratos:** rótulo por relação cliente/contrato; atalho “anotar com vínculo atual do cliente” quando aplicável; filtros Com/Sem anotação com lista vazia tratada (mensagem + voltar a “Ver todos”).
- **Pagamentos:** cabeçalho/formulário deixam claro **espelho do contrato**; cada item usa apenas `loan.linkContext` via helper dedicado; mudança posterior no contrato **altera rótulo** dos pagamentos históricos (comportamento esperado — ver [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md)).

| Data | Nota |
|------|------|
| 2026-04-29 | Checklist inicial alinhado a `LINK_OPERATIONAL_VIEW`. |
| 2026-04-29 | Alinhado ao LKG `lkg-2026-04-28-link-operational-view` (`28f7936`). |
| 2026-04-30 | §7 `ClientView`; referência de fechamento `lkg-2026-04-30-clientview-operational-link-block-complete`. |
| 2026-04-30 | Complemento do gate final: smoke manual dos itens §§ 1–7 e automação §6 (`vitest`/build) permanecem válidos; overlay `ClientView` coberto em código/LKG — regressão fina ainda depende de operador humano para fechar **F2** da matriz geral. |

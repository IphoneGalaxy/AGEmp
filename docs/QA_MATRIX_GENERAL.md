# Matriz QA manual — geral (mínima)

Documento regressivo manual **ponto a ponto**, complementar ao [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) e ao [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md).

Não substitui a matriz específica da fatia vínculo: [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md).

## Base de execução

- **Referência opcional**: base estável atual `lkg-2026-04-28-link-operational-view` (confirmar commit com `git tag` / histórico de releases).
- Para cada cenário usar **marcar resultado** conforme esperado (**OK/NOK**/N/A ao ambiente).
- Ao finalizar um ciclo ou antes de novo LKG funcional pesado: preencher seção **Resumo**.

## Convenções rápidas

- **Escopo A**: `anonymous` — sem conta Firebase ativa usando dados ligados apenas ao modo local.
- **Escopo B**: `account:{uid}` — conta autenticada, dados financeiros no escopo da conta.
- **Legado**: fluxo já existente ao primeiro login (associar dados anônimos à conta / separar), quando aplicável.

---

## Guardrails globais

| ID | Esperado nesta sessão QA |
|----|---------------------------|
| G1 | Nenhuma escrita financeira em Firestore como fonte autoritativa (clientes, contratos, pagamentos, caixa, dashboard). |
| G2 | `payment.linkContext` **inexistente** em armazenamento e em backup/importação. |
| G3 | `calculations.js` não deve ser tocado pela validação manual (comportamento conferido apenas). |
| G4 | Vínculo remoto não vira permissão nem regra financeira obrigatória. |

---

## 1. Arranque, escopo e legado

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 1.1 | Abrir app com sessão já carregada; dashboard visível ou última aba. | Estado carrega sem erro de console relacionado ao motor. |
| 1.2 | **Escopo A** — modo sem conta: navegar Dashboard / Clientes / Configurações. | Dados visíveis coerentes com escopo anônimo atual. |
| 1.3 | Login + **Escopo B**. | Dados do escopo da conta; sem mistura inadvertida entre escopos no mesmo cenário planejado. |
| 1.4 | Fluxo decisão legado primeiro login quando aplicável. | UI clara e escolhas respeitadas; dados não somem inadvertidamente. |

---

## 2. Dashboard

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 2.1 | Totais/estados agregados exibidos. | Coerentes após operações válidas realizadas na própria sessão. |
| 2.2 | Legibilidade em viewport estreita (mobile). | Conforto aceitável; ver `DESIGN.md`/`BRAND.md`/`PROJECT_OVERRIDES.md` em alto nível. |

---

## 3. Clientes (`ClientsList`)

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 3.1 | Criar cliente simples sem vínculo. | Aparece na lista sem exigência de vínculo. |
| 3.2 | Filtrar Todos / Com anotação / Sem anotação. | Lista muda esperado; estado vazio com mensagens corretas. |
| 3.3 | Refinamento por vínculo (quando há opções derivadas dos dados locais). | Contagens aparecem; microcopy não sugere sincronização financeira remota. |
| 3.4 | Batch anotar/remover anotações (cenário possível atual). | Regras conservadoras respeitadas; feedback textual claro. |

---

## 4. Contrato em `ClientView` (visão alta)

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 4.1 | Criar empréstimo básico. | Exibições de valores e estado coerentes com o motor atual. |
| 4.2 | Filtrar contratos por presença de anotação de vínculo (UI existente). | Comportamento coerente. |
| 4.3 | Gestão manual de anotação no contrato. | Persistência local apenas; comportamento opcional conforme já implementado. |

---

## 5. Pagamentos na lista dentro do cliente

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 5.1 | Registrar pagamento em contrato com `loan.linkContext`. | Lista mostra contexto apenas derivado do contrato; dados do pagamento sem campo `payment.linkContext`. |
| 5.2 | Cenários de mudança de anotação de contrato com histórico de lançamentos. | Comportamento alinhado à decisão atual em [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md). |

---

## 6. Caixa / movimento de fundos

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 6.1 | Operação de caixa relacionada aos fluxos atuais. | Consistência esperada segundo experiência habitual do app após cenários já exercitados. |

---

## 7. Backup, importação, auto-backup

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 7.1 | Exportar backup no formato atual. | Arquivo geração sem erro. |
| 7.2 | Importar em cenário permitido pelo operador sem risco aos dados produtivos externos. | Smoke de compatibilidade de formatos legados conforme `src/utils/storage.js` e migrações existentes. |

---

## 8. Configurações, conta Firebase, vínculos

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 8.1 | Ajustar preferências já existentes nas configurações. | Persistem conforme escopo comportamental atual do app. |
| 8.2 | Fluxo auth + perfil + `accountRoles` leituras mínimas. | Interface não sugere dados financeiros na nuvem como substituto do núcleo local. |
| 8.3 | Solicitar/listar vínculos aprovados em cenário conhecido atual. | Vínculo continua apenas apoio a anotações locais sem sync financeiro. |

---

## 9. PWA / reload

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 9.1 | Reload completo durante sessão válida local. | App recarrega; estado local comporta-se segundo expectativa do dev shell/PWA atual. |

---

## 10. Integração opcional checklist fatia vínculo

Opcional rodar **explicitamente**: [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md).

---

## Critérios de saída — fase Consolidação Pós-LKG (documentação)

Esta **fase de consolidação** encerra quando **todos** abaixo forem verdadeiros:

| # | Critério |
|---|----------|
| S1 | Existem os documentos **`QA_MATRIX_GENERAL.md`** (esta matriz) e **`ADR_PAYMENT_LINK_CONTEXT.md`**. |
| S2 | A matriz geral foi **executada pelo menos uma vez** (marcadores OK/NOK/N/A) **ou** estão registrados impedimentos e plano reprogramado explicitamente na matriz/handoff/issue. |
| S3 | A matriz específica `QA_MATRIX_LINK_OPERATIONAL_VIEW.md` revisada rápida (guardrails intactos ou bloqueadores listados). |
| S4 | Não ficou decisão nova implícita sem passar pela ADR (persistência financeira remotamente nova; campo `payment.linkContext`; motor por vínculo). |

Este checklist não substitui `npx vitest run` já recorrente no desenvolvimento.

---

## Critérios de entrada — próxima trilha funcional de produto

Nova trilha de **implementação** pode começar quando:

| # | Critério |
|---|----------|
| E1 | Consolidação Pós-LKG **S1–S4 OK** segundo validador designado pelo time mantenedor. |
| E2 | `HANDOFF_MASTER.md` / `CHECKPOINT_CHECKLIST.md` refletidos se gates ou artefatos alterarem estado registrado oficialmente. |
| E3 | Uma decisão explícita define **uma** direção inicial para a próxima trilha (evitar paralelismo fragmentado não governado). |
| E4 | Nenhum regressão objetiva novo bloqueador listado previamente **sem tratamento registral** antes de codar próximo passo novo. |

### Histórico

| Data | Nota |
|------|------|
| 2026-04-29 | Criação da matriz geral mínima e critérios pós-consolidação (`Consolidação Pós-LKG`). |

---

## Resumo por execução (preencher manualmente)

| Data ciclo QA | Executor | Observações rápidas / bloqueadores |
|----------------|----------|-------------------------------------|
|  |  |  |

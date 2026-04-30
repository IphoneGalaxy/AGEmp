# Matriz QA manual — geral (mínima)

Documento regressivo manual **ponto a ponto**, complementar ao [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) e ao [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md).

Não substitui a matriz específica da fatia vínculo: [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md).

## Base de execução

- **Referência opcional**: base estável atual `lkg-2026-04-30-clientview-operational-link-block-complete` (confirmar commit com `git rev-parse lkg-2026-04-30-clientview-operational-link-block-complete^{commit}` / histórico de releases).
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

## Gate final — encerramento do ciclo local-first atual

Esta matriz é o **gate operacional principal** para decidir o encerramento prático do ciclo local-first atual.

Resultado esperado para fechamento:

| # | Critério |
|---|----------|
| F1 | Guardrails G1–G4 permanecem OK. |
| F2 | Cenários manuais críticos (§§ 1–9) foram executados por operador humano **ou** impedimentos foram registrados com decisão explícita de aceite/reprogramação. |
| F3 | A matriz específica [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md) não registra bloqueador novo na trilha de vínculo. |
| F4 | Qualquer NOK crítico vira correção pontual antes de fechamento; não abre nova feature. |
| F5 | Sem NOK crítico, o ciclo local-first pode ser considerado **praticamente encerrado** nesta etapa. |

Decisão estratégica vigente: **não abrir nova trilha funcional local-first** sem evidência objetiva de bloqueador real de uso diário.

---

## Resultado da execução — gate final (ciclo 2026-04-30 — QA assistido + objetiva)

**Escopo deste registro:** revisão do gate F1–F5 conforme definido acima; evidência automatizada desta sessão (`npx vitest run`: **247** testes OK · `npm run build`: OK); conferência estática complementar (grep `payment.linkContext` em `src/` → apenas comentários em utilitários de vínculo, sem campo persistido identificado nesta busca). **Nenhuma** sessão interativa completa no navegador/PWA/Firebase foi realizada neste ciclo para §§ 1–9.

### Avaliação do gate

| # | Resultado | Observação |
|---|-----------|------------|
| **F1** | **OK (evidência parcial/indireta)** | Guardrails G1–G4 sustentados por automação + leitura estática anterior/cycle assistido; não substituem validação de regressão de produto em UI. |
| **F2** | **Não satisfeito** | Critério exige execução humana de §§ 1–9 **ou** impedimento com **aceite ou replanejamento explícito** registrado. Neste ciclo §§ 1–9 continuam **pendentes de operador humano**; não há aceite formal de impedimento como substituto completo do §§ 1–9 (somente “IMPEDIDO” histórico ≠ critério F2 cumprido). |
| **F3** | **OK (revisão documental)** | [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md) não registra bloqueador novo; complemento da trilha de vínculo permanece válido para smoke manual opcional. |
| **F4** | **Neutro / aplicável após F2** | Nenhum **NOK crítico de produto** foi demonstrado só com esta evidência; correção pontual só se abre **depois** de NOK real na execução manual, conforme estratégia vigente. |
| **F5** | **Não declarável neste ciclo** | Depende de **F2** satisfeito **e** ausência de NOK crítico comprovado na matriz; hoje **F2 não fecha**. |

### Decisão formal desta etapa

**Não é possível declarar o ciclo local-first “praticamente encerrado” apenas com este ciclo assistido.** Próximo passo obrigatório para encerramento governado: operador humano executar §§ 1–9 (e opcionalmente §10 matriz vínculo) marcando OK/NOK/N/A **ou** registrar formalmente impedimento + aceite/replanejamento explícito como permitido por **F2**.

**Bloqueadores de produto:** nenhum foi **comprovado** nesta sessão sem a maturação manual dos cenários §§ 1–9. **Pendência principal:** execução/registro manual do gate (**governança / F2**), não nova feature.

---

## Resultado da execução — gate final (operador humano — **2026-04-30**)

**Escopo deste registro:** atestação do **operador humano** após execução manual da matriz §§ **1–9** conforme roteiro do Caminho 1.

**Resultado relatado:** **OK integral** em todos os casos **1.1–9.1**, **sem NOK crítico** nem bloqueador real de uso diário declarado pelo operador.

### Avaliação do gate (pós-manual)

| # | Resultado | Observação |
|---|-----------|------------|
| **F1** | **OK** | Guardrails G1–G4 mantidos na experiência relatada; coerente com ADR/handoff (financeiro local; vínculo não substitui núcleo; sem persistência `payment.linkContext`). |
| **F2** | **Satisfeito** | Execução humana §§ 1–9 concluída com resultado **OK** integral segundo declaração do operador. |
| **F3** | **OK** | Complemento vínculo permanece sem bloqueador novo registrado. |
| **F4** | **OK** | Nenhuma correção pontual obrigatória declarada neste gate; não abre nova feature. |
| **F5** | **Atendido** | Sem NOK crítico relatado — o ciclo local-first pode ser tratado como **praticamente encerrado** nesta etapa, segundo critérios deste documento e estratégia vigente no [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md). |

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
| 2026-04-29 | Primeiro ciclo de execução registrado (QA assistida + objetiva; UI manual não exercitada neste ciclo). |
| 2026-04-30 | Adicionado gate final para encerramento prático do ciclo local-first atual; referência atualizada para LKG `lkg-2026-04-30-clientview-operational-link-block-complete`. |
| 2026-04-30 | Execução assistida do gate F1–F5: **F2 não satisfeito** (manual §§ 1–9 pendente); decisão formal — não declarar encerramento do ciclo só com esta evidência; `vitest` 247 + `npm run build` OK nesta sessão. |
| 2026-04-30 | Execução **manual humana** §§ 1–9: operador atesta **OK integral** (casos **1.1–9.1**); **F2 satisfeito**, **F5 atendido** — ciclo local-first **praticamente encerrado** segundo este gate (sem NOK crítico declarado). |

---

## Resumo por execução (preencher manualmente)

| Data ciclo QA | Executor | Observações rápidas / bloqueadores |
|----------------|----------|-------------------------------------|
| 2026-04-29 | Cursor Agent (QA assistido: regressão objetiva + revisão estática de código; **sem sessão manual no navegador/Firebase neste ciclo**) | `npx vitest run`: 241/241 OK · `npm run build`: OK · Guardrails G1–G4 conferidos por código/grep · Itens 1.x–9.x e vários de fluxo fino: **IMPEDIDO** até operador humano completar matriz no ambiente real · Matriz vínculo: revisão rápida documentada como complemento (código + testes `linkOperationalDerive`). |
| 2026-04-30 | Cursor Agent (planejamento estratégico + consolidação documental; **sem sessão manual no navegador/Firebase neste ciclo**) | Decisão registrada: próxima fase é **encerramento/consolidação local-first**, não nova feature. Gate manual final definido em F1–F5. Execução manual §§ 1–9 segue pendente de operador humano ou aceite/reprogramação explícita. |
| 2026-04-30 | Cursor Agent (QA assistido — gate final F1–F5; **sem sessão manual completa §§ 1–9 neste ciclo**) | `npx vitest run`: **247**/247 OK · `npm run build`: OK · **F2 não satisfeito** · Decisão formal: **não** declarar encerramento do ciclo local-first até humano completar §§ 1–9 (ou aceite/replanejamento explícito de impedimento conforme F2). Sem NOK crítico de produto demonstrado só por esta sessão. |
| 2026-04-30 | **Operador humano** (execução manual §§ 1–9 no app local / navegador) | Atesta **OK** em todos os testes do roteiro (**1.1–9.1**); **sem NOK crítico**. Fecha **F2** e permite declarar **F5** / ciclo local-first **praticamente encerrado** conforme gate deste documento. |

---

## Resultado da execução — ciclo 2026-04-29

**Escopo deste registro:** apenas evidência objetiva (Vitest, build, leitura de `src/`/`docs`) e classificação dos casos da matriz; **nenhuma** sessão interativa de app (dashboard, login, PWA, backup manual, caixa) foi realizada pelo executor deste ciclo.

**Itens tratados como OK (evidência indireta):** guardrails G1–G4 (sem persistência financeira remota autoritativa; ausência de `payment.linkContext` em modelo/caminhos verificados; `calculations.js` não alterado neste ciclo de QA; vínculo como metadado local — alinhado a `HANDOFF_MASTER` + ADR).

**Itens IMPEDIDO:** cenários que exigem operador humano no browser/PWA e/ou contas Firebase reais (§§ 1.1–1.4, 2.x, 3.x–9.x na íntegra manual).

**Próximo passo recomendado:** operador designado repetir este documento marcando linha a linha após smoke manual, mantendo o mesmo commit/tag de referência quando possível.

### Classificação por caso (ciclo 2026-04-29 — executor assistido)

| Caso | Resultado | Observação |
|------|-----------|------------|
| G1 | OK | Domínio financeiro em `localStorage` por escopo; Firestore limitado a perfil/vínculos (`src/firebase/`). |
| G2 | OK | Comentários/utils confirmam ausência de persistência `payment.linkContext`; `normalizeLoan` não acrescenta campo em pagamentos. |
| G3 | OK | `calculations.js` não objeto de alteração neste ciclo; testes do motor passando. |
| G4 | OK | Escopo `anonymous` / `account:{uid}` mantido em `storageScope`; sem regra financeira obrigatória por vínculo no motor. |
| 1.1–1.4 | IMPEDIDO | Requer sessão interativa (reload, escopos A/B, legado Firebase). |
| 2.1–2.2 | IMPEDIDO | Requer UI manual / viewport mobile. |
| 3.1–3.4 | IMPEDIDO | Requer `ClientsList` ao vivo + opcionalmente vínculos aprovados. |
| 4.1–4.3 | IMPEDIDO | Requer `ClientView` ao vivo. |
| 5.1–5.2 | IMPEDIDO | Requer fluxo pagamento + contrato com `loan.linkContext` (conf. ADR revisável só manualmente). |
| 6.1 | IMPEDIDO | Requer fluxo de caixa na UI. |
| 7.1–7.2 | IMPEDIDO | Requer export/import manual smoke (testes automatizados cobrem parte em `storage`/`autoBackup`). |
| 8.1–8.3 | IMPEDIDO | Requer configurações + auth Firebase real. |
| 9.1 | IMPEDIDO | Requer reload PWA/dev shell ao vivo. |
| §10 matriz vínculo | OK (revisão rápida) | `linkOperationalDerive.js` + testes + uso em `ClientsList.jsx` conferidos; smoke manual opcional não executado. |

Reexecutar com operador humano para converter IMPEDIDO → OK/NOK linha a linha quando aplicável.

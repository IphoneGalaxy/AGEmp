# Matriz QA — `loanRequest` v1.1 (pré-financeira)

**Status da matriz:** **FECHAMENTO FORMAL RB + CN** — **Pacote nominal v1.1 completo** considerado **concluído e validado** após smoke manual real da **Fatia CN** (contraproposta). A **Fatia RB** mantém seu marco próprio (**`lkg-2026-05-03-loanrequest-v1-1-rb`**). Promoção integral: tag LKG **`lkg-2026-05-03-loanrequest-v1-1`**.

**Pacote anterior fechado:** [`QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md) (v1 + LKG `lkg-2026-05-01-loanrequest-v1-complete`)  
**Especificação v1.1 (histórico):** [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./plans/completed/LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md) · [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md)  
**Firestore / rules:** [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md)

Registrar data, ambiente (`build`/commit/tag), operador e **OK / NOK / N/A** por linha. **NOK crítico bloqueia** promoção futura equivalente nesta espécie de matriz.

---

## Execução registrada — Fatia RB (`readBy*`)

| Campo | Registro |
|-------|----------|
| **Implementação** | Commit **`7270409`** (`readByClientAt`, `readBySupplierAt`; política B em `updatedAt` conforme código/regras) |
| **Rules publicadas** | Comando utilizado pela equipe: `npx -y firebase-tools@latest deploy --only firestore:rules --project agemp-financas-pro` — sucesso (compilação + release) |
| **Smoke manual** | Executado pela operadora humana; **OK**, **sem NOK crítico** informado neste ciclo RB |
| **Promoção** | Tag LKG **`lkg-2026-05-03-loanrequest-v1-1-rb`** (marcador somente RB) |

---

## Execução registrada — Fatia CN (contraproposta — rodada única)

| Campo | Registro |
|-------|----------|
| **Commits relevantes** | **`60f95df`** — implementação inicial CN · **`ff78c52`** — vínculo revogado permite nova solicitação · **`72328c6`** — pré-check duplicidade com **`clientId`** na query (`findOpenLoanRequestForLinkId`) · **`f97e1eb`** — timestamp único em `createLoanRequest` (+ regras / emulador) · **`785f89b`** — timestamps únicos em contraproposta / aceite / recusa da contraproposta pelo cliente · **`4e8dcae`** — alinhamento final do payload de contraproposta às Security Rules (**`loanRequestHasCommittedCounteroffer`**, ordenação econômica nas rules, suite de testes no emulador) |
| **Rules / testes** | `npm run test:rules:loanRequests` (Vitest + emulador Firestore): create + contraproposta (**`assertSucceeds`** / **`assertFails`** valor igual ao pedido / doc com `counterofferAmount: null` legado) |
| **Smoke manual real (operador humano)** | **OK integral** na sequência abaixo, **sem NOK crítico** informado |
| **Promoção pacote v1.1** | Tag LKG anotada **`lkg-2026-05-03-loanrequest-v1-1`** (RB + CN validados em conjunto no fechamento documental) |

### Smoke manual — checklist registrado (Fatia CN + guardrails)

1. Cliente cria pedido (pré-financeiro).  
2. Fornecedor recebe pedido na lista.  
3. Fornecedor envia **contraproposta** com valor **diferente** do solicitado.  
4. Cliente **visualiza** a contraproposta.  
5. Cliente **aceita** contraproposta → pedido **`approved`** com **`approvedAmount`** igual ao valor contraposto.  
6. Outro pedido com contraproposta: cliente **recusa** → terminal **`counteroffer_declined`**.  
7. **Não** cria contrato financeiro local/remoto automático.  
8. **Não** altera caixa / dashboard / motor local.  
9. **Não** sincroniza dados financeiros locais.  
10. Fluxo permanece **pré-financeiro / plataforma** conforme UX e copys existentes.

---

## Como usar esta matriz (duas promoções opcionais — histórico)

A governança v1.1 promoveu primeiro **somente RB** (`lkg-2026-05-03-loanrequest-v1-1-rb`) e encerrou **RB+CN** com **`lkg-2026-05-03-loanrequest-v1-1`**.

| ID da fatia | Conteúdo |
|-------------|----------|
| **RB** | `readByClientAt` · `readBySupplierAt` |
| **CN** | `counteroffer` + terminal `counteroffer_declined` + decisão do cliente |

---

## Guardrails globais (obrigatórios — herança v1 estendida)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| G1 | Fluxos RB/CN conforme aplicável | Não altera dados financeiros locais (dashboard/clientes/contratos/pagamentos/caixa) | OK (smoke/fechamento) |
| G2 | Idem | Não grava coleções autoritativas financeiras remotas | OK |
| G3 | Idem | `calculations.js` permanece efetivamente intocado pela fatia RB/CN | OK |
| G4 | Idem | `payment.linkContext` continua inexistente após cenários RB/CN | OK |
| G5 | Usuário sem conta | App financeiro local disponível como hoje sem dependência obrigatória de pedidos remotos | N/A típico / herdado |
| G6 | Backup/export/import | Pedidos continuam **fora** do domínio financeiro serializado localmente | OK |

*(Demais linhas RB\*/CN\* desta matriz permanecem como catálogo de regressão quando houver necessidade futura de reexecutar fino; no fechamento v1.1 o critério de promoção foi o smoke estrutural acima + testes/rules automatizados listados.)*

---

## Melhorias pós-pacote v1.1 (UX / robustez / estado local)

**Escopo:** ajustes **depois** do fechamento formal **`lkg-2026-05-03-loanrequest-v1-1`** — **não** constituem nova fase principal nem alteram especificação de modelo, rules, schema, status/transições ou guardrails pré-financeiros.

**Explicitamente sem alteração nesta linha:** `firestore.rules`; `calculations.js`; schema Firestore; transições de negócio; sync financeiro remoto; conversão automática pedido → contrato; `payment.linkContext`.

| Commit | Tema |
|--------|------|
| **`584d5b4`** | Badge **“Novo”** só para novidade legítima entre cliente e fornecedor (último evento relevante da contraparte vs última leitura; UI discreta light/dark). |
| **`62bacf2`** | `markLoanRequestReadByClient` / `markLoanRequestReadBySupplier`: **`console.warn`** em falha (rede/permissão/vínculo); sem toast nem retry infinito. |
| **`cd8db7e`** | Painel fornecedor: limpeza de **drafts** locais (observação / valor de contraproposta) ao **recolher** o pedido e após **ação concluída com sucesso** — evita vazamento de texto/valor antigo ao reabrir. |
| **`dcc9f80`** | **Bloco 1 / A1a:** utilitário **`countUnreadLoanRequests`** (`loanRequestUnreadCount.js`) + testes — mesma filosofia de novidade dos painéis; **sem** rules/schema/`calculations.js`. |
| **`4951bdf`** | **Bloco 1 / A1b:** badges numéricos discretos em **`AccountScreen`** nos botões **“Abrir solicitações”** / **“Abrir pedidos recebidos”** (somente quando `count > 0` e papel aplicável); carga sob demanda na vista principal; **sem** `App.jsx`/`Settings.jsx`/listener global na entrega A1. |
| **`07ef7e5`** | **Bloco 1 / B2:** alerta **informativo** e **não bloqueante** no **`LoanRequestsSupplierPanel`** — repasse **`availableMoney`** (`App` → `Settings` → `AccountScreen` → painel); comparação **`requestedAmount / 100 > availableMoney`**; só **`pending`** / **`under_review`**; **sem** alterar **`calculations.js`**, **`firestore.rules`**, schema, transições, escrita Firestore pelo alerta, **`payment.linkContext`**, sync remoto ou contrato automático. |

### Smoke manual opcional (regressão leve)

1. **Badge “Novo”:** contraparte age depois da sua última leitura → indicador adequado; legado/terminais tratados conforme código (sem prometer comportamento jurídico além da UI).
2. **Marcação de leitura com falha simulada:** console com **`warn`** perceptível ao dev; sem novo sistema de notificação ao usuário final.
3. **Drafts:** recolher pedido ou completar fluxo no fornecedor sem drafts antigos reaparecerem para o mesmo pedido.
4. **Badges na Conta (A1 — Bloco 1):** com novidade legítima para o papel, número aparece só no botão correspondente (cliente vs fornecedor); após marcar lido no painel e voltar à **Conta**, contagem some ou atualiza **sem** tempo real obrigatório; usuário sem papel não vê badge daquele papel; **sem** badge na tab principal nem em “Gerenciar conta” nesta fatia.
5. **Alerta disponível local (B2 — Bloco 1):** em pedido **aberto** do fornecedor (`pending` / `under_review`), se disponível local **menor** que valor pedido → aviso visível; com disponível **≥** pedido → **sem** aviso; **aprovar** com aviso permanece permitido; terminais e `counteroffer` **sem** aviso (smoke registrado pela equipe); mobile/dark legível.

### Fase A1 — Bloco 1 (sinalização na Conta) — concluída (2026-05-04)

| Campo | Registro |
|-------|----------|
| **Escopo** | Indicador agregado derivado de `readBy*` e dados existentes; **somente** `AccountScreen` |
| **Commits** | **`dcc9f80`** (A1a) · **`4951bdf`** (A1b) |
| **Fora do escopo (confirmado)** | Mudança de **`firestore.rules`**; alteração de **`calculations.js`**; novo schema Firestore; `payment.linkContext`; sync financeiro remoto; contrato automático |
| **Próxima subfase do plano** | **Bloco 1 funcionalmente fechado** — **A2b/A2c** backlog · **Bloco 2 FECHADO** (`624c725`, `3badcbc`, `5dd4c36`; § Bloco 2) · **Mini ADR snapshots FECHADA** (`6793461` … `28f3f4a`; § abaixo) · **«Visão Fornecedores + Governança local» FECHADA** (`0be3e0b`, `c921d8d`, `a6c2d8c`; § «Visão Fornecedores» abaixo) |

### Subfase B2 — Bloco 1 (alerta fornecedor — concluída)

| Campo | Registro |
|-------|----------|
| **Commit** | **`07ef7e5`** — `feat(loan-requests): adicionar alerta de disponível local no fornecedor` |
| **Arquivos** | `src/App.jsx`, `src/components/Settings.jsx`, `src/components/AccountScreen.jsx`, `src/components/LoanRequestsSupplierPanel.jsx` |
| **Lógica** | **`availableMoney`** desde **`calculateGlobalStats`** / `globalStats`; **`requestedAmount / 100 > availableMoney`**; só **`pending`** e **`under_review`**; números finitos; aprovação **não** bloqueada. |
| **Fora do escopo (confirmado)** | Alteração **`calculations.js`**; **`firestore.rules`**; schema; gravação **`loanRequest`** pelo alerta; transições; **`payment.linkContext`**; sync financeiro remoto; contrato automático. |
| **Smoke manual** | Equipa: aviso quando disponível **&lt;** pedido; sem aviso quando **≥**; aprovar com aviso; terminais e `counteroffer` sem aviso; mobile/dark. |

---

### Subfase B1 — Bloco 1 (métrica para alerta B2 — análise concluída)

| Campo | Registro |
|-------|----------|
| **Natureza** | **Só análise/decisão** — **sem** alteração de `calculations.js`, rules, UI ou testes. |
| **Métrica** | **`availableMoney`** retornado por **`calculateGlobalStats(clients, fundsTransactions, timeInfo)`** — mesmo conceito do Painel (**“Total Disponível”**). |
| **B2 (entregue `07ef7e5`)** | Comparar **`requestedAmount / 100`** (reais) com **`availableMoney`**; alerta **informativo**, **não bloqueante**; **referência local**; **sem** validação bancária; **sem** escrita Firestore por causa do alerta; **sem** sync/conversão automática/`payment.linkContext`. |
| **Smoke manual (B2)** | Registrado pela equipe após **`07ef7e5`** — disponível local &lt; valor pedido → aviso; **≥** → sem aviso; **aprovação** permitida com aviso; terminais e `counteroffer` sem aviso; mobile/dark. |

---

### Subfase A2a — Bloco 1 (decisões de arquivamento — documental, sem código)

| Campo | Registro |
|-------|----------|
| **Natureza** | **Só decisão** — **não** há campos Firestore, rules, helpers, UI nem testes alterados por esta subfase. |
| **Contrato canônico** | [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) §6 (A2a) — arquivamento **por lado**; terminais apenas (`approved`, `rejected`, `cancelled_by_client`, `counteroffer_declined`); **não** arquivar abertos (`pending`, `under_review`, `counteroffer`); **desarquivar** permitido (só o lado do usuário; **não** reabre negócio); **`updatedAt` intocado** no arquivo/desarquivo; **`delete`** fora do produto; `archivedByClient` / `archivedBySupplier` **planejados** para futura **A2b** (**backlog** após fechamento funcional Bloco 1). |
| **Futuro QA / smoke (A2b+A2c)** | Rules: papel só grava o próprio campo; cruzamento **falha**; testes **`test:rules:loanRequests`** obrigatórios em A2b; UI A2c: lista oculta arquivados + “Mostrar arquivados”; copys **arquivar** ≠ **excluir**; regressão leve em badges A1 após mudar listagens. |
| **Estado** | **A2b / A2c** **não** concluídas (**backlog**) · **B1** concluída (análise) · **B2** concluída (**`07ef7e5`**) · **Bloco 1 funcionalmente fechado** sem A2b/A2c. |

---

## Bloco 2 — Conversão governada (`approved` → contrato local) — **FECHADO**

### Registo de execução (Bloco2-E)

| Campo | Registo |
|-------|---------|
| **ADR / guardrails** | [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) — MVP **sem** marcação remota converted; **sem** escrita Firestore **pela conversão**; **sem** `payment.linkContext`; **sem** sync financeiro remoto; **sem** alteração **`calculations.js`** pelo Bloco 2. *(Campos remotos de snapshot de nome foram acrescentados **depois** pela mini ADR [`ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md`](./ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md) — metadado relacional; não autoritativo financeiro.)* |
| **Commits** | **`624c725`** — entrada + revisão/modal · **`3badcbc`** — persistência local + `convertedFromLoanRequestId` + anti-duplicidade · **`5dd4c36`** — UX pós-conversão · **`28f3f4a`** — nome amigável na revisão/conversão a partir de **`clientDisplayNameSnapshot`** |
| **Smoke manual (operador)** | **OK integral**, **sem NOK crítico** — botão em `approved`; modal + checkbox; contrato e cliente na lista/`ClientView`; totais pelo motor local; segunda conversão bloqueada; rótulos amigáveis (**Bloco2-D**); filtros vínculo preservados; **o app não transfere dinheiro** |

### Checklist smoke Bloco 2 (referência rápida)

1. Pedido `approved` sem conversão → «Registrar contrato local».  
2. Abrir revisão → campos legíveis; **sem** ID do pedido na superfície principal (**Bloco2-D**).  
3. Sem checkbox → não registra; com checkbox → contrato criado.  
4. Painel / Clientes / contrato reflectem valores esperados (**motor local**).  
5. Reabrir mesmo pedido → «Contrato já registado localmente» (**Bloco2-D**); não permite segundo registo.  
6. Filtros e anotação **`linkContext`** continuam coerentes.  
7. Criação manual de contrato (fluxo existente) **sem** regressão.  
8. Pedido **sem** `clientDisplayNameSnapshot` → conversão continua com fallback **«Cliente da plataforma»** no modal e no cliente novo.

---

## Mini ADR — Identidade pública e snapshots de nomes — **FECHADA** (Subfase 7 — QA/docs)

### Registo de execução

| Campo | Registo |
|-------|---------|
| **ADR** | [`ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md`](./ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md) §13–§17 |
| **Commits (ordem)** | **`6793461`** (Subfase 0 docs) · **`eb48083`** (helpers) · **`cdc55d9`** (rules + tests) · **`9d2c4ad`** (links) · **`9f4351f`** (`loanRequests` create) · **`bb03633`** (UI vínculos/pedidos) · **`28f3f4a`** (conversão local + modal) |
| **Deploy rules (real)** | Após **`cdc55d9`:** `npx -y firebase-tools@latest deploy --only firestore:rules --project agemp-financas-pro` — sucesso registado pela equipa |
| **Guardrails (confirmados)** | **Sem** sync financeiro remoto; **sem** contrato remoto autoritativo; **sem** `payment.linkContext`; **sem** alteração **`calculations.js`** nesta linha. Firebase = **identidade / vínculo / pedido pré-financeiro** apenas. **Bloco 2** permanece só gravação **local** após confirmação humana; **sem** escrita remota pela conversão. |
| **Onde os nomes aparecem** | **Vínculos** (Conta); **pedidos enviados** (cliente); **pedidos recebidos** (fornecedor); modal **«Registrar contrato local»**; **cliente local** criado pela conversão (cliente existente reutilizado **sem** renomeação automática). |

### Smoke manual validado (operador)

1. Cliente **Mello** cria pedido (com snapshots).  
2. Fornecedor **Guilherme** vê **Mello** onde aplicável.  
3. Cliente vê **Guilherme** onde aplicável.  
4. Fornecedor **aprova**.  
5. Modal **«Registrar contrato local»** mostra **Mello** quando `clientDisplayNameSnapshot` existe.  
6. Após confirmar transferência e registar → cliente local criado como **Mello**; **ClientView** mostra **Mello**.  
7. **Segunda** tentativa de conversão do mesmo pedido → **bloqueada** (anti-duplicidade).  
8. Deploy das **rules** no projeto real corrigiu erro **permission denied** observado quando ambiente não estava alinhado às novas chaves.

### Limitações / backlog (pós-mini ADR snapshots)

- **Vínculos legados** sem **`supplierDisplayNameSnapshot`** podem continuar a mostrar **«Fornecedor da plataforma»** no cartão de vínculo — refinamento futuro: fallback por **perfil remoto** ou **atualização controlada** de snapshot em links legados (**sem** migração obrigatória nesta mini fase).
- **«Visão Fornecedores + Governança local»:** **fechada** — ver § seguinte (**commits `0be3e0b`, `c921d8d`, `a6c2d8c`**).
- IDs técnicos: só dados internos na linha pré-financeira; UI principal favorece nomes amigáveis quando snapshot existe; modo avançado Configurações — backlog.
- **A2b/A2c** arquivamento **remoto** (`loanRequests`) — backlog (**distinto** do arquivamento **local** do cliente na fase Visão Fornecedores).
- Marcação remota `converted_to_contract` — só com ADR + rules + QA.

### Encaminhamento

Backlog consolidado após a fase **«Visão Fornecedores + Governança local»:** [`ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md`](./ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md) §16.6 · [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) · [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md).

---

## «Visão Fornecedores + Governança local» — Pacotes **1–3** **FECHADOS**

### Registo de execução (Pacote 3 — QA/docs)

| Campo | Registo |
|-------|---------|
| **ADR / guardrails** | [`ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md`](./ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md) §16 — **sem** sync financeiro remoto; **sem** contrato remoto; **sem** `payment.linkContext`; **sem** **`calculations.js`** nesta fase; **`firestore.rules`** intocado; **sem** revogação remota de vínculo |
| **Commits** | **`0be3e0b`** — ADR/plano inicial · **`c921d8d`** — conta-cliente (Fornecedores, agrupamento, CTA **Solicitar novo valor**, fallback nome + UID opcional) · **`a6c2d8c`** — registry local, reconversão, `archivedAt`, lista/restaurar arquivados, exclusão local forte |
| **Firestore / rules** | **Nenhuma** alteração a modelo `loanRequests` nem deploy de rules nesta fase — [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) |
| **Smoke manual sugerido/necessário** | §16.4 da ADR — cliente abre **Fornecedores**; pedidos agrupados; **Solicitar novo valor**; arquivar/restaurar; exclusão com confirmação forte; apagar contrato/cliente local **não** «reset» total da história de conversão; reconversão com confirmação extra |

### Backlog explícito (pós-fase)

- Revogação / desfazer vínculo **remoto**.
- **A2b/A2c** (continuam backlog).
- Backup/export do registry local se necessário.
- Melhoria visual / extração de componentes se necessário.
- **Financeiro Local do Cliente («Minhas dívidas»):** quando implementado, registrar regressão explícita — **`loanRequests`** e vínculos **não** criam/atualizam passivo local automaticamente; cenários conforme [`ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md`](./ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md) (critérios de aceite / QA futura).

---

## Histórico

| Data | Nota |
|------|------|
| 2026-05-03 | Criação da matriz planejável v1.1 alinhada à ordem de entrega oficial documentada (`readBy*` → `counteroffer`). |
| 2026-05-03 | **Fatia RB** — registro de promoção manual: código `7270409`, deploy de rules em **`agemp-financas-pro`**, smoke OK sem NOK crítico informado — LKG **`lkg-2026-05-03-loanrequest-v1-1-rb`**. |
| 2026-05-03 | **Fatia CN** implementada/corrigida até validação **real no app**; commits listados na seção CN; último patch de regras **`4e8dcae`**; smoke manual integral OK; pacote nominal **v1.1 RB+CN** declarado **fechado** com LKG **`lkg-2026-05-03-loanrequest-v1-1`**. |
| 2026-05-03 | **Fechamento documental** (`45a8f03`): logs DEV de diagnóstico removidos, `.gitignore` para artefatos de emulador, matriz/checkpoint/handoff/Firestore/NEXT atualizados após LKG. |
| 2026-05-03 | **Melhorias pós-v1.1 (UX/local):** **`584d5b4`** badge “Novo” legítimo; **`62bacf2`** `console.warn` em falha ao marcar leitura; **`cd8db7e`** limpeza de drafts no painel fornecedor — ver § “Melhorias pós-pacote v1.1”. |
| 2026-05-04 | **Bloco 1 — Fase A1 concluída:** commits **`dcc9f80`** (utilitário + testes) · **`4951bdf`** (badges na Conta); § “Fase A1 — Bloco 1” e tabela de melhorias estendida. |
| 2026-05-04 | **Subfase A2a (arquivamento) documentada** — § dedicada; **sem** código. |
| 2026-05-04 | **Subfase B1 (métrica disponível) documentada** — **B2** pode seguir; **B2** **não** implementada. |
| 2026-05-04 | **Subfase B2 concluída:** **`07ef7e5`** — § dedicada e smoke. |
| 2026-05-04 | **Governança Opção A:** **Bloco 1 funcionalmente fechado**; plano arquivado; **Bloco 2** recomendado em seguida. |
| 2026-05-04 | **Bloco2-0:** ADR/plano [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) criado e **aprovado**. |
| 2026-05-04 | **Bloco 2 implementado + Bloco2-E:** **`624c725`**, **`3badcbc`**, **`5dd4c36`**; smoke OK; § Bloco 2 nesta matriz; guardrails MVP preservados. |
| 2026-05-05 | **Mini ADR snapshots — Subfase 7 (QA/docs):** mini fase **fechada**; commits **`6793461`** … **`28f3f4a`**; deploy rules **`agemp-financas-pro`** após **`cdc55d9`**; smoke § **Mini ADR**. |
| 2026-05-05 | **«Visão Fornecedores + Governança local» — Pacotes 1–3:** fecho documental § dedicado nesta matriz; commits **`0be3e0b`**, **`c921d8d`**, **`a6c2d8c`**; sem mudança Firestore/rules — [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md). |
| 2026-05-05 | Mini ADR [`ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md`](./ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md) — **Subfase 0** só docs; implementação §13 posterior. |

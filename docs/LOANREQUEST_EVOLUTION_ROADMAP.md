# Roadmap vivo — evolução de `loanRequest` (A1–F)

## Status deste documento

- **Natureza:** planejamento **vivo** para encaixar evoluções futuras da área **pré-financeira** (`loanRequests`) sem tratar **`docs/plans/completed/`** como plano ativo (permanece **referência histórica** apenas; ver [`plans/README.md`](./plans/README.md)).
- **Não substitui** [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md), [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md) nem [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) — **complementa** com fases ordenadas **A1 → F**.
- **Modelo atual (factual):** [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md); fechamento v1.1 — [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md).

Este arquivo **descreve** o que poderá ser construído; **nenhuma linha aqui obriga código** já existente até decisão explícita de governança e critérios de entrada para implementação.

- **Bloco 1 — funcionalmente fechado (Opção A, 2026-05-04):** entregues **A1a, A1b, A2a, B1, B2**; plano **arquivado** (histórico): [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) — **não** é plano ativo. **A2b/A2c** **não** implementadas — **backlog**; **não** impediram o fechamento funcional. **Próxima fase recomendada:** **Bloco 2** (§ abaixo) — ADR/plano vivo [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) (**aprovado pela governança**); **Bloco2-A** **autorizada**, **código não iniciado**; **Bloco2-B–E** — **não** concluídos.

---

## Guardrails obrigatórios (todas as fases)

Mesma linha de [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md), Project Rule e handoff:

| Regra | Detalhe |
|-------|---------|
| **Financeiro local-first** | Clientes, contratos, pagamentos, caixa, dashboard e backups **não** viram coleção autoritativa remota sem fase própria. |
| **`loanRequests` só pré-financeiros** | Pedidos na plataforma **não** são extrato nem promessa de transferência bancária real. |
| **Sem sync financeiro remoto** nesta linha evolutiva, salvo projeto explícito. |
| **`calculations.js`** | Alterações **somente** com decisão explícita; não usar pedido remoto como gatilho silencioso do motor. |
| **`payment.linkContext`** | Não criar nem persistir; ADR atual em [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md). |
| **Sem contrato automático** por evento remoto isolado | Qualquer elo pedido → contrato local é **fase própria (F)** com confirmação humana explícita. |
| **Confirmação humana antes de efeito financeiro** | Caixa/dashboard/contratos locais **não** mudam por solicitação remota sem fase/decisão explícita + fluxo de confirmação. |
| **Sem promessa de transferência real** | Microcopy e estados devem separar pedido na plataforma, intenção, data combinada e registro financeiro local. |

### Planejamento vs implementação (**Fase A2**)

Campos **`archivedByClient`** / **`archivedBySupplier`**, quando forem objeto de trabalho técnico, pertencem ao **planejamento e implementação futuros da Fase A2** neste roadmap — **não existem neste momento** como modelo obrigatório no Firestore até design + rules + QA próprios; este documento **não** os declara já criados.

**Subfase A2a (Bloco 1 — decisão, sem código):** **concluída documentalmente** — contrato conceitual em [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) §6 A2a: arquivamento **por lado**, terminais apenas, desarquivar permitido, **`updatedAt` intocado** no arquivo/desarquivo, exclusão/fora de escopo, rules/UI detalhadas **só** nas futuras **A2b/A2c** (**backlog**).

---

## Visão resumida das fases

| Fase | Tema | Toca Firestore/rules? | Toca financeiro local? | ADR / governança |
|------|------|----------------------|-------------------------|-------------------|
| **A1** | Sinalização global de novidades (derivada de dados existentes e `readBy*`) | **Não** (entrega: leitura só via queries/listagens existentes) | **Não** | Não obrigatório |
| **A2** | Arquivamento **por lado** (cliente / fornecedor) | **Sim** (novos campos + rules) | **Não** | QA + atualização **`FIRESTORE_LOANREQUESTS.md`** antes/depois de codar |
| **B** | Alerta de saldo insuficiente **não bloqueante** (fornecedor) | **Não** | **Somente leitura** para comparação; sem gravar pelo pedido remoto | Decisão: métrica de “disponível” |
| **C** | Bloqueio ou restrição por saldo | Depende da política | Leitura e possivelmente **UX de bloqueio** | Decisão **explícita** após avaliar **B** |
| **D** | Sugestão de contraproposta com base em **recebíveis futuros** (local) | **Não** no escopo típico (contraposta já existe) | **Somente leitura** dos contratos locais para sugestão; sem automação financeira real | Planejamento de utilitários e testes sem tocar motor |
| **E** | Pendência futura de liberação + lembretes / cancelamentos | **Sim** quase sempre (campos ou estados novos) | **Não** automático | **ADR obrigatória** antes de implementar |
| **F** | Conversão governada pedido → **contrato local** | Opcional/discutível | **Sim** na fase própria | **ADR completa** + fluxo de revisão + critérios de entrada |
| **Bloco 2** | **Mesmo tema que F**, nome de execução futura: *Conversão Governada de LoanRequest aprovado em Contrato Local* — ver § **Bloco 2** abaixo | **A definir** na fase | **Sim** (contrato/caixa locais após confirmação humana) | [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) (**aprovado**); **Bloco2-A** **autorizada**, código **não** iniciado |

**Bloco 1** encerrado funcionalmente — ver plano arquivado. Ordem sugerida para o que segue: **Bloco 2** (conversão governada — [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) **aprovado**; próximo código **Bloco2-A** quando priorizado); **A2b/A2c** quando a equipa priorizar arquivamento na UI/rules; **C** após avaliação da Fase **B** em uso; **D** / **E** conforme decisão e ADR.

---

## Fase A1 — Sinalização global de novidades

### Objetivo

O usuário percebe **antes de abrir** o painel de pedidos que há novidade relevante (ex.: novo movimento da contraparte alinhável ao critério do badge por pedido já existente na UI).

### Escopo típico (planejamento)

- Indicador **discreto** (nímero pequeno, pingo ou texto curto), **mobile-first**, alinhado a [`DESIGN.md`](../DESIGN.md), [`BRAND.md`](../BRAND.md), [`PROJECT_OVERRIDES.md`](../PROJECT_OVERRIDES.md) — sem poluição de badges múltiplos.
- Lógica **derivada**: mesma ideia já usada nos painéis (eventos da contraparte vs `readByClientAt` / `readBySupplierAt`), **sem** novos campos Firestore nem alteração de `firestore.rules` no desenho mínimo.
- Superfície na entrega Bloco 1: **Configurações → Conta** (`AccountScreen`), botões que abrem os painéis já existentes.

### Fora do escopo (A1)

- Push/FCM, e-mail ou filas remotas de notificação.
- Persistir novo marcador só para o indicador global (evitar drift do modelo pré-financeiro).
- Mudar estado de negócio dos pedidos.

### Implementação registrada (Bloco 1 — 2026-05-04)

- **A1 concluída** em duas subfases: **`dcc9f80`** — `src/utils/loanRequestUnreadCount.js` (`countUnreadLoanRequests`) + testes unitários · **`4951bdf`** — badges numéricos discretos apenas em **`AccountScreen.jsx`** (Configurações → Conta), nos botões **“Abrir solicitações”** (papel cliente) e **“Abrir pedidos recebidos”** (papel fornecedor); alinhado à mesma filosofia do badge **“Novo”** por item nos painéis.
- **Guardrails preservados:** **sem** novos campos Firestore nem mudança de **`firestore.rules`** nesta fase; **sem** `payment.linkContext`; **sem** sync financeiro remoto; **sem** contrato automático; **`calculations.js`** intocado; **sem** listener global/tempo real dedicado (carga ao exibir a vista principal da conta).
- **Não alterados:** `App.jsx`, `Settings.jsx` (nesta entrega documentada).

### Decisões pendentes (evolução após A1)

- O indicador na **primeira fatia** conta **um** número agregado por botão (cliente vs fornecedor), derivado da mesma regra de novidade dos painéis · possíveis evoluções (tab principal, “Gerenciar conta”) **não** fazem parte de A1.
- Sessão não autenticada: **sem** badge (sem `uid` / fluxo de conta).

### Critérios de aceite (implementação)

- O usuário vê novo destaque apenas quando houver pelo menos um pedido com “novidade legítima” conforme mesma filosofia já documentada em [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md) (Melhorias pós-v1.1).
- **Nenhuma** mensagem sugere financeiro sincronizado na nuvem ou transferência real.

**Atendidos na Fase A1 (Bloco 1, 2026-05-04):** commits **`dcc9f80`** · **`4951bdf`**.

---

## Fase A2 — Arquivamento por utilizador / por lado

### Objetivo

Reduzir ruído na lista mantendo **histórico** e **auditabilidade**: cada lado pode **escolher ocultar** pedidos já encerrados (ou critérios a fechar na governança), sem apagar documento (`delete` continua veto normativo atual nas rules).

### Escopo típico (planejamento futuro — não implementado neste registro)

- Novos campos por lado (**planejados para implementação futura A2b**): **`archivedByClient`**, **`archivedBySupplier`** — tipo **timestamp** ou campo anulável/removível conforme **design** + rules na **A2b**; **A2a** documentou apenas a **intenção**.
- **Security Rules** (futura **A2b**): cada papel altera **apenas** o próprio marcador; escrita cruzada **falha**; arquivo/desarquivo **somente** em status **terminal**; **`delete`** continua vedado. **`updatedAt`:** **não** muda no arquivamento/desarquivamento (decisão **A2a** — metadado operacional por lado, alinhado à ideia dos `readBy*`).
- **UI** (futura **A2c**, **depois** de **A2b**): **Arquivar** / **Desarquivar** / **Mostrar arquivados** nos painéis [`LoanRequestsClientPanel.jsx`](../src/components/LoanRequestsClientPanel.jsx) e [`LoanRequestsSupplierPanel.jsx`](../src/components/LoanRequestsSupplierPanel.jsx); lista padrão oculta arquivados do lado; microcopy distingue **arquivar** vs **excluir**.
- **Excluir** documento remotamente não é objetivo (“excluir” permanece menos seguro enquanto `delete` estiver vedado pelas rules).

### Decisões A2a fechadas (documentação Bloco 1 — sem código)

Arquivamento **não global**; um lado **não** esconde pedido do outro. **Só** terminais: `approved`, `rejected`, `cancelled_by_client`, `counteroffer_declined`. **Não** arquivar `pending`, `under_review`, `counteroffer`. **Desarquivar** permitido (efeito só no lado do usuário; **não** reabre negócio). Arquivamento **não** apaga histórico. **`updatedAt` intocado** no arquivo/desarquivo. Detalhe canônico: [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md).

### Fora do escopo (A2)

- Arquivamento global unilateral por um lado para o outro (sem decisão conjunta/legal — listar como **pendência**).
- Eliminar registos sensíveis sem governança de retenção.

### Artefactos esperados antes/durante implementação futura

- Atualização de [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) com campos finais + matriz QA ou § em [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md) ou documento QA dedicado da fatia.

### QA / smoke futuro

- Um lado arquiva; o outro continua a ver com filtro próprio até decidir arquivo também.
- Lista “ativos” não mostra arquivados sem toggle.
- Rules: tentativa cruzada de escrita deve falhar; **`npm run test:rules:loanRequests`** obrigatório na fatia **A2b**.

**Pós-Bloco 1:** **funcionalmente fechado** — **`A2b`**/**`A2c`** permanecem **backlog** (ver plano arquivado §6 A2). **B2** **concluída** — **`07ef7e5`**. **Próxima fase recomendada do produto:** **Bloco 2** (§ abaixo).

---

## Fase B — Alerta de saldo insuficiente (não bloqueante)

### Objetivo

Fornecedor é **informado** se o **Total disponível local** (`availableMoney` do motor, mesma grandeza do Painel) é inferior ao montante pedido (comparar **`requestedAmount / 100`** em reais com **`availableMoney`**), antes de **aprovar**, **sem impedir** a ação na plataforma.

### Subfase B1 (Bloco 1 — análise, sem código) — concluída

- **Export usado:** `calculateGlobalStats` em `calculations.js` → **`availableMoney`**.
- **Produto:** mesmo número do card **“Total Disponível”** no Painel.
- **B2** seguiu **sem** alterar `calculations.js`; alerta **informativo**; **não** saldo bancário; **não** gravar no Firestore por causa do alerta.

### Subfase B2 (Bloco 1 — implementação) — concluída

- **Commit:** **`07ef7e5`** — `feat(loan-requests): adicionar alerta de disponível local no fornecedor`.
- **Dados:** repasse de **`availableMoney`** desde **`globalStats`** — **`App.jsx` → `Settings.jsx` → `AccountScreen.jsx` → `LoanRequestsSupplierPanel.jsx`**.
- **Regra de exibição:** **`requestedAmount / 100 > availableMoney`** (unidades: centavos vs reais); só com números finitos; status **`pending`** ou **`under_review`** **apenas** — **sem** terminais (`approved`, `rejected`, `cancelled_by_client`, `counteroffer_declined`, …); **sem** **`counteroffer`** (aguardando decisão do cliente), conforme smoke registrado pela equipe.
- **Guardrails preservados:** **sem** alteração a **`calculations.js`**, **`firestore.rules`**, schema Firestore, transições, gravação remota motivada pelo alerta, **`payment.linkContext`**, sync financeiro remoto ou contrato automático; aprovação **sempre** permitida quando a UI oferece a ação.

### Escopo típico

- Ler dados **já persistidos localmente** no escopo **`account:{uid}`** da conta do fornecedor — **somente UI + leitura**; não escrever `loanRequest` nem alterar pedido por causa do saldo nesta fase.
- Mensagem âmbar, curta, explícito que não valida conta bancária nem garante liquidity.

### Fora do escopo (B)

- Bloqueio de botão de aprovar (isso migra política para **Fase C**).
- Interpretar dados da outra parte ou do servidor como saldo financeiro autoritativo.

---

## Fase C — Bloqueio ou restrição por saldo (só após decisão explícita)

### Objetivo

Aplicar **política** acordada (bloqueio duro, aviso forte com confirmação extra, ou regra apenas na conversão futura **F**) depois de recolher feedback da **Fase B**.

### Dependência obrigatória

- **Não** iniciar **C** até a equipa registar suficiente uso ou smoke da **B** e escolher **uma** política explícita (evitar mistura A/B/C no mesmo release sem decisão).

### Fora do escopo implícito

- Qualquer uso de pedido remoto como **motor** financeiro obrigatório no `calculations.js`.

---

## Fase D — Sugestão de contraproposta via recebíveis futuros (planejamento)

### Objetivo

**Auxiliar** o fornecedor com texto/montantes sugeridos com base na **informação já local** (contratos, parcelas esperadas — desenho a detalhar), sem criar automatismo que mova dinheiro ou estado financeiro autoritativo remoto.

### Escopo típico

- Pré-preencher ou botão **“Usar sugestão”** nos campos já existentes de contraposta (continua sendo negociação pré-financeira).
- Linguagem sempre de **“sugestão”**, editável, com disclaimer.

### Fora do escopo (D)

- Criar “intenção agendada” remota obrigatória (aproxima a **fase E**).
- Persistir novo tipo de obrigação financeira apenas por sugestão aceite sem fluxo revisado.

### Riscos a endereçar antes de código

- Consistência com formatos de contratos legados na leitura local: agregações **explicitamente documentadas** — **não** alterar `calculations.js` em silêncio sem decisão de produto.

---

## Fase E — Pendência futura e confirmação manual intermediária

### Objetivo

Permitir combinar **valor + data esperada** de disponibilização como parte do diálogo pré-financeiro, com UX de “pendente até data”, **cancelamento** por ambos antes da efetivação do passo combinado na governança, e **avisos na data**.

### Requisitos de governança

- **ADR obrigatória** antes de schema novo ou status novo (evitar misturar com `counteroffer` sem critérios).
- Explicitar que não há **liquidação automática** nem **contrato/caixa automáticos** nesta linha até **F**.

### Pendências típicas

- Novos campos vs novo `status`; impacto nas rules (`loanRequestUpdateValid`), índices, testes emulator.

---

## Fase F — Conversão governada para contrato local

### Objetivo

Ponta final controlada da ponte: **após confirmação humana inequívoca** (“A transferência **real** foi feita no acordo combinado?”), permitir iniciar criar **contrato local** por fluxo próprio — **desenho inteiro não é produto atual**.

### Guardrails estritos

- **ADR completa**: fronteira pedido pré-financeiro vs registro financeiro local; tratamento duplicidades; papel de vínculos.
- Fluxo próprio **revisor** antes de criar contrato ou alterar disponível/caixa/dashboard.
- Não promete que dados na nuvem substituíram arquivo local ou vice-versa.

**Empacotamento futuro:** **Bloco 2** (§ seguinte) espelha a **Fase F**; registro histórico do **Bloco 1** em [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md). **F** e **Bloco 2** **não** estão implementados.

---

## Bloco 2 — Conversão Governada de LoanRequest aprovado em Contrato Local *(ADR aprovado — código não iniciado)*

**Status:** **próxima fase recomendada** após **Bloco 1 funcionalmente fechado** (Opção A, 2026-05-04). **Fonte viva:** [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) — **aprovado pela governança** para orientar implementação em subfases. **Bloco2-0** (documentação ADR/plano) **concluído com aprovação**; **Bloco2-A** **autorizada** como próximo incremento (**entrada UX** para `approved` apenas — sem criar contrato, sem modal completo, sem Firestore/`calculations.js`/rules nesta subfase); **Bloco2-B–E** — **não** concluídos; **código de produto do Bloco 2** — **não** iniciado até PR **Bloco2-A**. **MVP:** sem marcação remota de conversão. **Nenhuma** alteração a **`firestore.rules`**, **schema** ou **`calculations.js`** no MVP do Bloco 2 sem decisão explícita fora do âmbito deste ADR.

### Objetivo (resumo)

Permitir que um pedido **aprovado** (`LoanRequest`) possa ser **transformado** num **contrato financeiro local** **somente** após **confirmação humana explícita** de que a **transferência real** foi feita.

### Conceito central

- Pedido **aprovado na plataforma** **não** cria contrato **automaticamente**.
- A conversão é **governada**, **manual**, **revisável** e **local-first** (efeito no ciclo financeiro local só após passos explícitos no app).
- Qualquer passo futuro exige **confirmação humana** sobre a transferência real, **tela de revisão**, e **criação do contrato local só depois** dessa confirmação; **preservar** **local-first** e **Firebase não** como fonte financeira autoritativa.

### Fluxo conceitual futuro *(não implementado)*

1. **LoanRequest** **aprovado** (estado pré-financeiro já existente).  
2. Ação futura (ex.): **“Registrar contrato local”**.  
3. **Tela de revisão** antes de persistir o contrato.  
4. Confirmação explícita: *“A transferência real já foi feita?”*  
5. **Criação do contrato local** (após confirmação).  
6. Reflexo no ciclo já existente: **Clientes**, **Painel**, **Total na Rua**, **caixa**, motor local — conforme regras atuais de produto (a detalhar no ADR/plano).

### Decisões futuras *(antes de código)*

- Detalhes operacionais, subfases **Bloco2-A–E**, guardrails e decisões **D1–D10:** ver [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md).

### Alinhamento de UX *(a fixar no ADR/plano)*

Microcopy, revisão e confirmação humana seguem o [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md); hierarquia visual do produto: [`DESIGN.md`](../DESIGN.md), [`BRAND.md`](../BRAND.md), [`PROJECT_OVERRIDES.md`](../PROJECT_OVERRIDES.md).

---

## Histórico de atualizações (documento vivo)

| Data | Nota |
|------|------|
| 2026-05-03 | Criação do roadmap **A1–F** como documentação viva complementar ao handoff, checkpoint e [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) — só planejamento; sem implementação de produto associada neste arquivo. |
| 2026-05-04 | Plano **Bloco 1** arquivado: [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) — A1, A2a, B1+B2 (**`07ef7e5`**). |
| 2026-05-04 | **Fase A1 concluída** (Bloco 1): **`dcc9f80`** (utilitário + testes) · **`4951bdf`** (badges na Conta). **Próxima subfase do plano:** **A2a** (decisões de arquivamento, sem código). **A2b/A2c, B–F** não concluídas. |
| 2026-05-04 | **Subfase B1 concluída (análise):** métrica **`availableMoney`** / **`calculateGlobalStats`**; B2 com **`requestedAmount / 100`**; ver Fase B. |
| 2026-05-04 | **Governança Opção A:** **Bloco 1 funcionalmente fechado**; **A2b/A2c** em **backlog**; **Bloco 2** **próxima fase recomendada** — ADR [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) (**posteriormente aprovado** — ver histórico seguinte); código Bloco 2 **não** iniciado na altura. |
| 2026-05-04 | **Bloco2-0:** [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) criado; **Bloco2-A–E** não concluídos na altura. |
| 2026-05-04 | **Governança Bloco 2:** ADR **aprovado**; **Bloco2-A** **autorizada**; **D6** fechada (data contrato = conversão local); MVP sem marcação remota; **código Bloco2-A** — **não iniciado**. |

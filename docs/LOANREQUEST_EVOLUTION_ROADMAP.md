# Roadmap vivo — evolução de `loanRequest` (A1–F)

## Status deste documento

- **Natureza:** planejamento **vivo** para encaixar evoluções futuras da área **pré-financeira** (`loanRequests`) sem tratar **`docs/plans/completed/`** como plano ativo (permanece **referência histórica** apenas; ver [`plans/README.md`](./plans/README.md)).
- **Não substitui** [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md), [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md) nem [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) — **complementa** com fases ordenadas **A1 → F**.
- **Modelo atual (factual):** [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md); fechamento v1.1 — [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md).

Este arquivo **descreve** o que poderá ser construído; **nenhuma linha aqui obriga código** já existente até decisão explícita de governança e critérios de entrada para implementação.

- **Plano executável ativo (Bloco 1 — trechos A1, A2a, B):** [`PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) — subfases, critérios de aceite e sequência para Composer 2 Fast; **não** substitui este roadmap nem implementa nada por si só.

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

Ordem recomendada: **A1** → **A2** → **B** avaliada em produção/smoke antes de **C**; **D** em paralelo somente após definir bem leitura de recebíveis sem regressão ao motor; **E** e **F** apenas com ADR(s) aceite(s).

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

- Novos timestamps por lado (**exemplo de desenho**): **`archivedByClient`**, **`archivedBySupplier`** — apenas **planejamento** neste roadmap; modelo final sujeito a revisão antes de código.
- **Security Rules**: cada papel altera apenas o próprio marcador de arquivo; **`updatedAt`**: política a definir (alinhar RB “readBy não mexe em `updatedAt`” vs arquivamento operacional — decisão obrigatória antes de codar).
- UI: **Arquivar** / **Mostrar arquivados** ou equivalente nos painéis [`LoanRequestsClientPanel.jsx`](../src/components/LoanRequestsClientPanel.jsx) e [`LoanRequestsSupplierPanel.jsx`](../src/components/LoanRequestsSupplierPanel.jsx).
- **Excluir** documento remotamente não é objetivo (“excluir” permanece menos seguro enquanto `delete` estiver vedado pelas rules).

### Fora do escopo (A2)

- Arquivamento global unilateral por um lado para o outro (sem decisão conjunta/legal — listar como **pendência**).
- Eliminar registos sensíveis sem governança de retenção.

### Artefactos esperados antes/durante implementação futura

- Atualização de [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) com campos finais + matriz QA ou § em [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md) ou documento QA dedicado da fatia.

### QA / smoke futuro

- Um lado arquiva; o outro continua a ver com filtro próprio até decidir arquivo também.
- Lista “ativos” não mostra arquivados sem toggle.
- Rules: tentativa cruzada de escrita deve falhar.

---

## Fase B — Alerta de saldo insuficiente (não bloqueante)

### Objetivo

Fornecedor é **informado** se o **saldo/disponível local** (métrica a definir) é inferior ao montante pedido antes de **aprovar**, **sem impedir** a ação na plataforma.

### Escopo típico

- Ler dados **já persistidos localmente** no escopo **`account:{uid}`** da conta do fornecedor — **somente UI + leitura**; não escrever `loanRequest` nem alterar pedido por causa do saldo nesta fase.
- Mensagem âmbar, curta, explícito que não valida conta bancária nem garante liquidity.

### Fora do escopo (B)

- Bloqueio de botão de aprovar (isso migra política para **Fase C**).
- Interpretar dados da outra parte ou do servidor como saldo financeiro autoritativo.

### Decisões pendentes

- Que número mostrar (“caixa”? “disponível após obrigações”? agregadores existentes)?  
- O alerta aparece apenas em estado `pending` / `under_review` ou também noutras respostas?

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

---

## Histórico de atualizações (documento vivo)

| Data | Nota |
|------|------|
| 2026-05-03 | Criação do roadmap **A1–F** como documentação viva complementar ao handoff, checkpoint e [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) — só planejamento; sem implementação de produto associada neste arquivo. |
| 2026-05-04 | Referência ao plano executável **Bloco 1:** [`PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) (A1, A2a, B). |
| 2026-05-04 | **Fase A1 concluída** (Bloco 1): **`dcc9f80`** (utilitário + testes) · **`4951bdf`** (badges na Conta). **Próxima subfase do plano:** **A2a** (decisões de arquivamento, sem código). **A2b/A2c, B–F** não concluídas. |

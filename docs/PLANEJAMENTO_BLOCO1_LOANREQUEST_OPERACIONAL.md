# Plano executável — Bloco 1: Avanço operacional de LoanRequest

## 1. Status deste documento

| Campo | Valor |
|-------|--------|
| **Natureza** | Plano **vivo e executável** para continuidade entre chats (limite de contexto do Cursor). |
| **Projeto** | AGEmp / Finanças Pro. |
| **Relação com** [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md) | Este arquivo **detalha** a execução do Bloco 1: **A1** (implementada), **A2a** (decisões **documentadas**, sem código), **B** (pendente conforme sequência); **A2b/A2c** ficam para ciclo futuro — **não** substitui o roadmap nem muda os guardrails descritos lá. |
| **Implementação** | **Não** há implementação automática por existir este texto. Cada subfase exige execução explícita no repositório, smoke e commits conforme governança. |
| **Localização** | Plano **ativo** permanece em **`docs/`** (este arquivo). Quando o bloco for **finalizado** (smoke + docs atualizados), mover para **`docs/plans/completed/`**. |
| **`docs/plans/completed/`** | Continua **somente histórico** — não é plano ativo (ver [`plans/README.md`](./plans/README.md)). |

### Status do Bloco 1 (execução parcial)

| Fase / subfase | Estado |
|----------------|--------|
| **A1** (A1a + A1b) | **Concluída.** **`dcc9f80`** — utilitário `countUnreadLoanRequests` + testes (`loanRequestUnreadCount.js`). **`4951bdf`** — badges numéricos discretos em **AccountScreen** nos botões **“Abrir solicitações”** (papel cliente) e **“Abrir pedidos recebidos”** (papel fornecedor). **Sem** alteração de `firestore.rules`, **`calculations.js`**, schema Firestore, `App.jsx`, `Settings.jsx`, sync financeiro remoto, contrato automático nem `payment.linkContext`. Carga sob demanda na vista principal da conta; **sem** listener global. |
| **A2a** | **Decisões documentadas (sem código).** Contrato conceitual de arquivamento **por lado** fechado antes de **A2b/A2c** — ver tabela desta subfase e § **Decisões A2a fechadas** abaixo. **Não** implementa campos, rules, helpers, UI nem testes. |
| **A2b / A2c** | **Futuras** — implementação técnica (**A2b**) e UI (**A2c**) **não** iniciadas neste registro. |
| **Próxima subfase recomendada** | **`B1`** — análise da métrica de saldo (**sem** editar `calculations.js`), conforme sequência §5 — **salvo decisão explícita** de equipe/governança de executar **A2b** antes de **B1**. **B2, C–F** permanecem **não** concluídas. |

---

## 2. Estado atual confirmado (baseline)

### Pacotes fechados

- **`loanRequest` v1** — fechado (LKG `lkg-2026-05-01-loanrequest-v1-complete`).
- **`loanRequest` v1.1 (RB + CN)** — fechado (LKG `lkg-2026-05-03-loanrequest-v1-1`; marco RB: `lkg-2026-05-03-loanrequest-v1-1-rb`).

### Modelo e comportamento atuais (pré-financeiro)

- **7 status:** `pending`, `under_review`, `counteroffer`, `approved`, `rejected`, `cancelled_by_client`, `counteroffer_declined`.
- **Marcadores de leitura:** `readByClientAt`, `readBySupplierAt` (política B: **não** alteram `updatedAt` nas transições de leitura).
- **Contraproposta:** estados `counteroffer` e terminal `counteroffer_declined`; rodada única conforme regras e código.
- **Badge "Novo"** por item nos painéis `LoanRequestsClientPanel` / `LoanRequestsSupplierPanel` (novidade legítima da contraparte vs `readBy*`).
- **Robustez:** `console.warn` em falha ao marcar leitura.
- **UX fornecedor:** limpeza de drafts locais (observação / valor de contraproposta) ao recolher ou após ação bem-sucedida.
- **Delete:** vedado pelas regras Firestore (`allow delete: false` para `loanRequests`).
- **Camada pré-financeira:** sem conversão automática para contrato local/remoto; sem sync financeiro remoto do domínio financeiro.

Referências técnicas vivas: [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md), [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md).

---

## 3. Bloco 1 — recorte aprovado

### Incluído neste plano executável

| Trecho | Conteúdo |
|--------|-----------|
| **A1** | Sinalização de novidades **derivada** de dados existentes e `readBy*` — badges numéricos nos botões do **AccountScreen** (fase 1), **sem** novos campos Firestore e **sem** alteração de `firestore.rules`. |
| **A2** | **Subfase A2a** neste ciclo: **decisões** de arquivamento por lado (só `docs/`). **A2b/A2c** — implementação **futura** até decisão explícita. |
| **B** | Alerta de saldo/disponível **insuficiente**, **não bloqueante**, no painel do fornecedor; leitura do financeiro local; **sem** alterar `calculations.js`. |

### Excluído do Bloco 1 (permanece roadmap apenas)

| Fase | Motivo |
|------|--------|
| **C** | Bloqueio/restrição por saldo — só após **B** validada e **decisão explícita**. |
| **D** | Sugestão de contraproposta por recebíveis futuros — fora do escopo de implementação do Bloco 1. |
| **E** | Pendência futura / lembretes — exige **ADR** antes de qualquer código. |
| **F** | Conversão governada para contrato local — exige **ADR completa** e confirmação humana explícita. |

---

## 4. Guardrails obrigatórios

1. **Financeiro local-first** preservado.
2. **Sem** sync financeiro remoto autoritativo (clientes/contratos/pagamentos/caixa/dashboard como fonte na nuvem).
3. **Sem** `payment.linkContext` (ADR atual: [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md)).
4. **Sem** contrato automático a partir de pedido remoto.
5. **Sem** promessa de transferência real nem validação bancária na copy.
6. **`calculations.js` intocado** no Bloco 1 — B apenas **lê** agregadores/funções já existentes; se não houver agregador seguro, **parar** em B1 e decidir.
7. **`firestore.rules`** — **não** alterar neste bloco até a **futura A2b** (arquivamento). A1 e B **não** dependem de mudança de rules.
8. **C / D / E / F** não entram como implementação no Bloco 1.

Microcopy e UI: seguir [`DESIGN.md`](../DESIGN.md), [`BRAND.md`](../BRAND.md), [`PROJECT_OVERRIDES.md`](../PROJECT_OVERRIDES.md) — poucos destaques, mobile-first, badges discretos.

---

## 5. Sequência oficial do Bloco 1

Ordem **obrigatória** (sem paralelizar subfases no mesmo prompt):

1. **Subfase 0** — Leitura de contexto (docs + código relevante).
2. ~~**Subfase A1a** — Utilitário `loanRequestUnreadCount.js` + testes unitários.~~ **Feita** — commit **`dcc9f80`**.
3. ~~**Subfase A1b** — Badges numéricos nos botões **"Abrir solicitações"** e **"Abrir pedidos recebidos"** em `AccountScreen.jsx`.~~ **Feita** — commit **`4951bdf`**.
4. ~~**Ponto de parada** — Validar **A1** com smoke manual (`vitest`, `build`, cenários com dois usuários quando aplicável).~~ **A1 concluída** (evidência: commits acima; CI local `vitest` + `build` na entrega).
5. ~~**Subfase A2a** — Decisões de arquivamento (**planejamento, sem código**).~~ **Documentação fechada** — ver §6 (A2a) e §7.
6. **A2b / A2c** — **Futuras**; **não** executar sem **aprovação explícita** após A2a; **A2c** **só depois** de **A2b** concluída.
7. **Subfase B1** — **Próxima no fluxo padrão do Bloco 1** após A2a — confirmar métrica de saldo (**"disponível"** preferida) com funções/agregadores **já existentes** em `calculations.js`, **sem** editar o arquivo (**salvo** decisão explícita de priorizar **A2b** antes).
8. **Subfase B2** — Alerta não bloqueante no painel do fornecedor.
9. **Fechamento do Bloco 1** — Smoke completo + atualização dos **documentos vivos** (§9).

---

## 6. Detalhamento das subfases

### Subfase 0 — Leitura de contexto

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Alinhar o executor ao estado factual do repo e aos guardrails antes de codar. |
| **Escopo** | Leitura deste plano, [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md), [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md), [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md), [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md), [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md), [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md); trechos de `AccountScreen.jsx`, painéis LoanRequest, `loanRequestsFirestore.js`. |
| **Arquivos prováveis** | Nenhum (somente leitura). |
| **Firestore/rules** | Não |
| **Financeiro local** | Não |
| **Riscos** | Baixo |
| **Critérios de aceite** | Próxima subfase identificada explicitamente (normalmente **A1a**). |
| **QA/smoke** | N/A |
| **Sugestão de commit** | N/A |

---

### Subfase A1a — Utilitário de contagem de novidades

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Função pura que conta pedidos com novidade legítima para o papel (`client` ou `supplier`), espelhando a lógica dos painéis (evento da contraparte vs `readBy*`, janela de `pending` no fornecedor quando aplicável). |
| **Escopo** | Criar `src/utils/loanRequestUnreadCount.js` + `src/utils/__tests__/loanRequestUnreadCount.test.js`. |
| **Arquivos prováveis** | `src/utils/loanRequestUnreadCount.js` (novo), `src/utils/__tests__/loanRequestUnreadCount.test.js` (novo). |
| **Firestore/rules** | Não |
| **Financeiro local** | Não |
| **Riscos** | Derivação divergente da lógica dos painéis → alinhar critérios com as funções existentes nos painéis. |
| **Critérios de aceite** | Testes cobrem lista vazia, terminais, contraproposta pendente, `pending` fornecedor; `npx vitest run` OK. |
| **QA/smoke** | `npx vitest run` |
| **Sugestão de commit** | `feat(loanRequest): add unread count utility (A1 prep)` |

---

### Subfase A1b — Badges no AccountScreen

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Mostrar contagem discreta nos botões **"Abrir solicitações"** e **"Abrir pedidos recebidos"** quando `count > 0`. |
| **Escopo** | Carregar listas ao montar **AccountScreen** (ou ponto equivalente já existente), usar A1a, estilo alinhado ao badge "Novo" (`bg-primary-soft` / `text-primary`, pequeno). **Não** badge em `Settings.jsx` / "Gerenciar conta" nesta fase. **Não** badge na tab principal do `App.jsx`. |
| **Arquivos prováveis** | `src/components/AccountScreen.jsx`; eventual passagem de props/callbacks desde `Settings` se necessário. |
| **Firestore/rules** | Leitura apenas (queries existentes / indexadas). |
| **Financeiro local** | Não |
| **Riscos** | Leituras extras ao abrir conta; flicker até carregar — mitigar com estado de carregamento ou só exibir após dados. |
| **Critérios de aceite** | Contagem correta por papel; sem badge quando 0; mobile legível; `npm run build` OK. |
| **QA/smoke** | `vitest` + `build` + smoke manual (dois papéis / novidades). |
| **Sugestão de commit** | `feat(loanRequest): add unread badge on AccountScreen buttons (A1)` |

---

### Subfase A2a — Decisões de arquivamento (sem código)

| Campo | Conteúdo |
|-------|----------|
| **Estado** | **Documentação fechada** — decisões registradas nos docs vivos; **nenhuma** implementação. |
| **Objetivo** | Fechar o **contrato conceitual** antes de A2b (rules + helpers + testes + possível [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md)). |
| **Escopo** | Somente texto em `docs/` — ver **Decisões A2a fechadas** abaixo. |
| **Arquivos prováveis** | Documentos vivos (`docs/*.md` conforme governança); **zero** alteração em `src/`, `firestore.rules`, testes. |
| **Firestore/rules** | **Não** nesta subfase |
| **Financeiro local** | Não |
| **Riscos** | Confundir A2a (decisão) com A2b (implementação). |
| **Critérios de aceite** | Contrato legível; `updatedAt` decidido; **A2b/A2c** ainda **não** declaradas concluídas. |
| **QA/smoke** | N/A |
| **Sugestão de commit** | `docs(loan-requests): registrar decisões A2a arquivamento` (quando aplicável). |

#### Decisões A2a fechadas (contrato conceitual — não implementado)

1. **Tipo:** arquivamento **por lado / por usuário**. Cliente arquiva só **para si**; fornecedor só **para si**. **Não** é global: um lado arquivar **não** oculta o pedido para a contraparte.
2. **Exclusão:** excluir pedido remoto **permanece fora do escopo**; `delete` continua **proibido** nas rules. Arquivamento **não** apaga histórico — apenas **oculta / organiza** a lista **daquele** usuário.
3. **Campos planejados para A2b:** `archivedByClient`, `archivedBySupplier` — **intenção** de timestamp ou valor anulável/removível conforme desenho técnico futuro nas rules; **ainda não** existem no modelo implementado.
4. **Status arquiváveis:** somente **terminais** — `approved`, `rejected`, `cancelled_by_client`, `counteroffer_declined`. **Não** arquivar `pending`, `under_review`, `counteroffer` (evitar esconder pedido que ainda exige atenção).
5. **Desarquivar:** **permitido**; vale **só** para o lado que desarquiva; **não** reabre status nem altera fluxo de negócio.
6. **`updatedAt`:** **não** deve ser alterado em arquivamento/desarquivamento — metadado operacional por lado, análogo em espírito aos `readBy*` (organização da lista, não evento negocial da contraparte); evita perturbar ordenação, “último evento relevante” e badges **“Novo”**. **A2b** deve preferir **diff restrito** ao campo do próprio papel.
7. **UI planejada para A2c:** lista padrão **oculta** arquivados daquele lado; controle **“Mostrar arquivados”** (ou equivalente); indicação **discreta** quando visíveis; **Arquivar** só em terminais; **Desarquivar** quando arquivados; microcopy **sem** confundir com **excluir**.
8. **Rules planejadas A2b:** cliente só grava `archivedByClient`; fornecedor só `archivedBySupplier`; escrita cruzada **falha**; só em status **terminal**; **sem** nova permissão de `delete`; **`npm run test:rules:loanRequests`** obrigatório em A2b.
9. **Ordem:** **A2c** **somente após** **A2b** estável. **Próxima subfase padrão do Bloco 1 após A2a:** **B1** (salvo decisão explícita de priorizar A2b).

---

### Subfase A2b — Campos + rules (FUTURA)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Implementar persistência e segurança do arquivamento após A2a. |
| **Pré-requisito** | Decisões **A2a** documentadas (§6); governança autoriza código. |
| **Escopo mínimo esperado** | `firestore.rules`; helpers em `src/firebase/loanRequestsFirestore.js` (e correlatos conforme padrão do repo); **`npm run test:rules:loanRequests`** verde; atualização de [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) quando o modelo estiver real; smoke manual cruzado (cliente/fornecedor). **Sem** `delete`. **`updatedAt`** **não** muda no arquivamento/desarquivamento (política A2a). |
| **Arquivos prováveis** | `firestore.rules`, `src/firebase/loanRequestsFirestore.js`, `__tests__/firestore/...` |
| **Firestore/rules** | **Sim** |
| **Financeiro local** | Não |
| **Riscos** | Orçamento de avaliação das rules; regressão em `loanRequestUpdateValid`. |
| **Critérios de aceite** | Testes de rules verdes; deploy conforme processo do projeto. |
| **QA/smoke** | Emulador + smoke manual cruzado (cliente/fornecedor). |
| **Sugestão de commit** | `feat(loanRequest): add per-side archive fields and rules (A2)` |

---

### Subfase A2c — UI de arquivamento (FUTURA)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Arquivar / desarquivar e filtrar lista nos painéis. |
| **Pré-requisito** | **A2b** concluída e estável (campos + rules). |
| **Escopo** | `LoanRequestsClientPanel.jsx`, `LoanRequestsSupplierPanel.jsx`. |
| **Arquivos prováveis** | Os dois painéis. |
| **Firestore/rules** | Não (usa A2b já implantado) |
| **Financeiro local** | Não |
| **Riscos** | Confusão arquivar vs excluir — microcopy clara. |
| **Critérios de aceite** | Um lado arquiva; outro não perde visibilidade do histórico bruto conforme desenho. |
| **QA/smoke** | Smoke manual + regressão badge A1 se listas mudarem. |
| **Sugestão de commit** | `feat(loanRequest): add archive UI in loan request panels (A2)` |

---

### Subfase B1 — Métrica de saldo (análise, sem alterar `calculations.js`)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Confirmar qual número usar para o alerta (**preferência: "disponível"**), com base em **export(s) existente(s)** de `calculations.js`. |
| **Escopo** | Inspeção somente leitura de `calculations.js` e consumo planejado em B2. **Se não houver agregador seguro**, **não** implementar B2 — retornar a decisão de produto (ex.: métrica alternativa ou adiar B). |
| **Arquivos prováveis** | Nenhuma alteração obrigatória nesta subfase. |
| **Firestore/rules** | Não |
| **Financeiro local** | Leitura conceitual |
| **Riscos** | Forçar métrica ambígua e gerar alertas incorretos. |
| **Critérios de aceite** | Métrica nomeada e função(s) de leitura identificada(s) **sem** patch em `calculations.js`, ou pedido de decisão registrado. |
| **QA/smoke** | N/A |
| **Sugestão de commit** | N/A |

---

### Subfase B2 — Alerta não bloqueante (fornecedor)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Aviso visual se disponível (ou métrica acordada em B1) **<** valor solicitado; **não** bloquear aprovação; não prometer transferência nem validação bancária. |
| **Escopo** | `LoanRequestsSupplierPanel.jsx`; leitura do estado financeiro local já carregado no app ou via helper existente **sem** alterar o motor. |
| **Arquivos prováveis** | `LoanRequestsSupplierPanel.jsx`; possivelmente passar prop desde `App.jsx` / `AccountScreen` se necessário para acessar agregados. |
| **Firestore/rules** | Não |
| **Financeiro local** | Sim (**somente leitura**) |
| **Riscos** | Usuário interpretar como bloqueio — copy e cor (âmbar, não vermelho de erro crítico). |
| **Critérios de aceite** | Aprovação sempre possível; alerta só em estados acordados (ex.: `pending` / `under_review`); build OK. |
| **QA/smoke** | Smoke manual com valores de caixa/disponível distintos |
| **Sugestão de commit** | `feat(loanRequest): add non-blocking balance alert for supplier (B)` |

---

### Fechamento do Bloco 1

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Encerrar o bloco com evidência de regressão e documentação alinhada. |
| **Escopo** | Smoke amplo A1+B; atualizar docs conforme §9; mover **este arquivo** para `docs/plans/completed/` quando o Bloco 1 estiver **integralmente** concluído (incluindo A2b/A2c **se** forem feitos no mesmo bloco — caso contrário, fechar sub-bloco A1+B e manter plano ativo até A2). |
| **Nota operacional** | Se apenas **A1 + A2a + B** forem entregues neste ciclo, ao fechar: atualizar roadmap/handoff; **A2b/A2c** podem abrir um “Bloco 1b” ou continuar neste plano até mover ao `completed/`. |

---

## 7. Decisões incorporadas (aprovação de produto)

| ID | Decisão |
|----|---------|
| **A1b** | Badge **somente** no **AccountScreen**, nos botões "Abrir solicitações" e "Abrir pedidos recebidos". **Sem** badge em `Settings.jsx` / "Gerenciar conta" nesta primeira fase. **Sem** badge na tab principal do `App.jsx`. Evolução posterior possível para Settings após validar A1. |
| **A2** | Arquivamento **por lado** (cliente / fornecedor), **não** global. **Excluir** documento remoto continua **fora** do escopo; `delete` permanece vedado. Status arquiváveis **apenas** terminais: `approved`, `rejected`, `cancelled_by_client`, `counteroffer_declined`. **Não** arquivar `pending` / `under_review` / `counteroffer`. Desarquivar **permitido** (só afeta o lado que desarquiva; **não** reabre negócio). |
| **A2 — `updatedAt`** | **Decidido (A2a):** arquivamento/desarquivamento **não** alteram `updatedAt` — metadado por lado, alinhado à filosofia dos `readBy*`. |
| **A2a** | **Somente decisão/documentação** — **concluída** neste registro; **sem** campos implementados. |
| **A2b / A2c** | **Não** concluídas; **A2c** depois de **A2b**. |
| **B** | Métrica preferida **"disponível"**; **confirmar** em **B1** com agregadores **existentes**; **proibido** alterar `calculations.js` no Bloco 1. Se não houver agregador seguro: **parar** e decidir. |
| **C/D/E/F** | **Roadmap apenas**; não fazem parte da implementação do Bloco 1. |

---

## 8. Estratégia de execução com Composer 2 Fast

- Executar **uma subfase por vez** (um prompt / uma sessão focada).
- **Não** agrupar A1a+A1b no mesmo prompt se isso aumentar risco de regressão.
- **A1a** é a primeira subfase executável com código.
- **A1b** somente após A1a validada (`vitest` OK).
- **A2b/A2c** somente após **A2a** documentada **e** aprovação explícita para codar; **`updatedAt`** no arquivo: **já decidido** (não mudar).
- **B2** somente após **B1** concluída com métrica segura ou decisão alternativa.
- Em caso de dúvida sobre guardrails, reler **§4** e a Project Rule do workspace.

---

## 9. Documentos a atualizar no futuro

| Momento | Documento(s) |
|---------|----------------|
| Após **A1** completo | [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md) (A1); [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md) — **feito (2026-05-04)** — ver § Bloco 1 / A1. |
| Após **A2** completo (A2b+A2c) | [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md); roadmap (A2); matriz QA; `HANDOFF_MASTER` / `CHECKPOINT` se LKG/handoff evoluírem. |
| Após **B** completo | Roadmap (B); matriz QA (smoke alerta). |
| **Fechamento Bloco 1** | [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md), [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md), [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) se aplicável; **mover** este plano para `docs/plans/completed/`. |

---

## 10. Prompt de retomada para novo chat no Cursor

Cole ou adapte o bloco abaixo ao abrir um novo chat para continuar o Bloco 1:

```text
Continuidade AGEmp / Finanças Pro — Bloco 1 (LoanRequest operacional).

1. Ler o plano executável: docs/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md
2. Ler docs/HANDOFF_MASTER.md, docs/CHECKPOINT_CHECKLIST.md, docs/NEXT_PHASE_OFFICIAL.md e docs/LOANREQUEST_EVOLUTION_ROADMAP.md
3. Identificar a próxima subfase pendente (**B1** no fluxo padrão após A2a documentada; **ou** **A2b** se a governança priorizar implementação de arquivo antes de B — **A2c** só após **A2b**) e executar somente essa subfase
4. Não tratar docs/plans/completed/ como plano ativo
5. Não implementar mais de uma subfase por sessão/prompt
6. Preservar guardrails: financeiro local-first; sem sync financeiro remoto; sem payment.linkContext; sem contrato automático; sem promessa de transferência real; calculations.js intocado; firestore.rules só na futura A2b
```

---

### Histórico deste plano

| Data | Nota |
|------|------|
| 2026-05-04 | Criação do plano executável Bloco 1 (A1 + A2a planejamento + B; A2b/A2c futuras; C–F fora). |
| 2026-05-04 | Plano ativo em **`docs/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`** (padrão projeto); ao concluir o Bloco 1, arquivar em **`docs/plans/completed/`**. |
| 2026-05-04 | **Fase A1 concluída:** **`dcc9f80`** (A1a, utilitário + testes) · **`4951bdf`** (A1b, badges na Conta). Próxima: **A2a** (decisões de arquivamento, sem código). |
| 2026-05-04 | **Subfase A2a concluída (documental):** contrato de arquivamento por lado, terminais, desarquivar, `updatedAt` intocado, rules/UI futuras — **sem** código. **Próxima recomendada:** **B1** (salvo priorizar **A2b**). |

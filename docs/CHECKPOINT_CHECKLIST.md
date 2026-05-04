# AGEmp / Finanças Pro — Checkpoint e checklist geral

## Status do documento

Documento de **acompanhamento** e **checklist** do projeto — complementa [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md); não o substitui.

**Papel (continuidade PM/PO):** registrar o que está **feito**, **validado**, **fora de escopo**, **congelado** e **provável a seguir**, para alinhamento rápido entre releases e sem reabrir decisões já consolidadas no código.

Leitura recomendada junto com:

1. código real do repositório  
2. [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md)  
3. prompt base permanente e prompts base dos subagents (quando aplicável)  
4. Project Rule (guardrail: limites, cautela, direção futura — trechos de “estado atual” na rule podem estar defasados; priorizar código + handoff)  
5. `DESIGN.md`, `BRAND.md`, `PROJECT_OVERRIDES.md` (UX/UI)

**Planejamentos concluídos:** [`plans/completed/`](./plans/completed/) — arquivos arquivados por decisão de produto/governança; uso principalmente **histórico**. Não devem ser tratados como fonte prioritária padrão frente a este checkpoint ou ao handoff, salvo necessidade histórica explícita.

**Base estável de referência (LKG):** `lkg-2026-05-01-loanrequest-v1-complete` — commit exato: `git rev-parse lkg-2026-05-01-loanrequest-v1-complete` (inclui registro formal do pacote **`loanRequest` v1** após smoke manual OK). **`loanRequest` v1.1 — pacote nominal completo (RB + CN):** LKG **`lkg-2026-05-03-loanrequest-v1-1`** (smoke manual real OK; ver [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md)). **Marco só Fatia RB v1.1:** LKG **`lkg-2026-05-03-loanrequest-v1-1-rb`** (implementação **`7270409`**). Marco histórico do bloco **ClientView:** `lkg-2026-04-30-clientview-operational-link-block-complete`. Cadeia anterior relevante: `lkg-2026-04-28-link-operational-view` · `28f7936`; pacotes intermediários `lkg-2026-04-29-clientview-operational-link-reading`, `lkg-2026-04-30-clientview-payment-derived-reading`.

**Proxima fase oficial:** [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) — ponte controlada fornecedor/cliente, pre-financeira, sem sync financeiro remoto e sem implementacao nesta etapa documental.

**Contrato funcional loanRequest v1 (Subfase 1 documental concluída):** [`LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`](./plans/completed/LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md).

**Camada técnica remota `loanRequests` (Subfase 2 — rules/modelo):** [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md).

**UI cliente — solicitações (Subfase 3):** Configurações → Conta → “Abrir solicitações” (`LoanRequestsClientPanel.jsx`).

**UI fornecedor — pedidos recebidos (Subfase 4):** Configurações → Conta → “Abrir pedidos recebidos” (`LoanRequestsSupplierPanel.jsx`).

**Pacote `loanRequest` v1 — FECHADO:** smoke manual real com **dois usuários** **OK integral**, **sem NOK crítico**; registro em [`QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md). Tag LKG: **`lkg-2026-05-01-loanrequest-v1-complete`**.

**Pacote `loanRequest` v1.1 (RB + CN) — FECHADO:** smoke manual real **OK integral** (contraproposta, aceite/recusa, guardrails pré-financeiros); registro em [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md). Tags: **`lkg-2026-05-03-loanrequest-v1-1`** (integral) · **`lkg-2026-05-03-loanrequest-v1-1-rb`** (marco só RB).

---

## 1. Visão geral consolidada

O Finanças Pro / AGEmp é uma aplicação web/PWA de empréstimos pessoais com **núcleo financeiro local-first** no navegador e **camada remota separada** para identidade e relacionamento (Firebase).

| Camada | O que persiste | Observação |
|--------|----------------|------------|
| Domínio financeiro local | clientes, contratos, pagamentos, caixa, dashboard, backups, preferências operacionais por escopo | `localStorage` particionado (`anonymous` · `account:{uid}`) |
| Identidade e vínculo remoto | Auth, perfil, `accountRoles`, vínculos fornecedor ↔ cliente | Firestore + regras da camada remota; **não** substitui dados financeiros na nuvem nesta fase |

**Diretriz central (congelada):** não misturar cedo demais o domínio financeiro local com o backend remoto.

---

## 2. Princípios estruturais já consolidados

- Núcleo financeiro permanece **local-first**.
- Domínio financeiro **não** está sincronizado com Firebase nesta fase.
- Identidade remota e vínculo remoto **não** implicam dados financeiros na nuvem.
- `accountRoles` é o shape principal; **role legado** permanece como fallback.
- `activeView` / `accountView` são **contexto de interface**, não modelo de autorização.
- Evolução incremental, reversível e testável.
- `calculations.js` é área crítica: sem mudança sem decisão explícita do projeto.
- `storage.js`, `autoBackup.js`, `storageScope.js`, `ClientView.jsx`, `public/sw.js`: cautela extrema.

---

## 3. Estrutura técnica estabelecida

### 3.1. Base tecnológica

React, Vite, JSX/JavaScript, `localStorage`, PWA (manifest + SW), Vitest, Firebase Auth + Firestore para camada remota de identidade/vínculos; `npm run build` em uso.

### 3.2. Base remota já funcional

Implementado e coberto por fluxos de UI + testes onde existentes:

- Auth **sem** gate global (uso local preservado).
- Perfil remoto em `users/{uid}`, edição de `displayName`, recuperação de senha.
- `accountRoles` com fallback para role legado.
- Conta/perfil compatíveis com fluxo “híbrido”.
- Vínculos fornecedor ↔ cliente no Firestore (`src/firebase/links.js`); fluxos mínimos de solicitação / aprovação / recusa / revogação na camada de conta.
- **Links** exercitados em ambiente real durante a consolidação (conforme promoção a LKGs); dados financeiros continuam locais.

### 3.3. Base local já robusta

- Persistência financeira, backup manual, importação, backup automático.
- Compatibilidade com formatos antigos.
- Escopo **`anonymous`** vs **`account:{uid}`** com reidratação ao trocar sessão.
- Decisão explícita de **legado** no primeiro login (fluxo implementado).
- Preferências de aparelho vs configurações por escopo distinguíveis onde aplicável.

---

## 4. Checklist — entregas já concluídas

### 4.1. Infraestrutura e identidade remota

- Integração Firebase (inicialização segura).
- Auth opcional; uso sem conta preservado.
- Área de conta/perfil na configurações.
- Perfil remoto mínimo; sincronização coerente `displayName` onde definido.
- Recuperação de senha.
- `accountRoles` como shape principal + fallback role legado.
- Camada remota de vínculos fornecedor ↔ cliente + UI mínima na conta.

### 4.2. Persistência local e escopo

- Persistência financeira consolidada.
- Backup / import / auto-backup.
- Compatibilidade com dados legados.
- Separação por escopo e reidratação.
- Decisão explícita de legado no primeiro login.
- Clareza operacional entre identidade remota e dados financeiros locais.

### 4.3. Clareza de contexto e UX estrutural

- Modo sem conta, conta autenticada com dados financeiros vazios no aparelho, separação identidade vs financeiro vs legado.
- Mobile-first e navegação principal por estado (sem React Router).
- Sem redesign amplo; linguagem sem prometer sync financeiro remoto inexistente.

### 4.4. Linha `linkContext` v1 — **cliente** (`client.linkContext`)

Metadado local opcional (`version`, `linkId`, `supplierId`, `clientId`, `associatedAt`); sem impacto em cálculos; sem sync financeiro remoto.

- Primeiro portador do contexto no cadastro local.
- Associação e remoção individuais; leitura no `ClientView`.
- Microcopy clara onde aplicável.
- Filtro por presença de anotação (Todos / Com / Sem).
- Organização/refino por `linkId`; estados vazios e indicadores discretos na lista; contagens operacionais locais derivadas no refinamento (cadastros, contratos, lançamentos de pagamento apenas em contratos anotados — ver `linkOperationalDerive`).
- Criação de cliente com **herança opcional** do vínculo ativo (checkbox explícito, reversível).
- Operações em **lote** (seleção, anotação/remoção com regras conservadoras — não sobrescrever outro vínculo sem critério explícito); seleção efêmera.

### 4.5. Linha `linkContext` v1 — **contrato** (`loan.linkContext`)

- Herança **opcional** na criação do empréstimo a partir do cliente quando aplicável (`loanLinkContextInherit`).
- Filtro visual de contratos: Todos / Com anotação / Sem anotação (`loanLinkContextFilter`).
- Gestão **manual** local da anotação no contrato (adicionar/remover) (`loanLinkContextManage`).
- Contrato pode divergir do cliente (snapshot por empréstimo).

### 4.6. Linha `linkContext` v1 — **pagamento** (somente UI)

- Exibição **derivada** na lista de pagamentos a partir de `loan.linkContext` (`paymentLinkContextDisplay` / uso em `ClientView`).
- **`payment.linkContext` não é persistido**; motor financeiro não consome vínculo.

### 4.7. Trilha `linkContext` — síntese

Fluxo já consolidado no código:

**cliente → contrato (`loan`) → lista de pagamentos (exibição derivada)** + **visão operacional local por `linkId`** no refinamento da lista de clientes + **overlay `ClientView`** com leitura operacional por vínculo (resumo local, estados de vínculo remoto vazio/erro, divergência cliente/contrato e espelho em pagamentos só a partir do contrato).

Sempre como: metadado local opcional, leitura operacional; **sem** alterar `calculations.js`; **sem** sync financeiro remoto deste domínio.

**Status:** bloco `ClientView` de leitura operacional por vínculo **encerrado formalmente** para esta etapa (ver LKG atual no cabeçalho deste checkpoint).

---

## 5. Validado

### 5.1. Validação técnica (automática)

- `npx vitest run` estável nas fases recentes (ex.: **247** testes no fechamento `2026-04-30` do bloco `ClientView` — validar no repo ao retomar).
- `npm run build` após mudanças sensíveis.
- Testes de Firebase, storage/escopo/settings/backup preservados/ampliados.
- Testes adicionais na linha `linkContext`: modelagem, filtros cliente, organização, herança criação cliente, lote, contrato (herança/filtro/gestão), exibição em pagamentos, derivações operacionais por vínculo (`linkOperationalDerive`).

### 5.2. Validação manual

- Fluxos das fases recentes exercitados ao longo do desenvolvimento.
- Promoção sucessiva a **LKGs** ao estabilizar fatias.

### 5.3. Lacuna consciente (não é ausência de QA)

- Existe agora matriz geral mínima em [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md) além da matriz específica de fatia em [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md). A matriz geral ainda depende de execução/atualização quando o time designar ciclos QA manuais formais.
- Ausência de ciclo QA manual executado num dado mês **não** implica ausência de desenvolvimento válido se testes automatizados e validações ad hoc anteriores já existirem — apenas registro operacional por data.

---

## 6. Decisões congeladas que permanecem válidas

- Núcleo financeiro **local-first**.
- Não sincronizar domínio financeiro com Firebase sem desenho e aprovação explícitos.
- Não ligar contratos/pagamentos/caixa/dashboard ao remoto como **domínio financeiro** nesta fase.
- `accountRoles` principal; role legado em fallback.
- `activeView` / `accountView` ≠ permissão.
- `linkContext` v1: local, opcional, reversível, **sem** impacto em cálculo.
- Navegação principal sem redesenho estrutural amplo por capricho.
- Preferir mudanças pequenas, reversíveis e testáveis.
- **`calculations.js` intocado** na linha de evolução já consolidada até o LKG atual (salvo revisão formal do motor).

---

## 7. Fora do escopo atual

- Sync remoto do **domínio financeiro**.
- Persistir **`payment.linkContext`** (snapshot por pagamento) sem decisão/ADR próprios.
- Regras em `calculations.js` baseadas em vínculo sem plano explícito.
- Contratos/pagamentos/caixa/dashboard como **coleções financeiras remotas** autoritativas.
- Dashboard por vínculo remoto ou “dashboard financeiro na nuvem”.
- Múltiplos vínculos por cliente local (salvo produto definir).
- Automations/notificações Firebase atacando dados financeiros locais antes da hora.
- Remoção do role legado sem migração planejada.
- Refatoração ampla do motor financeiro sem necessidade clara.
- IndexedDB como camada financeira obrigatória.
- Service worker cacheando dados financeiros dinâmicos.
- Tratar login como sinônimo de “financeiro na nuvem”.

---

## 8. Estado atual do `linkContext` (por camada)

| Camada | Campo | Papel hoje |
|--------|--------|------------|
| Cliente | `client.linkContext` | Contexto amplo do cadastro local; lista, refinamento, lote, heranças. |
| Contrato | `loan.linkContext` | Snapshot local opcional; pode divergir do cliente; filtro e CRUD manual local da anotação. |
| Pagamento | *(nenhum campo persistido)* | Só repetição visual derivada de `loan.linkContext` na UI. |

**Ainda não faz (implícito):** garantir status remoto em tempo real; reconciliar automaticamente com a nuvem; auditoria imutável por pagamento; substituir histórico financeiro real; alterar motor ou caixa/dashboard por vínculo.

---

## 9. Próxima fase — ponte controlada fornecedor/cliente

### 9.1. Decisão estratégica atual

O ciclo local-first atual foi considerado **praticamente encerrado** pelo gate manual geral. A proxima fase oficial passa a ser a **ponte controlada fornecedor/cliente** descrita em [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md).

Direcao recomendada:

- manter o app atual como produto local-first;
- planejar solicitacoes remotas de emprestimo como camada **pre-financeira** e relacional;
- usar vinculos remotos aprovados como contexto de relacionamento, nao como regra financeira;
- nao iniciar sync financeiro remoto;
- nao criar `payment.linkContext`;
- nao alterar `calculations.js`;
- nao implementar codigo antes de plano/ADR/QA especificos.

### 9.2. Decisão de produto (quando houver demanda; **não** implementação automática)

- Pagamentos permanecem apenas derivados conforme snapshot contrato atual; [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md) define quando reabrir oficialmente cenário próprio campo pagamento antes de novo código relacionado aparecer aceitável segundo governança.
- Solicitacoes remotas futuras permanecem separadas de clientes, contratos, pagamentos, caixa, dashboard e backups locais ate decisao propria de conversao/sync.

### 9.3. Médio prazo (direção, não compromisso de sprint)

- Planejar modelo remoto de solicitacao, status, regras e UX minima antes de qualquer implementacao.
- Definir uma matriz QA executavel para a fase futura, preservando os guardrails ja congelados.

### 9.4. Longo prazo (alinhado à visão do produto / Project Rule)

- Pedidos, filas, contrapropostas, notificações, eventual conversão pedido → contrato, eventual **sync financeiro remoto** — **apenas se e quando** houver desenho aprovado; não tratar como implementado.

---

## 10. Condição de “trilha” satisfatória para a fatia atual

A trilha **`linkContext` v1 no fluxo operacional local** — **cliente → contrato → exibição derivada em pagamento** + **refinamento com contagens locais por vínculo na lista de clientes** + **overlay `ClientView` com leitura operacional por vínculo** — está **consolidada e encerrada formalmente** para esta etapa no LKG referenciado acima, com motor financeiro íntegro, escopos e backups preservados.

Evoluções além disso (snapshot por pagamento, sync remoto financeiro, regras por vínculo) exigem **fases e decisões explícitas**, não continuidade automática da mesma fatia.

---

## 11. Resumo executivo

| Dimensão | Situação |
|----------|----------|
| **Concluído (alto nível)** | Base remota identidade/vínculo; escopo local + legado; clareza de contexto; `linkContext` v1 em cliente, contrato e UI de pagamentos (derivada); visão operacional derivada por vínculo (`linkOperationalDerive` + refinamento em `ClientsList`); **bloco `ClientView`** com resumo operacional, espelho explícito em pagamentos e estados vazio/erro/divergência; **pacotes `loanRequest` v1 e v1.1 (RB+CN pré-financeiro)** **fechados** com smoke manual OK — [`QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md) · [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md); testes e LKGs na linha. |
| **Validado** | Automático recorrente (`vitest`/build); QA manual [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md); fatia vínculo [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md); **`loanRequest` v1 e v1.1** com smoke real **OK integral** (sem NOK crítico), ver matrizes dedicadas; ADR atual [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md). |
| **Congelado** | Local-first financeiro; sem sync financeiro remoto; `calculations.js` na linha preservada; Firebase não como fonte financeira; `payment.linkContext` inexistente exceto revisit via ADR. |
| **Fora do escopo** | Sync financeiro remoto; `payment.linkContext` persistido sem ADR; motor por vínculo sem plano. |
| **Próximo foco** | Ciclo local-first **praticamente encerrado** no gate geral (**F2**/**F5** OK conforme [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md)); **`loanRequest` v1+v1.1 (RB+CN) encerrados** — LKG **`lkg-2026-05-03-loanrequest-v1-1`**. O **próximo recorte** de produto deve ser **definido pelas fontes vivas** ([`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md), [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md), código) — **não** escolhido neste checklist. **Fora de escopo até decisão explícita:** conversão automática pedido→contrato; sync financeiro remoto; persistência `payment.linkContext` sem ADR. Contexto histórico da execução v1 em [`plans/completed/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md`](./plans/completed/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md). |

### Decisão de fechamento local-first

| Dimensão | Decisão |
|----------|---------|
| **Estado do gate final (`QA_MATRIX_GENERAL`)** | **2026-04-30:** execução manual §§ 1–9 com **OK integral** atestado pelo operador; **F2 satisfeito**, **F5 atendido** — ciclo local-first **praticamente encerrado** nesta etapa. **Sem NOK crítico** declarado. Evidência assistida (`vitest`/build) permanece complementar no histórico da matriz. |
| **Recomendação principal** | Considerar **encerrado** o gate de consolidação local-first atual; qualquer evolução futura só com decisão de produto/arquitetura explícita (fora do Caminho 1 neste registro). |
| **Última trilha funcional** | Não recomendada como continuidade local-first; proxima frente e documental/arquitetural para ponte controlada. |
| **Quando abrir correção** | Apenas se a QA manual geral revelar bloqueador real de uso diário. |
| **Riscos aceitos nesta etapa** | Pagamento segue como espelho derivado do contrato; vínculo não é auditoria imutável por pagamento; Firebase não é fonte financeira; regressões futuras exigem novo ciclo de QA conforme matrizes. **Residual `loanRequests`:** alterações em **`firestore.rules`** exigem `npm run test:rules:loanRequests` antes de deploy e consciência do orçamento de avaliação das rules (ramo `loanRequestUpdateValid`); dados anômalos só em produção continuam improváveis — regras tratam “rodada única” por **par commitado** (`loanRequestHasCommittedCounteroffer`). |
| **Guardrails inegociáveis** | Sem sync financeiro; sem `payment.linkContext`; sem regra financeira por vínculo; sem alteração em `calculations.js`; sem dashboard/caixa por vínculo; sem redesign amplo. |

---

## 12. Ordem em caso de conflito entre fontes

1. Código / estado confirmado no repositório  
2. [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md)  
3. Este checkpoint (acompanhamento; pode evoluir entre releases)  
4. Prompt base / subagents  
5. Project Rule como guardrail (sem reimportar “estado atual” desatualizado como verdade factual)  
6. `DESIGN.md` · `BRAND.md` · `PROJECT_OVERRIDES.md` para UI  

---

## 13. Histórico de atualizações do checkpoint

| Data | Nota |
|------|------|
| 2026-04-29 | Pacote inicial de **visão operacional local por vínculo**: `LINK_OPERATIONAL_VIEW.md`, utilitários `linkOperationalDerive`, QA `QA_MATRIX_LINK_OPERATIONAL_VIEW`; refinamento enriquecido na lista de clientes; promoção a LKG `lkg-2026-04-28-link-operational-view` (`28f7936`); `HANDOFF_MASTER.md` alinhado à base estável. |
| 2026-04-29 | **Consolidação pós‑LKG** documental oficial: matriz QA geral [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md) + ADR [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md); `HANDOFF`/checkpoint revisados. |
| 2026-04-30 | Fechamento formal bloco **`ClientView`** (leitura operacional por vínculo); novo LKG `lkg-2026-04-30-clientview-operational-link-block-complete`; matriz QA vínculo estendida §7; `vitest` 247 testes + `npm run build` no fechamento. |
| 2026-04-30 | Decisão Caminho 1 registrada: fase atual deve ser **consolidação/encerramento local-first**, não nova feature; uma correção pontual só se justifica por bloqueador real encontrado na QA manual geral. |
| 2026-04-30 | Gate final assistido: ver [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md) — **F2 pendente**; decisão formal — não declarar encerramento do ciclo local-first sem execução/registro humano mínimo §§ 1–9 ou equivalente governado. |
| 2026-04-30 | Gate final **manual** OK integral: **F2**/**F5** conforme matriz geral; ciclo local-first **praticamente encerrado**; sem NOK crítico declarado pelo operador. |
| 2026-04-30 | Proxima fase oficial registrada em [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md): ponte controlada fornecedor/cliente como camada pre-financeira, sem codigo de produto nesta etapa documental. |
| 2026-04-30 | **`loanRequest` v1:** matriz QA executável [`QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md); polimento leve UI/documentação; recomendação de smoke dois usuários antes de novo LKG da fatia (`HANDOFF_MASTER.md` §9). |
| 2026-05-01 | **`loanRequest` v1 formalmente fechado:** smoke manual real bem-sucedido; LKG **`lkg-2026-05-01-loanrequest-v1-complete`**; base estável principal atualizada no checkpoint e em [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) §4. |
| 2026-05-01 | Organização documental: [`PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md`](./plans/completed/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md) movido para [`plans/completed/`](./plans/completed/) como referência histórica (não plano ativo); ver [`plans/README.md`](./plans/README.md). |
| 2026-05-03 | **Planejamento `loanRequest` v1.1** documentado (`readByClientAt`/`readBySupplierAt` primeiro, contraproposta depois na ordem de execução; pacote nominal v1.1) — contrato histórico [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./plans/completed/LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md) · [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md). |
| 2026-05-03 | **Fatia RB `loanRequest` v1.1** implementada (`readByClientAt`, `readBySupplierAt`; commit **`7270409`**); **`firestore.rules`** publicadas com sucesso no projeto Firebase **`agemp-financas-pro`**; smoke manual humano OK, sem NOK crítico informado; LKG **`lkg-2026-05-03-loanrequest-v1-1-rb`**. |
| 2026-05-03 | **Pacote nominal `loanRequest` v1.1 completo (RB + CN)** validado no app real — contraproposta, aceite, recusa; sem contrato/caixa/sync financeiro; commits de referência registrados em [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md) (incl. **`4e8dcae`**); LKG **`lkg-2026-05-03-loanrequest-v1-1`**. |
| 2026-05-03 | **Melhorias pós-v1.1 em `loanRequest` (UX/robustez/estado local):** **`584d5b4`** (badge “Novo” só para novidade legítima entre cliente/fornecedor); **`62bacf2`** (`console.warn` se falhar `markLoanRequestRead*`); **`cd8db7e`** (limpar drafts ao recolher/concluir no painel fornecedor). Sem alteração de `firestore.rules`, `calculations.js`, schema, transições, sync financeiro nem contrato automático — § dedicada em [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md); contexto técnico em [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md). |

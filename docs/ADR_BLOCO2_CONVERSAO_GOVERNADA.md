# ADR — Bloco 2: Conversão Governada de LoanRequest aprovado em Contrato Local

**Tipo:** Architectural Decision Record + plano executável futuro  
**Projeto:** AGEmp / Finanças Pro  
**Escopo:** Bloco 2 — pré-financeiro remoto (`loanRequests`) → contrato financeiro **local**, só após confirmação humana explícita

---

## 1. Status

| Dimensão | Valor |
|----------|--------|
| **Estado da decisão** | **Proposto** — aguardando **aprovação de governança** antes de qualquer implementação de código |
| **Natureza deste documento** | ADR **e** plano executável (uma única fonte viva para o Bloco 2 até promover matriz QA específica, se aplicável) |
| **Implementação do produto** | **Bloco 2 não está implementado** — apenas este artefacto documental (**Bloco2-0**) está previsto nesta rodada |
| **Base de elaboração** | Planeamento Cursor `adr-bloco2-conversao-governada_13970c4c.plan.md` + guardrails do projeto + código/documentação existentes |

---

## 2. Estado atual confirmado

### 2.1 Fatos já consolidados no repositório e nos docs vivos

- **`loanRequest` v1 e v1.1** estão **fechados** (smoke manual, QA dedicadas; LKG **`lkg-2026-05-03-loanrequest-v1-1`**). Detalhe: [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md), [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md).
- **Bloco 1** (`loanRequests` operacional) está **funcionalmente fechado** (Opção A); plano arquivado: [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) — **histórico**, não plano ativo.
- **`loanRequests`** é camada **pré-financeira** somente; **pedido `approved` não cria contrato local nem remoto automaticamente**.
- **Domínio financeiro** continua **local-first** (`localStorage`, escopo `anonymous` / `account:{uid}`).
- **Firebase não é fonte financeira autoritativa**: não há sync financeiro remoto autoritativo de clientes, contratos, pagamentos, caixa ou dashboard.
- **`payment.linkContext`** não é persistido (ADR atual: [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md)).
- **`calculations.js`** é motor único e neste MVP da conversão **não deve ser alterado** pela especificação do Bloco 2.

### 2.2 Lacuna de produto (motivação)

Um **`LoanRequest` `approved`** **corretamente** não aparece no Painel nem nos dados financeiros locais porque só existe como **intenção relacional/remota**. Falta uma **ponte governada**: registar no livro **local** o contrato **depois** de o utilizador confirmar que a **transferência real** já ocorreu no mundo físico/bancário (fora do app).

---

## 3. Decisão arquitetural recomendada

### 3.1 Princípios

1. **Conversão manual**, iniciada pelo **fornecedor** no MVP (quem mantém o cadastro local de empréstimos neste modelo).
2. **Fluxo guiado**: revisão explícita **antes** de qualquer persistência financeira local.
3. **Confirmação humana obrigatória** com formulário inequívoco (checkbox ou equivalente): *«A transferência real já foi feita?»*
4. **Nenhum efeito financeiro** (novo contrato no modelo local → reflexo em caixa/Painel/Total na Rua) **antes** da **confirmação final** neste fluxo.
5. **Sem marcação remota no MVP** — não novo campo Firestore, não mudança a **`firestore.rules`**, não dependência de escrita remota para a conversão.
6. **Anti-duplicidade local mínima** obrigatória: antes de criar contrato, verificar que **`convertedFromLoanRequestId`** (ou nome equivalente acordado) **ainda não** existe em nenhum `loan` no escopo.
7. **Sem alteração a `calculations.js`** e **`firestore.rules`** no MVP do Bloco 2.
8. O contrato criado deve ser **indistinguível** do ponto de vista do motor face a um contrato criado pelo fluxo manual existente (mesmo shape de dados permitido pelo `storage`/normalização).

### 3.2 Resumo da decisão

**Adoptar** conversão governada **100% local** após confirmação humana, com **referência ao id do pedido remoto** só como **metadado local opcional** no contrato (`convertedFromLoanRequestId`), **herança explícita** de **`loan.linkContext` v1** quando o pedido trouxer `linkId`, `supplierId` e `clientId`, e **alerta não bloqueante** quando `availableMoney` local for inferior ao montante — **sem bloquear** a conversão no MVP.

---

## 4. Escopo do MVP

### 4.1 Entra (após aprovação do ADR e execução subfase a subfase)

- Botão futuro **«Registrar contrato local»** (ou equivalente) apenas para **`LoanRequest`** com **`status === 'approved'`** (inclui aprovação directa e aprovação após aceite de contraproposta — ambos terminam em `approved` com `approvedAmount` definido; ver [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md)).
- **Tela/modal de revisão** com campos essenciais (valor, datas sugeridas, taxa, cliente, notas legíveis do pedido conforme UX).
- **Confirmação humana obrigatória** da transferência real + microcopy de que **o app não transfere dinheiro** e **não valida conta bancária**.
- **Criação de contrato local** apenas após essa confirmação, reutilizando o pipeline de atualização de `clients` já existente (`onUpdateClients` / persistência por escopo).
- **Reuso ou criação** de cliente local; **sem escolha automática** quando houver **múltiplos candidatos** plausíveis (ver §5).
- Campo local **`convertedFromLoanRequestId`** (string = id do documento Firestore do pedido) para **anti-duplicidade** e rastreabilidade operacional local.
- **`loan.linkContext` v1** no contrato criado quando `linkId`, `supplierId` e `clientId` estiverem presentes no pedido — **não** implica `payment.linkContext`.
- Reflexo em **Painel**, **Clientes**, **Total na Rua**, **caixa** e restante ciclo **via fluxo local já existente** (novo `loan` no cliente).

### 4.2 Fica fora do MVP

- Marcação remota (`converted_to_contract` ou campos equivalentes), **qualquer** escrita Firestore motivada pela conversão.
- Conversão iniciada pelo **cliente** ou UI espelhada no cliente para «gerar contrato».
- Conversão **automática** ou **em lote**.
- **Sync financeiro remoto** autoritativo.
- **`payment.linkContext`** persistido.
- Alterações a **`calculations.js`** para «ajustar» valores pelo pedido remoto.
- Alterações a **`firestore.rules`** / schema Firestore.
- Reabertura **A2b/A2c** como dependência do Bloco 2.

---

## 5. Decisões ajustadas (ressalvas obrigatórias)

### 5.1 Taxa de juros

- **Pré-preencher** com `settings.defaultInterestRate` (ou fallback já usado no app para novo contrato).
- **Permitir edição na revisão** **desde que** o comportamento seja **coerente** com o fluxo manual atual de criação de contrato no `ClientView` (campos editáveis de taxa já existem no formulário manual).  
- **Pendência explícita:** antes do primeiro commit de código da **Bloco2-B/C**, confirmar no código o contrato exacto de validação (mínimos, máximos, mensagens) para não divergir do manual.

### 5.2 Cliente local

- Preferir **nome remoto fiável** quando disponível (ex.: `displayName` do utilizador cliente), com **fallback** textual do tipo **«Cliente [prefixo do clientId]»** ou equivalente definido na implementação.
- **Recomendar** campo de **edição do nome na revisão** antes de criar cliente novo (ou antes de confirmar associação).
- Se existirem **vários clientes locais** candidatos (ex.: mesmo `linkId` em `client.linkContext`), **não escolher automaticamente**: obrigar **selecção explícita** pelo fornecedor.

### 5.3 Anti-duplicidade

- A verificação por **`convertedFromLoanRequestId`** é **mínimo obrigatório** e deve executar-se **imediatamente antes** de qualquer mutação que adicione o contrato — **Bloco2-C não pode persistir contrato sem esta checagem**.
- **Bloco2-D** pode reforçar UX (rótulo «Já registado localmente», desactivação de botão, mensagens).

### 5.4 `loan.linkContext`

- Se o pedido contiver **`linkId`**, **`supplierId`** e **`clientId`**, o contrato criado deve receber **`loan.linkContext` v1** como **snapshot local** explícito (formato alinhado a [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) / utilitários existentes).  
- **Não** criar nem persistir **`payment.linkContext`**.

### 5.5 `availableMoney`

- **Alerta informativo, não bloqueante**, quando o montante a registar exceder o **`availableMoney`** já calculado pelo app (mesma grandeza que no Painel), espelhando a filosofia do **Bloco 1 / B2**.  
- **Não bloquear** a conversão no MVP por este motivo — decisão consciente de produto; o utilizador confirma após ver o aviso.

### 5.6 Marcação remota

- **Fora do MVP.** Backlog: eventual campo/`status` remoto exigiria **ADR complementar**, **rules**, **`FIRESTORE_LOANREQUESTS.md`**, **`npm run test:rules:loanRequests`** e QA próprios.

---

## 6. Fluxo conceitual

```text
LoanRequest approved (remoto, pré-financeiro)
  → Fornecedor: botão «Registrar contrato local»
  → Revisão (valor, taxa editável, data, cliente, linkContext implícito se dados completos)
  → Alerta opcional se availableMoney < montante (não bloqueante)
  → Confirmação obrigatória: «A transferência real já foi feita?»
  → Anti-duplicidade local (convertedFromLoanRequestId)
  → Criação/atualização cliente local + novo loan local
  → Reflexo: Clientes, Painel, Total na Rua, caixa (motor existente)
```

**Diagrama (referência):**

```mermaid
flowchart TD
  approved["LoanRequest approved"]
  btn["Botão Registrar contrato local"]
  review["Revisão + alertas não bloqueantes"]
  confirm["Confirmação transferência real"]
  dup["Checagem anti-duplicidade local"]
  create["Persistir contrato local"]
  reflect["Painel / Clientes / caixa"]

  approved --> btn --> review --> confirm --> dup --> create --> reflect
```

---

## 7. Modelagem local proposta (alvo de implementação)

| Aspecto | Especificação |
|---------|----------------|
| **Identificação da proveniência** | `convertedFromLoanRequestId`: string (id Firestore do `loanRequests/{id}`) |
| **Valor principal** | `approvedAmount / 100` em **reais** (inteiro Firestore em centavos → modelo local já em reais no fluxo atual de formulários) |
| **Data do contrato** | Decisão pendente **D6** (sugerido na lista §9): «data de hoje» vs «data da resposta remota» — **aprovar antes do código** |
| **`interestRate`** | Número (percentagem), pré-preenchido + editável na revisão, consistente com manual |
| **`payments`** | `[]` na criação |
| **`linkContext`** | Objeto v1 opcional no `loan`, obrigatório na prática quando `linkId` + `supplierId` + `clientId` existirem no pedido |
| **Remoto** | **Sem escrita** no MVP |

**Compatibilidade:** novos campos devem ser **opcionais** para dados antigos e percorrêveis pela normalização em [`storage.js`](../src/utils/storage.js) (sem especificar aqui alterações — apenas critério de compatibilidade).

---

## 8. Subfases futuras (execução sequencial)

Ordem obrigatória após aprovação deste ADR: **Bloco2-0 → A → B → C → D → E**. Nenhuma subfase posterior deve marcarse como concluída neste documento até evidência em código/QA.

### Bloco2-0 — ADR / plano vivo documental

| Campo | Conteúdo |
|-------|-----------|
| **Objetivo** | Formalizar decisões e plano executável; **este ficheiro**. |
| **Escopo** | Documentação em `docs/`; atualização de referências nos docs vivos. |
| **Fora do escopo** | `src/`, rules, testes, Firestore. |
| **Arquivos prováveis** | `docs/ADR_BLOCO2_CONVERSAO_GOVERNADA.md`; ponteiros em `HANDOFF_MASTER`, `CHECKPOINT`, etc. |
| **Riscos** | Baixo (só doc). |
| **Critérios de aceite** | ADR publicado; governança notificada; próximo passo = Bloco2-A **após** explícito «implementação autorizada». |
| **QA/smoke** | Revisão lectora cruzada com roadmap/handoff. |
| **Sugestão de commit** | `docs(adr): Bloco 2 — ADR conversão governada LoanRequest → contrato local` |

### Bloco2-A — Elegibilidade e entrada do fluxo (sem criar contrato)

| Campo | Conteúdo |
|-------|-----------|
| **Objetivo** | Detectar pedidos `approved` elegíveis e expor entrada de UX (botão ou estado desactivado com mensagem). |
| **Escopo** | UI/leitura de dados já carregados; eventual helper só-leitura de «já convertido localmente». |
| **Fora do escopo** | Persistência de novo contrato; modal completo de revisão final. |
| **Arquivos prováveis** | `LoanRequestsSupplierPanel.jsx`, encadeamento `AccountScreen` / `Settings` / `App` conforme necessidade de dados. |
| **Riscos** | Poluição visual na lista — mitigar com padrões [`DESIGN.md`](../DESIGN.md), [`PROJECT_OVERRIDES.md`](../PROJECT_OVERRIDES.md). |
| **Critérios de aceite** | Botão só em `approved`; não regressões nos fluxos Bloco 1; testes automáticos se introduzirem util puro. |
| **QA/smoke** | Mobile/light/dark; pedidos não-approved sem botão. |
| **Sugestão de commit** | `feat(loan-requests): entrada UX para conversão governada (Bloco2-A)` |

### Bloco2-B — Modal / tela de revisão e confirmação (sem persistir contrato)

| Campo | Conteúdo |
|-------|-----------|
| **Objetivo** | Ecrã de revisão, edições permitidas, checkbox confirmação transferência, aviso «app não transfere». |
| **Escopo** | Estado local de UI; validações de formulário; **sem** `onUpdateClients` que adicione loan final **nesta subfase** (opcional: persistência pode ficar só em Bloco2-C por segurança). |
| **Fora do escopo** | Escrita definitiva do contrato (delegada explicitamente a Bloco2-C se separação estrita). |
| **Arquivos prováveis** | Novo componente de revisão (nome a definir na implementação), integração no painel fornecedor. |
| **Riscos** | UX longa no mobile — manter modal focado ([`PROJECT_OVERRIDES.md`](../PROJECT_OVERRIDES.md) — modais curtos). |
| **Critérios de aceite** | Confirmar sem checkbox → impedido; cancelar → sem alterações financeiras. |
| **QA/smoke** | Acessibilidade básica; cópias claras. |
| **Sugestão de commit** | `feat(convert-loan-request): revisão e confirmação humana (Bloco2-B)` |

### Bloco2-C — Conversão local obrigatória com anti-duplicidade + cliente

| Campo | Conteúdo |
|-------|-----------|
| **Objetivo** | Executar mutação local: anti-duplicidade **primeiro**, depois cliente + loan com `convertedFromLoanRequestId` e `linkContext` quando aplicável. |
| **Escopo** | Funções dedicadas (nome a definir), integração com `onUpdateClients`, mensagens de erro/sucesso. |
| **Fora do escopo** | Firestore write; alteração `calculations.js`. |
| **Arquivos prováveis** | Util novo + componentes tocados em §Bloco2-B/A; possível `storage` apenas se normalização formal exigir (avaliar no PR). |
| **Riscos** | Duplicidade após backup/import — documentar comportamento esperado (checagem no momento da operação). |
| **Critérios de aceite** | Segunda conversão do mesmo id → bloqueada com mensagem clara; contrato visível no `ClientView`; números do Painel coerentes. |
| **QA/smoke** | Fluxo completo com dois utilizadores de teste; regressão criação manual de contrato. |
| **Sugestão de commit** | `feat(convert-loan-request): persistência local conversão governada (Bloco2-C)` |

### Bloco2-D — Refinamento anti-duplicidade e UX

| Campo | Conteúdo |
|-------|-----------|
| **Objetivo** | Indicadores permanentes «já registado», copys finos, estados de botão desactivados. |
| **Escopo** | UI apenas ou pequenos util sem mexer no motor. |
| **Fora do escopo** | Nova política financeira; marcação remota. |
| **Arquivos prováveis** | Painel fornecedor, eventual ícone/texto auxiliar. |
| **Riscos** | Falso positivo «convertido» se corrupção local — aceite MVP como limite. |
| **Critérios de aceite** | Lista consistente após refresh de página/reabração painel. |
| **QA/smoke** | Reabrir painel após conversão; modo offline/local-only da conta. |
| **Sugestão de commit** | `fix(loan-requests): UX anti-duplicidade conversão local (Bloco2-D)` |

### Bloco2-E — Smoke manual, QA, docs vivos

| Campo | Conteúdo |
|-------|-----------|
| **Objetivo** | Fecho formal da fatia: matriz QA (nova § ou doc), atualização handoff/checkpoint/LKG quando política do projeto mandar. |
| **Escopo** | Documentação; registo de smoke; **sem** expandir escopo funcional. |
| **Fora do escopo** | Deploy rules não solicitado pelo MVP. |
| **Arquivos prováveis** | `QA_MATRIX_*`, `HANDOFF_MASTER`, `CHECKPOINT`, roadmap. |
| **Riscos** | Documentação desfasada do código — alinhar com commits finais. |
| **Critérios de aceite** | Lista de verificação executada sem NOK crítico acordado. |
| **QA/smoke** | Painel, Clientes, Contratos, Caixa, backup/restauração, regressão geral mínima. |
| **Sugestão de commit** | `docs(qa): Bloco 2 — registos QA/smoke e docs vivos` |

---

## 9. Decisões pendentes (aprovação humana antes do código)

| ID | Tema | Recomendação registada neste ADR |
|----|------|-----------------------------------|
| **D1** | Marcação remota no MVP | **Não** |
| **D2** | MVP apenas fornecedor | **Sim** |
| **D3** | Cliente converte no MVP | **Não** |
| **D4** | Nome do cliente local | Nome remoto fiável + fallback + edição na revisão; sem escolha automática multi-candidato |
| **D5** | Taxa de juros | Pré-preenchimento + **edição** na revisão; validação final **igual ao manual** (confirmar no código antes do PR) |
| **D6** | Data do contrato | **Pendente**: «hoje» vs data derivada do pedido — decidir antes da implementação Bloco2-C |
| **D7** | `availableMoney` inferior ao montante | **Alertar e permitir** conversão (MVP) |
| **D8** | Onde vive o modal | **AccountScreen** / ramo Conta (coerente com painéis existentes) |
| **D9** | Ordem de execução | **Sequencial** A→B→C→D→E |
| **D10** | Documento único | Este **ADR** como fonte única até derivar matriz QA |

---

## 10. QA e riscos

### 10.1 Testes unitários (futuros)

- Conversão **centavos → reais**; montagem de **`loan.linkContext`**; função de **anti-duplicidade**; selecção de cliente (casos 0 / 1 / N candidatos).

### 10.2 Smoke manual obrigatório (pós-implementação)

- Conversão feliz `approved` → contrato visível.
- Bloqueio de duplicidade do mesmo `loanRequestId`.
- Regressão: **criação manual** de contrato inalterada.
- **Painel**, **Clientes**, **Contratos**, **Caixa**, **backup/export/import**.
- **Mobile** e **dark**.
- Garantir cópias que **não** prometem sync financeiro remoto nem validação bancária.

### 10.3 Riscos principais

| Risco | Mitigação |
|-------|-----------|
| Utilizador confunde pedido remoto com dinheiro já «no app» | Confirmação + microcopy recorrente |
| Duplicidade entre dispositivos | Aceite MVP; backlog marcação remota |
| Divergência taxa/data vs expectativa | Revisão explícita + D5/D6 |
| Regressão em `storage`/backup | PR dedicado com testes `storage` se tocar normalização |

---

## 11. Guardrails (inegociáveis)

- **Não** criar contrato **automaticamente** por evento remoto.
- **Não** alterar **`calculations.js`** no MVP do Bloco 2 sem nova ADR/decisão explícita.
- **Não** alterar **`firestore.rules`** nem schema remoto no MVP.
- **Não** iniciar **sync financeiro remoto** autoritativo.
- **Não** criar **`payment.linkContext`**.
- **Firebase não é fonte financeira autoritativa** — o app **regista** operação que o utilizador declara já realizada **fora** do app.
- **`docs/plans/completed/`** permanece **histórico**; **A2b/A2c** não são reabertos como parte deste Bloco 2.

---

## 12. Relação com outros documentos

| Documento | Papel |
|-----------|--------|
| [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) | Estado consolidado do projeto |
| [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md) | Acompanhamento operacional |
| [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) | Fase oficial ponte pré-financeira |
| [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md) | Roadmap A–F; Bloco 2 alinha à **Fase F** |
| [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) | Modelo remoto atual |
| [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md) | Pagamento só espelho derivado |
| [`DESIGN.md`](../DESIGN.md), [`BRAND.md`](../BRAND.md), [`PROJECT_OVERRIDES.md`](../PROJECT_OVERRIDES.md) | UX/UI |

---

## 13. Próxima acção após aprovação de governança

1. Marcar internamente **«implementação Bloco 2 autorizada»**.  
2. Iniciar **Bloco2-A** (único incremento por prompt / PR recomendado).  
3. Não promover LKG nem declarar Bloco 2 fechado até **Bloco2-E**.

---

## Histórico deste ADR

| Data | Nota |
|------|------|
| 2026-05-04 | **Bloco2-0:** criação do ADR + plano executável em `docs/ADR_BLOCO2_CONVERSAO_GOVERNADA.md`; implementação **não** iniciada. |

# HANDOFF MASTER — AGEmp / Finanças Pro

## Status do documento

Este documento é o handoff master oficial do projeto AGEmp / Finanças Pro.

Seu papel é consolidar:

- o estado real atual do projeto;
- as decisões arquiteturais já congeladas;
- as fases já concluídas e validadas;
- os limites de escopo que devem ser preservados;
- a base estável atual;
- a direção segura para continuidade.

Este documento deve ser tratado como uma das fontes principais de continuidade do projeto, sempre em conjunto com:

- código real do repositório;
- prompt base permanente do projeto;
- prompts base dos subagents;
- Project Rule;
- `DESIGN.md`;
- `BRAND.md`;
- `PROJECT_OVERRIDES.md`.

---

## 1. Visão geral do projeto

O Finanças Pro / AGEmp é um app web/PWA de controle de empréstimos pessoais com arquitetura **local-first** no domínio financeiro, e com uma **camada remota separada** para identidade e vínculos.

### Separação estrutural atual

#### Domínio financeiro local

Persistido localmente por escopo, incluindo:

- clientes;
- contratos / empréstimos;
- pagamentos;
- caixa;
- dashboard;
- backups;
- configurações operacionais.

#### Camada remota de identidade e relacionamento

Persistida no Firebase, incluindo:

- autenticação;
- perfil remoto;
- `accountRoles`;
- compatibilidade com role legado;
- vínculos fornecedor ↔ cliente;
- regras da camada remota.

#### Regra central preservada

A diretriz central do projeto continua sendo:

**não misturar cedo demais o domínio financeiro local com o backend remoto.**

---

## 2. Estado real atual do sistema

### Estrutura geral confirmada

- app em React + Vite;
- estado principal em `App.jsx`;
- navegação baseada em estado local, sem React Router;
- telas principais:
  - `dashboard`
  - `clients`
  - `settings`
- overlay operacional em `ClientView.jsx`.

### Persistência local

- dados financeiros persistem em `localStorage`;
- armazenamento separado por escopo:
  - `anonymous`
  - `account:{uid}`
- fluxo de legado implementado com decisão explícita no primeiro login;
- backup manual, importação e backup automático já existem e funcionam.

### Camada remota

- Firebase Auth funcionando;
- perfil remoto funcionando;
- `accountRoles` funcionando com fallback para role;
- vínculos fornecedor/cliente funcionando no Firestore;
- o domínio financeiro **não** é salvo remotamente nesta fase.

### Estado atual do vínculo local

- `client.linkContext` existe e é o primeiro portador do contexto;
- `loan.linkContext` existe como snapshot local opcional do contrato;
- pagamentos **não** persistem `payment.linkContext`;
- na lista de pagamentos, o vínculo é apenas exibido de forma **derivada** do contrato.

### O que ainda não foi aberto

- sync remoto do domínio financeiro;
- multiusuário financeiro real;
- `payment.linkContext` persistido;
- regras financeiras baseadas em vínculo.

---

## 3. Fases já concluídas e validadas

### 3.1. Infra / conta / dados

- escopo `anonymous` vs `account:{uid}` com migração de chaves legadas;
- clareza de contexto local;
- `accountRoles` com fallback para papel legado.

### 3.2. Cliente — `client.linkContext`

- associação opcional com vínculos aprovados na plataforma;
- filtro e visibilidade na lista;
- organização por `linkId`;
- criação de cliente com herança opcional sob refinamento;
- anotação/remoção em lote.

### 3.3. Contrato — `loan.linkContext`

- herança opcional na criação do empréstimo;
- filtro visual Todos / Com anotação / Sem anotação;
- gestão manual de adicionar/remover anotação no contrato.

### 3.4. Pagamento — consumo visual

- exibição discreta na lista de pagamentos derivada de `loan.linkContext`;
- sem persistir `payment.linkContext`.

### 3.5. ClientView — leitura operacional local por vínculo (overlay)

Bloco **formalmente encerrado** na linha documentada pelo LKG `lkg-2026-04-30-clientview-operational-link-block-complete` (ver §4).

Inclui, sem alterar `calculations.js` nem persistir `payment.linkContext`:

- card opcional de vínculo com linguagem **local-only** (sem prometer sync financeiro remoto);
- **resumo operacional local** agregando contratos vs `client.linkContext` via [`clientLoanLinkContextSummary.js`](../src/utils/clientLoanLinkContextSummary.js) (contagens coerentes; mensagens para ausência total de anotação, só cliente anotado, só contratos anotados e **divergência** cliente/contrato como organização local);
- lista remota de vínculos (`listUserLinks`) quando logado: **carregando**, **erro** (`role="alert"`), **vazio** sem vínculos aprovados e fluxo de **anotar/remover** no cliente;
- por contrato: rótulo da relação vínculo cliente/contrato, linha formatada, divergência explícita e atalho para anotar contrato com o vínculo atual do cliente quando aplicável;
- por pagamento: **espelho** apenas de `loan.linkContext` via [`paymentLinkContextDisplay.js`](../src/utils/paymentLinkContextDisplay.js), com copy explícito de derivação;
- filtros de contratos **Com/Sem anotação** com lista vazia tratada na UX.

### Síntese da trilha recente

A trilha de `linkContext` já foi consolidada em:

**cliente → contrato → exibição derivada no pagamento** + **overlay `ClientView`** com leitura operacional por vínculo + contagens operacionais locais por `linkId` no refinamento da lista de clientes — sempre sem novo campo persistente em pagamento nem alteração em `calculations.js`

sempre como:

- metadado local opcional;
- leitura operacional;
- sem alterar o motor financeiro.

---

## 4. LKGs recentes e base estável atual

### LKGs recentes relevantes

- `lkg-2026-04-22-storage-scope`
- `lkg-2026-04-22-accountRoles`
- `lkg-2026-04-25-local-link-context`
- `lkg-2026-04-25-linkcontext-clients-visibility`
- `lkg-2026-04-25-local-vinculo-organize`
- `lkg-2026-04-25-client-create-inherit-link`
- `lkg-2026-04-25-batch-linkcontext-list`
- `lkg-2026-04-26-loan-linkcontext-inherit`
- `lkg-2026-04-26-loan-linkcontext-consumption`
- `lkg-2026-04-27-loan-linkcontext-manual`
- `lkg-2026-04-27-payment-linkcontext-display` (antecessor imediato; commit `e0de30c`)
- `lkg-2026-04-28-link-operational-view` (visão operacional na lista de clientes; commit `28f7936`)
- `lkg-2026-04-29-clientview-operational-link-reading` (leitura operacional de contratos no `ClientView`)
- `lkg-2026-04-30-clientview-payment-derived-reading` (espelho explícito em pagamentos)
- **`lkg-2026-04-30-clientview-operational-link-block-complete`** ← base estável principal atual (fechamento documental + código do bloco `ClientView`).

### Base estável principal atual

A base estável principal recomendada neste momento é:

- **`lkg-2026-04-30-clientview-operational-link-block-complete`**
- **commit:** o mesmo apontado pela tag (`git rev-parse lkg-2026-04-30-clientview-operational-link-block-complete`).

### Proxima fase oficial documentada

A proxima fase oficial esta definida em [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md):

- ponte controlada fornecedor/cliente;
- camada remota **pre-financeira** de solicitacoes;
- sem sync financeiro remoto;
- sem `payment.linkContext`;
- sem alteracao em `calculations.js`;
- sem implementacao automatica nesta etapa documental.

### Até onde a trilha já foi consolidada

A trilha consolidada atual vai:

- da associação local no cliente;
- até a visibilidade do vínculo na lista de pagamentos (derivada do contrato);
- até **visão operacional derivada por vínculo** no refinamento da lista de clientes (contagens locais por `linkId` em [`linkOperationalDerive.js`](../src/utils/linkOperationalDerive.js)); ver [`LINK_OPERATIONAL_VIEW.md`](./LINK_OPERATIONAL_VIEW.md);
- até o **overlay `ClientView`**: resumo operacional, lista remota com estados vazio/erro, divergência cliente/contrato e espelho em pagamentos conforme [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md);
- sempre sem sync financeiro remoto;
- e sem `payment.linkContext` persistido.

---

## 5. Decisões congeladas

As decisões abaixo seguem aprovadas e devem ser preservadas:

- o domínio financeiro continua **local-first**;
- o escopo local continua separado entre:
  - `anonymous`
  - `account:{uid}`
- `accountRoles` é a fonte efetiva principal;
- role legado continua como fallback;
- `linkContext` v1 é um formato local com:
  - `version`
  - `linkId`
  - `supplierId`
  - `clientId`
  - `associatedAt`
- `linkContext` v1 é:
  - opcional
  - reversível
  - sem impacto em cálculos
- não há sync financeiro remoto nestas fases;
- `calculations.js` permanece intocado nesta linha de evolução;
- contratos/pagamentos/caixa/dashboard ainda não são domínio financeiro remoto;
- a navegação principal segue sem React Router.

---

## 6. O que já foi validado

### Validação automática

- `npx vitest run` vem passando de forma recorrente nas fases recentes;
- `npm run build` vem passando após mudanças sensíveis.

### Validação manual

Existe validação manual prática recorrente ao longo das fases recentes e promoção sucessiva de LKGs.

### Observação importante

Existe uma **matriz QA manual geral mínima**: [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md) — cobre ponta‑a‑ponta do produto; serve como registro regressivo oficial complementar aos testes automatizados e ao checklist específico da fatia vínculo abaixo.

Já existe, para a fatia de **visão operacional por vínculo**, o checklist específico em [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md) — atualizado com §7 (`ClientView`) e referência ao LKG de fechamento do bloco; esse documento específico **não deve ser confundido** com a cobertura geral.

Critérios de saída e entrada formal da governança pós-consolidação estão declarados dentro de **`QA_MATRIX_GENERAL.md`**.

A decisão arquitetural atual sobre **`payment.linkContext`** não persistido está em [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md).


A partir deste documento há template explícito de regressão manual geral; preencher tabela quando houver ciclo QA formal decidido segundo critérios S1‑S4 de [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md).

---

## 7. O que continua fora do escopo

Continuam fora do escopo atual:

- sync financeiro remoto;
- `payment.linkContext` persistido;
- qualquer regra financeira baseada em vínculo;
- alterações em `calculations.js` sem plano específico;
- redesign amplo;
- filtros globais de pagamento por vínculo;
- automações/notificações Firebase para o domínio financeiro.

---

## 8. Estado atual do `linkContext`

### Modelagem v1

`linkContext` v1 é um objeto local com:

- `version`
- `linkId`
- `supplierId`
- `clientId`
- `associatedAt`

### Uso por camada

#### Cliente — `client.linkContext`

- primeiro portador do contexto;
- usado na lista, refinamento, lote e heranças;
- onde implementado (`linkOperationalDerive`), contagens operacionais locais derivadas por `linkId` no refinamento da lista (sem novo campo persistido em pagamento).

#### Contrato — `loan.linkContext`

- snapshot local opcional;
- usado para herança, filtro visual e gestão manual local.

#### Pagamento — não existe campo persistido

- só há exibição derivada de `loan.linkContext` via UI.

### O que o vínculo local ainda não faz

- não garante status remoto;
- não reconcilia automaticamente com a nuvem;
- não gera auditoria imutável por pagamento;
- não substitui histórico se o contrato mudar depois.

### Diferença conceitual importante

- **`client.linkContext`** = contexto amplo/atual do cadastro local  
- **`loan.linkContext`** = snapshot local do contrato  
- **pagamento** = apenas repetição visual do contexto do contrato, sem vínculo próprio persistido  

---

## 9. Decisão estratégica atual — proxima fase oficial

O **Caminho 1** foi encerrado praticamente pelo gate manual geral. A decisão estratégica atual passa a ser abrir, em documentação e planejamento, a **ponte controlada fornecedor/cliente** descrita em [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md).

Essa nova fase permanece dentro do produto atual e preserva o financeiro local-first. Ela prepara a visão futura por meio de uma camada remota **pre-financeira** de solicitações entre cliente e fornecedor, sem transformar Firebase em fonte financeira.

### Fechamento do Caminho 1

- A base atual foi considerada madura o suficiente para encerramento prático do ciclo local-first após o gate em [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md).
- Não há recomendação para abrir nova trilha funcional local-first por inércia.
- Uma nova trilha local só deve ser aberta se a QA manual geral revelar bloqueador real de uso diário, e ainda assim como correção pontual/cirúrgica.
- A matriz específica [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md) permanece como complemento de regressão para vínculo.

### Critério de decisão

- Se a QA manual geral não registrar bloqueador crítico, o ciclo local-first pode ser tratado como **praticamente encerrado**.
- Se houver NOK crítico, corrigir apenas o bloqueador identificado, preservando os guardrails congelados deste documento.
- Não iniciar feature nova antes de registrar formalmente a decisão de encerramento ou o bloqueador que justifica correção.

### Estado do gate final (registro mais recente)

Execução **manual humana** **2026-04-30** registrada em [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md): operador atesta **OK integral** nos casos **1.1–9.1** (§§ 1–9), **sem NOK crítico**. Critério **F2** do gate (**[`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md)**) está **satisfeito**; **F5** permite considerar o ciclo local-first **praticamente encerrado** nesta etapa, preservando guardrails congelados (sem sync financeiro remoto, sem `payment.linkContext`, sem mudança em `calculations.js` nesta linha).

*(Registro anterior do ciclo assistido **2026-04-30** permanece no histórico da matriz como evidência complementar de automação; não substitui **F2**.)*

### Decisão de produto futura relevante

**Estado atual documentado oficialmente**: [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md) — só espelho visual derivado do contrato; sem `payment.linkContext` persistido.

Se no futuro o produto exigir responder à pergunta abaixo de forma nova, será preciso atualizar primeiro a própria ADR e só então discutir código/migração:

**Pagamentos devem eventualmente ter snapshot próprio (`payment.linkContext`) ou permanecem apenas como espelho visual derivado permanente só do contrato?**

Qualquer código futuro relacionado só após esse passo oficial de revisão decidida conscientemente pela governança (nunca automática só por aparecer novo chat).

### Recorte oficial da proxima fase

A proxima fase oficial:

- planeja solicitacoes remotas de emprestimo como **intencao relacional pre-financeira**;
- usa vinculos remotos aprovados apenas como contexto relacional;
- nao cria contrato local ou remoto automaticamente;
- nao grava clientes, contratos, pagamentos, caixa ou dashboard no Firestore;
- exige novo plano aprovado antes de qualquer implementacao.

---

## 10. Riscos e cuidados para continuidade

- não confundir UI local com estado remoto;
- não persistir `payment.linkContext` sem ADR e regra clara de divergência;
- preservar compatibilidade com backups e dados antigos;
- manter `ClientView` legível, sem excesso de densidade;
- tratar `calculations.js` como motor financeiro único e sensível.

---

## 11. Arquivos e áreas sensíveis

### `src/utils/calculations.js`

Motor único do cálculo financeiro.

Mudanças aqui afetam:

- dashboard
- caixa agregado
- pendências
- totais

### `src/utils/storage.js`

Afeta:

- migração
- persistência
- backup/import

### `src/utils/autoBackup.js`

Afeta segurança dos dados locais.

### `src/utils/storageScope.js`

Afeta partição:

- conta
- anônimo
- legado

### `src/components/ClientView.jsx`

Maior superfície de UX e fluxos financeiros do projeto.

### `src/utils/linkOperationalDerive.js`

Deriva apenas leitura operacional/local por vínculo; não substitui o motor nem o storage financeiro central.

### `src/utils/clientLoanLinkContextSummary.js`

Agrega leitura operacional local **no `ClientView`** (contratos vs `client.linkContext`); não altera valores financeiros.

### `src/utils/paymentLinkContextDisplay.js`

Somente leitura para UI de pagamentos a partir de `loan.linkContext`; **não** persiste `payment.linkContext`.

### `public/sw.js`

Deve continuar sem cache agressivo de dados financeiros dinâmicos.

---

## 12. Como este handoff deve ser usado

Este documento deve ser usado como **handoff master permanente** do projeto.

### Regra de uso

Em novos chats ou novas fases, ele deve ser lido em conjunto com:

- código real do repositório;
- prompt base permanente do projeto;
- prompts base dos subagents;
- Project Rule como guardrail;
- `DESIGN.md`, `BRAND.md` e `PROJECT_OVERRIDES.md` para UX/UI.

### Em caso de conflito

Priorizar **nesta ordem**:

1. código real / estado confirmado;
2. este handoff master;
3. prompt base permanente;
4. prompts base dos subagents;
5. Project Rule como guardrail;
6. `DESIGN.md`, `BRAND.md` e `PROJECT_OVERRIDES.md` para UX/UI.

### Regra de atualização

Este handoff deve ser atualizado sempre que:

- uma nova fase relevante for concluída;
- houver novo LKG estável;
- alguma decisão congelada mudar;
- a trilha de `linkContext` avançar para nova camada do domínio financeiro.

---

## 13. Observação operacional final

Este documento substitui o handoff master anterior como referência principal de continuidade, mantendo os anteriores apenas como histórico.

Ele **não** substitui:

- o código real;
- o checkpoint/checklist geral;
- o prompt base permanente;
- nem os prompts base dos subagents.

Ele funciona como:

- referência principal de estado consolidado;
- mapa de continuidade;
- base de transição segura entre chats;
- registro da linha arquitetural já validada.

---

### Histórico de atualizações

| Data | Nota |
|------|------|
| 2026-04-28 | Substituição do conteúdo pelo handoff master oficial (seção Status + ordem de fontes + seções 1–13 revisadas). |
| 2026-04-29 | Base estável atual: LKG `lkg-2026-04-28-link-operational-view` · commit `28f7936`; trilha e QA parcial atualizados (visão operacional local por vínculo). |
| 2026-04-29 | Consolidação pós‑LKG documental oficial: nova matriz geral QA mínima + ADR campo pagamento só derivado conforme atual; atualizado §6/handoff relacionados. |
| 2026-04-30 | Fechamento formal do bloco **ClientView** — leitura operacional local por vínculo (resumo, contratos, pagamentos derivados, estados vazio/erro, divergência); novo LKG `lkg-2026-04-30-clientview-operational-link-block-complete`; base estável atualizada no §4. |
| 2026-04-30 | Decisão estratégica Caminho 1: próxima fase deve ser **consolidação/encerramento local-first**, não nova feature; gate final passa pela QA manual geral e correções apenas se houver bloqueador real. |
| 2026-04-30 | Gate final assistido (ver [`QA_MATRIX_GENERAL.md`](./QA_MATRIX_GENERAL.md)): **F2 pendente** — §§ 1–9 da matriz geral sem execução humana completa neste ciclo; não declarar encerramento do ciclo local-first só com evidência automatizada. |
| 2026-04-30 | Gate final **manual**: operador atesta **OK integral** §§ 1–9 (**1.1–9.1**); **F2 satisfeito** · **F5** — ciclo local-first **praticamente encerrado** (sem NOK crítico declarado). |
| 2026-04-30 | Proxima fase oficial documentada em [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md): ponte controlada fornecedor/cliente, pre-financeira, sem sync financeiro remoto e sem implementacao nesta etapa documental. |

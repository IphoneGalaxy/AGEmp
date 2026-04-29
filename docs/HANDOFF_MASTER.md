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

### Síntese da trilha recente

A trilha de `linkContext` já foi consolidada em:

**cliente → contrato → exibição derivada no pagamento** (mais contagens operacionais locais derivadas por `linkId` no refinamento da lista de clientes, sem novo campo persistente nem alteração em `calculations.js`)

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
- **`lkg-2026-04-28-link-operational-view`** ← base estável principal atual.

### Base estável principal atual

A base estável principal recomendada neste momento é:

- **`lkg-2026-04-28-link-operational-view`**
- **commit:** `28f7936`

### Até onde a trilha já foi consolidada

A trilha consolidada atual vai:

- da associação local no cliente;
- até a visibilidade do vínculo na lista de pagamentos;
- e, a partir da base atual, até **visão operacional derivada por vínculo** no refinamento da lista de clientes (contagens locais por `linkId` em [`linkOperationalDerive.js`](../src/utils/linkOperationalDerive.js)); ver [`LINK_OPERATIONAL_VIEW.md`](./LINK_OPERATIONAL_VIEW.md);
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

O que **não** está formalizado de forma única neste momento é uma **matriz QA manual única** cobrindo **todo** o produto ponta a ponta.

Já existe, para a fatia de **visão operacional por vínculo**, o checklist específico em [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md), alinhado ao LKG base atual — isso não substitui uma matriz geral quando for definida.

Isso **não** significa ausência de validação prática, apenas ausência de registro formal único abrangendo tudo.

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

## 9. Próximo passo natural recomendado

O próximo passo natural **não** deve ser assumido automaticamente como implementação imediata.

### Caminho mais conservador e correto

- consolidar QA guiado (incluída a fatia de vínculo em [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md)); quando útil, unificar numa futura **matriz geral única** cobrindo também:
  - cliente
  - contrato
  - pagamento
  - backup/import
  - dois escopos locais
- só depois decidir a próxima fatia real de produto

### Decisão de produto futura relevante

A próxima grande decisão de produto, quando chegar a hora, será responder:

**pagamentos precisam snapshot próprio no futuro ou continuam apenas como espelho visual do contrato?**

Essa pergunta não deve virar implementação automática agora.

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

# ADR/Plano — Visão Fornecedores + Governança de vínculo/local

**Tipo:** Architectural Decision Record + plano executável  
**Projeto:** AGEmp / Finanças Pro  
**Escopo:** UX relacional do lado cliente + governança local explícita de clientes/contratos convertidos, preservando o financeiro local-first.

**Estado da fase (Pacotes 1–3):** **funcionalmente fechada** — fecho documental em **§16**. Commits de referência: **`0be3e0b`** (ADR/plano inicial) · **`c921d8d`** (conta-cliente: visão Fornecedores e nomes remotos) · **`a6c2d8c`** (local: registry de conversões e arquivamento de cliente).

---

## 1. Estado atual confirmado

- O domínio financeiro continua **local-first**, persistido em `localStorage` por escopo (`anonymous` e `account:{uid}`).
- Firebase continua como camada **remota relacional e pré-financeira**: Auth, perfil remoto, `accountRoles`, vínculos e `loanRequests`.
- **Bloco 2** está fechado: fornecedor pode registrar contrato **local** a partir de `loanRequest.approved`, com confirmação humana, sem contrato remoto e sem sync financeiro remoto.
- A mini ADR de snapshots de nomes também está fechada: nomes amigáveis já aparecem em vínculos, pedidos e conversão local quando o snapshot existe.
- O cliente possui **visão Fornecedores** na Conta com pedidos **agrupados por fornecedor**, CTA **Solicitar novo valor** e fallback de nome **snapshot → `displayName` remoto → «Fornecedor da plataforma»**; **UID** permanece informação opcional em detalhe (**Pacote 1** — **`c921d8d`**).
- Vínculos legados sem `supplierDisplayNameSnapshot` podem ainda cair no rótulo genérico quando o remoto não estiver disponível; refinamento futuro permanece em backlog (roadmap/handoff).
- **Governança local (Pacote 2 — `a6c2d8c`):** existe **registry local** de conversões (histórico separado do cadastro), **aviso de reconversão** com confirmação extra, **arquivar cliente** com `archivedAt`, lista de **arquivados**, **restaurar**, e **excluir cliente local** com confirmação forte — sempre sem apagar vínculo/pedido remotos.
- A anti-duplicidade da conversão continua ancorada no contrato local com `convertedFromLoanRequestId`; o **registry** reduz a sensação de pedido “totalmente novo” após exclusão local de contrato/cliente, sem alterar regras remotas.

## 2. Problemas de produto

*(Diagnóstico que motivou o ADR; mitigações principais nos Pacotes **1–2** — ver **§1** e **§16**.)*

- O cliente não tem uma superfície clara para acompanhar a relação com cada fornecedor aprovado.
- A leitura atual mistura pedaços de informação entre vínculos, pedidos e cadastro financeiro local.
- Vínculos legados sem snapshot de nome do fornecedor ficam genéricos demais.
- A exclusão local de cliente/contrato é tecnicamente coerente com o modelo local-first, mas a UX ainda não explica bem:
  - o que continua remoto;
  - o que era apenas local;
  - o que já foi convertido antes neste aparelho.
- Hoje falta explicitar melhor a separação entre:
  - **cliente local**;
  - **contrato local**;
  - **vínculo remoto**;
  - **pedido pré-financeiro remoto**.

## 3. Decisão arquitetural recomendada

- Abrir a próxima fase como **“Visão Fornecedores + Governança de vínculo/local”**.
- Tratar essa fase em **três pacotes oficiais**:
  1. **Pacote 1:** **Bloco A + Bloco B mínimo**
  2. **Pacote 2:** **Bloco D + parte segura do Bloco C**
  3. **Pacote 3:** **QA/docs finais**
- Manter a fronteira conceitual explícita:
  - **Fornecedor na plataforma** = conta remota / vínculo remoto
  - **Pedido na plataforma** = intenção pré-financeira remota
  - **Cliente neste aparelho** = cadastro financeiro local
  - **Contrato neste aparelho** = contrato financeiro local
- Para governança local:
  - **arquivar cliente local** passa a ser a ação principal/recomendada;
  - **excluir cliente local** continua existindo como ação destrutiva local, mas com confirmação forte;
  - **registro de conversão** fica em **registry local separado**, exclusivo para conversões já realizadas;
  - **registry de conversão não se mistura** com arquivamento de cliente.

## 4. Fora do escopo

- Alterar `firestore.rules` nesta fase inicial.
- Revogação remota de vínculo.
- Sync financeiro remoto.
- Contrato remoto.
- `payment.linkContext`.
- Alterações em `calculations.js`.
- Renomeação automática em massa de clientes locais já existentes.
- Qualquer ação local que apague/edite automaticamente a conta da contraparte.

## 5. Bloco A — escopo, arquivos prováveis, critérios de aceite, riscos

### Escopo

- Melhorar o card **“Fornecedores com vínculo aprovado”**.
- Ordem recomendada para nome do fornecedor em vínculo legado:
  1. `supplierDisplayNameSnapshot`
  2. `displayName` remoto do perfil, se disponível ou carregável com segurança
  3. `Fornecedor da plataforma`
- Esconder UID técnico como informação principal.
- Ajustar copy para deixar claro que se trata de **vínculo aprovado na plataforma**, e não de contrato financeiro.

### Arquivos prováveis

- `src/components/LoanRequestsClientPanel.jsx`
- `src/components/AccountScreen.jsx`
- `src/utils/displayNameSnapshots.js`
- `src/utils/platformFriendlyLabels.js`
- `src/firebase/users.js`

### Critérios de aceite

- Vínculo legado sem `supplierDisplayNameSnapshot` mostra nome remoto quando houver leitura segura do perfil.
- O nome amigável vira a informação principal do card.
- O UID técnico deixa de ser o elemento principal da interface.
- A copy reforça que o vínculo é relacional/plataforma, sem sugerir saldo, contrato ou sync financeiro.

### Riscos

- Multiplicar leituras de perfil remoto e degradar UX se não houver estratégia clara de carregamento.
- Criar drift entre derivadores de nome para vínculo e derivadores de nome para pedido.
- Reintroduzir UID como fallback “visível demais”.

## 6. Bloco B — escopo, arquivos prováveis, critérios de aceite, riscos

### Escopo

- Criar a **Visão Fornecedores** do lado cliente.
- Preferência arquitetural: nova subview em `Conta`, sem reestruturar a navegação principal.
- O **mínimo do Pacote 1** deve entregar:
  - lista de fornecedores vinculados/aprovados;
  - agrupamento de pedidos enviados por fornecedor;
  - status visíveis por pedido:
    - `pending`
    - `under_review`
    - `counteroffer`
    - `approved`
    - `rejected`
    - `cancelled_by_client`
    - `counteroffer_declined`
  - valores pré-financeiros combinados;
  - CTA **“Solicitar novo valor”** no contexto do fornecedor correto;
  - copy explícita de que isso **não** substitui cliente/contrato/pagamento local.

### Arquivos prováveis

- `src/components/AccountScreen.jsx`
- `src/components/LoanRequestsClientPanel.jsx`
- novo componente provável:
  - `src/components/ClientSuppliersPanel.jsx`
  - ou `src/components/SuppliersClientView.jsx`
- novos utils de agrupamento/derivação em `src/utils/`
- `src/firebase/loanRequestsFirestore.js`
- `src/firebase/links.js`

### Critérios de aceite

- O cliente abre uma visão dedicada para acompanhar fornecedores.
- Cada fornecedor exibe seus pedidos agrupados de forma legível.
- O botão **“Solicitar novo valor”** parte do fornecedor correto e continua respeitando a regra de um pedido aberto por vínculo.
- A UI reforça que tudo ali é **pré-financeiro** e não substitui o financeiro local.

### Riscos

- Duplicação de lógica já existente no painel atual de pedidos enviados.
- Crescimento excessivo de `AccountScreen.jsx` se não houver extração em componente dedicado.
- Confusão entre “fornecedor remoto” e “cliente local” se a separação semântica não estiver bem escrita.

## 7. Bloco C — escopo, arquivos prováveis, critérios de aceite, riscos

### Escopo

- Formalizar três ações distintas na governança local:
  - **Arquivar cliente local**
  - **Excluir cliente local**
  - **Desfazer vínculo remoto** (apenas como ação separada e futura, fora deste pacote)
- **Decisão recomendada já aprovada para esta fase:**
  - usar **`archivedAt` no próprio objeto local do cliente**;
  - **arquivar** passa a ser a ação principal/recomendada;
  - **excluir** permanece como ação destrutiva local com confirmação forte.
- A **parte segura do Bloco C**, que entra no **Pacote 2**, é:
  - nova copy de exclusão local;
  - recomendação explícita de arquivar em vez de excluir;
  - modelagem local com `archivedAt`;
  - filtros/listagens mínimos para não perder o cliente arquivado.
- Fica fora deste pacote qualquer ação remota sobre vínculo.

### Arquivos prováveis

- `src/components/ClientView.jsx`
- `src/components/ClientsList.jsx`
- `src/utils/storage.js`
- `src/utils/storageScope.js`
- `src/utils/settings.js`

### Critérios de aceite

- O usuário entende que **arquivar** é a ação segura/recomendada.
- Excluir cliente local deixa claro que:
  - apaga apenas neste aparelho;
  - não apaga vínculo remoto;
  - não apaga pedido remoto;
  - não afeta a conta da contraparte.
- Clientes arquivados deixam de poluir a lista principal, mas permanecem recuperáveis localmente.

### Riscos

- Introduzir `archivedAt` no shape local exige revisão de filtros, persistência, backup/import e estados vazios.
- Misturar arquivamento local de cliente com backlog remoto A2b/A2c de arquivamento por lado em `loanRequests`.
- Tornar o fluxo de exclusão mais complexo sem melhorar clareza real.

## 8. Bloco D — escopo, arquivos prováveis, critérios de aceite, riscos

### Escopo

- Criar um **registry local separado** para conversões já realizadas, por exemplo `convertedLoanRequestsLocalRegistry`.
- Esse registry deve existir **fora** do array `clients` e **fora** do arquivamento de cliente.
- Objetivo:
  - lembrar que um `loanRequest` já foi convertido antes neste aparelho;
  - evitar que o pedido aprovado pareça “nunca convertido” depois de o cliente/contrato local ser apagado.
- Conteúdo mínimo sugerido do registry:
  - `loanRequestId`
  - `convertedAt`
  - `supplierId`
  - `clientId`
  - referência local opcional ao cliente/contrato criados na ocasião
- UX recomendada:
  - aviso: **“Este pedido já foi registrado localmente antes, mas o contrato foi apagado deste aparelho.”**
  - reconversão só com confirmação extra, se permitida

### Arquivos prováveis

- `src/utils/convertLoanRequestToLocalContract.js`
- `src/components/ConvertLoanRequestToContractReview.jsx`
- `src/components/LoanRequestsSupplierPanel.jsx`
- novo util de registry local em `src/utils/`
- `src/utils/storageScope.js`
- possível persistência leve dedicada em `src/utils/storage.js` ou módulo específico

### Critérios de aceite

- Pedido aprovado já convertido antes não parece “novo” só porque o contrato foi apagado.
- O fornecedor recebe aviso claro quando há histórico local anterior de conversão.
- Reconversão, se existir, exige confirmação adicional.

### Riscos

- Criar inconsistência entre registry e contratos reais se o desenho de derivação/limpeza não for claro.
- Confundir “registro histórico local” com dado financeiro autoritativo.
- Tornar o modal de conversão excessivamente complexo.

## 9. Ordem recomendada para implementar mais rápido

1. **Pacote 1:** **Bloco A + Bloco B mínimo**
2. **Pacote 2:** **Bloco D + parte segura do Bloco C**
3. **Pacote 3:** **QA/docs finais**

## 10. O que pode ser implementado junto

- **Bloco A + Bloco B mínimo**: compartilham leitura de vínculo/pedido e derivação de nomes.
- **Bloco D + parte segura do Bloco C**: compartilham governança local, copy de exclusão e histórico local separado.
- Ajustes pequenos de copy/labels podem ser feitos em conjunto entre A e B.

## 11. O que NÃO deve ser implementado junto

- `firestore.rules` nesta fase inicial.
- Revogação remota de vínculo.
- Arquivamento remoto por lado (`A2b/A2c`).
- Sync financeiro remoto.
- Contrato remoto.
- `payment.linkContext`.
- Alterações em `calculations.js`.
- Marcação remota `converted_to_contract`.

## 12. Testes necessários

- Testes unitários para derivação de nome em vínculo legado.
- Testes unitários para agrupamento de pedidos por fornecedor.
- Testes unitários para o registry local de conversões.
- Regressão da conversão governada (`convertLoanRequestToLocalContract` + modal).
- Regressão do painel cliente de pedidos / nova visão por fornecedor.
- Se `archivedAt` entrar no cliente local:
  - testes de persistência;
  - normalização;
  - compatibilidade com backup/import.
- Ao fim da fase:
  - `npx vitest run`
  - `npm run build`
- `npm run test:rules:loanRequests` apenas se houver pacote posterior específico que toque rules.

## 13. Smoke manual

Checklist histórico de planejamento; o fecho operacional da fase e o smoke **sugerido/necessário** após Pacote 3 estão consolidados em **§16.4**.

## 14. Decisões fechadas nesta fase (registro)

- **Fallback de nome do fornecedor (cliente):** **snapshot → perfil remoto (`displayName`) → «Fornecedor da plataforma»**; UID só em detalhe opcional.
- **Superfície «Fornecedores»:** visão dedicada na Conta com agrupamento por fornecedor e CTA **Solicitar novo valor** alinhada ao fornecedor correto.
- **Reconversão:** permitida com **confirmação extra** quando aplicável; registry local preserva memória de conversão sem tocar Firestore.
- **Excluir cliente local:** mantida como ação destrutiva com **confirmação forte**; remoto intacto.
- **Arquivar cliente local:** `archivedAt` + lista separada + restaurar — distinto do arquivamento **remoto** planejado em **A2b/A2c** (ainda backlog).

Refinamentos futuros (pré-carregamento agressivo de perfis, posição da ação **Excluir** na UI, backup/export do registry) permanecem **backlog** — **§16.6**.

## 15. Próxima ação recomendada

- **Pacotes 1–3:** **concluídos**. Manter este ADR como referência da fase entregue; detalhes de fecho, smoke e backlog em **§16**.
- **Continuidade:** priorizar próximos recortes apenas a partir de [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md), [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md), [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) e [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md) — **sem** inferir nova funcionalidade a partir deste arquivo sozinho.

## 16. Fechamento da fase (Pacote 3 — QA/docs)

### 16.1 Fase funcionalmente fechada

A fase **«Visão Fornecedores + Governança de vínculo/local»** está **fechada** nos entregáveis dos Pacotes **1** a **3** (incluindo este fecho documental). **Commits:** **`0be3e0b`** · **`c921d8d`** · **`a6c2d8c`**.

### 16.2 Pacote 1 entregue

- Visão **Fornecedores** do cliente.
- Pedidos **agrupados por fornecedor**.
- CTA **Solicitar novo valor**.
- Fallback de nome: **snapshot → `displayName` remoto → «Fornecedor da plataforma»**.
- **UID** em detalhe **opcional**.

### 16.3 Pacote 2 entregue

- **Registry local** de conversões.
- **Aviso de reconversão** (fluxo com confirmação adicional).
- **Arquivar cliente local** com **`archivedAt`**.
- **Lista de arquivados** e **restaurar** cliente arquivado.
- **Excluir cliente local** com **confirmação forte**.

### 16.4 Smoke manual sugerido / necessário

1. Cliente abre **Fornecedores** na Conta.
2. Pedidos aparecem **agrupados** por fornecedor.
3. **Solicitar novo valor** encaminha no contexto do fornecedor correto.
4. **Arquivar** cliente remove da lista principal e mantém entrada **recuperável** na lista de arquivados.
5. **Restaurar** cliente volta à lista principal.
6. **Excluir** cliente dispara **confirmação forte** e preserva vínculo/pedido remotos (mensagem coerente com o modelo).
7. Apagar contrato/cliente local **não** faz o pedido parecer totalmente novo sem contexto — **registry** / aviso de reconversão coerentes.
8. **Reconversão** exige **confirmação extra**.

### 16.5 Guardrails preservados (confirmados)

- **Sem** sync financeiro remoto.
- **Sem** contrato remoto autoritativo.
- **Sem** `payment.linkContext`.
- **Sem** alterações em **`calculations.js`** nesta fase.
- **Sem** alterações em **`firestore.rules`** nesta fase.
- **Sem** revogação remota de vínculo (produto continua sem “desfazer vínculo” remoto neste recorte).

### 16.6 Backlog explícito (pós-fase)

- **Revogação / desfazer vínculo remoto:** continua **fora** deste escopo.
- **A2b / A2c** (`loanRequests`, arquivamento **por lado** no Firestore + UI): continuam **backlog** — **não** confundir com arquivamento **local** do cliente nesta fase.
- **Backup / export** do registry local: refinamento futuro **se** necessário após uso real.
- **Melhoria visual / extração de componentes:** opcional se a manutenção pedir.

**Nota — `FIRESTORE_LOANREQUESTS`:** esta fase **não** alterou modelo, campos nem **Security Rules** da coleção `loanRequests`; evoluções remotas continuam disciplinadas por [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) e roadmap **A2b/A2c** quando priorizado.

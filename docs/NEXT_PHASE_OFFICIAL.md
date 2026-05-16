# Proxima fase oficial — ponte controlada fornecedor/cliente

## Status

Documento de decisao e planejamento da proxima fase oficial apos o encerramento pratico do ciclo local-first atual.

Esta fase e **documental e preparatoria**. Ela nao implementa telas, colecoes, regras Firebase, fluxo funcional novo, sincronizacao financeira remota, `payment.linkContext` nem mudancas em `calculations.js`.

## 1. Contexto confirmado

O estado atual confirmado do projeto e:

- o nucleo financeiro segue local-first, salvo em `localStorage` por escopo (`anonymous` e `account:{uid}`);
- Auth, perfil remoto, `accountRoles` e vinculos remotos ja existem na camada Firebase;
- `client.linkContext` existe como metadado local opcional;
- `loan.linkContext` existe como snapshot local opcional do contrato;
- pagamento nao persiste `payment.linkContext`;
- a exibicao de vinculo em pagamento e apenas derivada de `loan.linkContext`;
- a trilha operacional local por vinculo no fluxo do cliente foi encerrada;
- o gate manual geral registrou OK integral sem NOK critico;
- `calculations.js` permanece fora da linha de alteracao de vinculos;
- o dominio financeiro nao esta sincronizado com Firebase;
- a camada **`loanRequests`** existe no codigo (**v1** e **v1.1** com RB+CN conforme [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md)) como solicitacao **somente pre-financeira** na nuvem — **sem** conversão **automática** remota para contrato; a conversão para contrato **local** existe apenas como fluxo **manual** **Bloco 2** (fornecedor + confirmação humana — [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md)); **sem** sync financeiro remoto declarado aqui.
- evolucoes futuras **documentadas** sobre a mesma coleção (ordenacao A1–F) encontram-se no roadmap vivo [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md) — **planejamento** complementar; **`docs/plans/completed/`** continua **somente** referencia historica (nao plano ativo).
- **Bloco 1 (`loanRequests`) — funcionalmente fechado (Opção A, 2026-05-04):** entregues **A1a, A1b, A2a, B1, B2** (commits incl. **`dcc9f80`**, **`4951bdf`**, **`07ef7e5`**); plano executável **arquivado** em [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) — **referência histórica**, **não** plano ativo. **A2b/A2c** (arquivamento técnico + UI) **não** implementadas — **backlog**; **não** bloqueiam o encerramento funcional do Bloco 1.
- **Bloco 2 (`loanRequests` → contrato local — conversão governada):** **implementado e funcionalmente fechado** (2026-05-04): commits **`624c725`**, **`3badcbc`**, **`5dd4c36`**; uso de **`clientDisplayNameSnapshot`** na conversão/modal (**`28f3f4a`**) conforme mini ADR fechada; ADR [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md); smoke/QA [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md) § Bloco 2 + § mini ADR. **Sem** alteração de modelo remoto para tornar Firebase fonte financeira; **sem** sync financeiro remoto; **sem** `payment.linkContext`; **sem** alteração **`calculations.js`** nesta linha; Firebase permanece **identidade / vínculo / pedido pré-financeiro**, não fonte financeira autoritativa.
- **Mini ADR «Identidade pública e snapshots de nomes»:** **funcionalmente fechada** — [`ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md`](./ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md) §17; commits **`6793461`** · **`eb48083`** · **`cdc55d9`** · **`9d2c4ad`** · **`9f4351f`** · **`bb03633`** · **`28f3f4a`**; **rules** deploy **`agemp-financas-pro`** após **`cdc55d9`**. **«Visão Fornecedores + Governança de vínculo/local»:** **funcionalmente fechada** (Pacotes **1–3**) — [`ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md`](./ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md) §16; commits **`0be3e0b`** · **`c921d8d`** · **`a6c2d8c`**. Guardrails da ADR preservados (**sem** sync financeiro remoto; **sem** contrato remoto; **sem** `payment.linkContext`; **sem** alteração **`calculations.js`** / **`firestore.rules`** nesta fase; **sem** revogação remota de vínculo). Backlog §16.6 no mesmo ADR. **Bloco 2** não alterou o facto de **`loanRequests`** ser só pré-financeiro na nuvem; a conversão é **100% local** após confirmação humana (**o app não transfere dinheiro**).

## 2. Decisao da proxima fase

A proxima fase oficial deve iniciar uma **ponte controlada para a visao futura fornecedor/cliente**, ainda dentro do produto atual e preservando o financeiro local-first.

Essa ponte deve tratar futuras solicitacoes remotas de emprestimo como uma camada **pre-financeira e relacional**, separada de clientes, contratos, pagamentos, caixa, dashboard, backups e calculos locais.

Nao e uma nova trilha funcional local-first por inercia, e tambem nao e inicio de sync financeiro remoto.

## 2.1 Proxima fase recomendada do produto (atualizado — pós-Bloco 2, 2026-05-04)

**Bloco 2** (**[`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md)**) está **fechado** nos commits **`624c725`**, **`3badcbc`**, **`5dd4c36`** — conversão **manual** `approved` → contrato **local**; confirmação de transferência real; anti-duplicidade **`convertedFromLoanRequestId`**; **`loan.linkContext`** opcional; **sem** marcação remota; **sem** alteração a **`firestore.rules`** / modelo **`loanRequests`** pelo MVP Bloco 2; **sem** **`calculations.js`** / **`payment.linkContext`** / sync financeiro remoto.

**«Visão Fornecedores + Governança de vínculo/local»** (**[`ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md`](./ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md)**) está **fechada** nos Pacotes **1–3**: implementação **`c921d8d`** (conta-cliente / UX Fornecedores) · **`a6c2d8c`** (registry + arquivamento local) · ADR inicial **`0be3e0b`**; fecho QA/docs **§16** (esta leva de docs). **Sem** mudança a **`firestore.rules`** nem ao modelo **`loanRequests`** nesta fase. Smoke §16.4 na ADR · espelho em [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md).

**Mini ADR [`ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md`](./ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md)** — **fechada** (commits **`6793461`** … **`28f3f4a`**; deploy **`agemp-financas-pro`** pós-**`cdc55d9`**).

**Próximo recorte de produto** não está fixado neste arquivo — candidatos em backlog ([`ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md`](./ADR_VISAO_FORNECEDORES_GOVERNANCA_VINCULO_LOCAL.md) §16.6; [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md)): revogação remota de vínculo; **A2b/A2c**; refinamentos registry (backup/export) e UI. **Linha ortogonal (`loanRequests`):** [`ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md`](./ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md) — **`clientDebtLedger`** (**dados locais neste aparelho**, **sem sincronização financeira remota**); Subfases **A–D3** **concluídas** (**`5fc8a58`** … **`eedbd2e`**, smoke **D3** OK **2026-05-17** — ADR §20); Firebase **não** é fonte financeira autoritativa do ledger; **`pedido aprovado` não cria dívida local automaticamente**; **`calculations.js`**, **`firestore.rules`**, Firebase SDK e **`payment.linkContext`** intocados nesta linha — ver ADR §13–§20 e backlog §18.

*(O parágrafo abaixo refere-se à decisão documental original da ponte pré-financeira; permanece válido como contexto — o produto já inclui `loanRequests` v1+v1.1 e conversão governada local.)*

| Campo | Decisao |
|-------|---------|
| Status | Aceita como direcao oficial da proxima fase de planejamento. |
| Contexto | O ciclo local-first atual foi praticamente encerrado; a camada remota existente cobre identidade e vinculos, nao financeiro. |
| Decisao | Planejar uma camada remota de solicitacoes de emprestimo como intencao relacional pre-financeira. |
| Consequencia | O app pode evoluir para a visao fornecedor/cliente sem transformar o backend em fonte financeira nesta etapa. |
| Nao decisao | Nao ha conversao automatica de solicitacao em contrato local ou remoto nesta fase. |

## 4. Guardrails obrigatorios

- Nao sincronizar clientes, contratos, pagamentos, caixa, dashboard ou backups com Firebase.
- Nao criar `payment.linkContext`.
- Nao alterar `calculations.js`.
- Nao usar vinculo remoto como regra financeira obrigatoria.
- Nao criar dashboard financeiro remoto ou por vinculo.
- Nao converter solicitacao aprovada em contrato sem fase propria.
- Nao remover compatibilidade com role legado sem migracao explicita.
- Nao sugerir na UX que login ou vinculo significam financeiro na nuvem.
- Nao cachear dados financeiros dinamicos no service worker.

## 5. Modelo conceitual futuro de solicitacao

Esta secao descreve o shape-alvo para discussao futura. Ela nao cria implementacao.

### Entidade conceitual

`loanRequest`

### Campos planejados

- `supplierId`: UID da conta fornecedora.
- `clientId`: UID da conta cliente.
- `linkId`: identificador do vinculo remoto aprovado que autoriza a relacao de solicitacao.
- `requestedAmount`: valor solicitado pelo cliente.
- `clientNote`: observacao opcional do cliente.
- `status`: estado atual da solicitacao.
- `approvedAmount`: valor aprovado quando aplicavel.
- `counterofferAmount`: valor de contraproposta quando aplicavel.
- `supplierNote`: observacao opcional do fornecedor.
- `createdAt`, `updatedAt`, `respondedAt`, `cancelledAt`: timestamps planejados conforme status.
- `readByClientAt`, `readBySupplierAt`: leitura/notificacao planejada, sem FCM nesta primeira decisao.

### Status planejados

- `pending`
- `under_review`
- `approved`
- `counteroffer`
- `rejected`
- `cancelled_by_client`
- `converted_to_contract`

`converted_to_contract` deve permanecer apenas como status planejado ate existir decisao propria sobre conversao. Nesta fase, ele nao implica criar contrato financeiro local ou remoto.

## 6. Fluxo de produto planejado

Fluxo recomendado para a fonte documental original da ponte; **estado 2026-05-04:** passos **1–5** vivos em **`loanRequests` v1.1**; passo **6** existe apenas como **conversão manual local (Bloco 2)** — não automática nem remota ([`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md)).

1. Cliente autenticado com papel Cliente e vinculo aprovado escolhe um fornecedor vinculado.
2. Cliente registra intencao de pedido com valor e nota.
3. Fornecedor autenticado com papel Fornecedor visualiza fila relacional de pedidos.
4. Fornecedor pode aprovar, recusar ou propor contraproposta.
5. Cliente acompanha resposta.
6. **Bloco 2:** eventual registo no financeiro **local** do fornecedor — só por acção **manual** no app após **`approved`**, revisão e confirmação humana; **sem** criar contrato automaticamente por evento remoto e **sem** financeiro autoritativo na nuvem.

## 7. UX minima planejada

A UX futura deve ser pequena, clara e mobile-first:

- area de solicitacoes dentro de Conta ou uma superficie dedicada somente se o volume justificar;
- linguagem explicita de que solicitacoes sao relacionamento/plataforma, nao extrato financeiro sincronizado;
- estados visuais simples:
  - amarelo/ambar para pendente;
  - azul para em analise;
  - verde para aprovado;
  - vermelho para recusado;
  - laranja para contraproposta;
- nenhuma informacao financeira local deve aparecer para a outra parte por causa do pedido;
- a tela deve priorizar valor solicitado, status e acao principal, sem competir com o fluxo financeiro local atual.

## 8. Criterios de entrada para implementacao futura

Antes de qualquer codigo desta proxima fase, todos os itens abaixo devem estar verdadeiros:

| ID | Criterio |
|----|----------|
| E1 | Este documento foi aceito como recorte oficial da fase. |
| E2 | O time decidiu se a primeira fatia sera apenas solicitacao simples ou tambem resposta do fornecedor. |
| E3 | Firestore rules e modelo remoto foram desenhados em plano antes de codar. |
| E4 | Matriz QA especifica da fase foi criada ou este documento foi promovido para matriz executavel. |
| E5 | Guardrails contra sync financeiro remoto, `payment.linkContext` e `calculations.js` foram reafirmados no handoff/checkpoint. |

## 9. Criterios de saida da fase documental

Esta fase documental esta completa quando:

- o recorte de ponte controlada esta registrado;
- a separacao entre relacional remoto e financeiro local esta clara;
- o modelo conceitual de solicitacao esta descrito;
- os status planejados estao documentados;
- os fora de escopo estao explicitos;
- handoff e checkpoint apontam para este documento;
- nenhuma implementacao de produto foi feita nesta etapa.

## 10. Matriz QA inicial da futura fase

Esta matriz e preparatoria. Ela deve ser refinada quando houver implementacao.

| ID | Cenario | Resultado esperado |
|----|---------|--------------------|
| Q1 | Usuario sem conta abre o app. | Financeiro local segue disponivel; solicitacoes remotas nao bloqueiam uso. |
| Q2 | Cliente com vinculo aprovado cria solicitacao futura. | Apenas intencao remota e criada; nenhum cliente/contrato/pagamento/caixa local e alterado automaticamente. |
| Q3 | Fornecedor responde solicitacao futura. | Status relacional muda; financeiro local segue intocado. |
| Q4 | Solicitacao aprovada futura. | Nao cria contrato automaticamente sem acao/fase propria. |
| Q5 | Backup/exportação local. | Continua **sem** embutir **`loanRequests`** remotos como domínio financeiro local; o pacote pode incluir **`clientDebtLedger`** (**dados locais neste aparelho**, escopo) normalizado junto a caixa + **`clients[]`** (**`40fa3a4`** — compatível com arquivos antigos sem o campo). |
| Q6 | Pagamentos locais. | Continuam sem `payment.linkContext` persistido. |
| Q7 | Dashboard/calculos. | Nao mudam por causa de solicitacoes remotas. |

## 11. IA e modo recomendados para a etapa seguinte

- **IA recomendada no Cursor:** Architect + PM/PO para fechar escopo e regras antes de codigo; Analyst para transformar os criterios em matriz QA executavel.
- **Modo recomendado:** Plan.
- **Por que:** a proxima etapa envolve fronteira entre produto, Firebase, regras de seguranca e dominio financeiro local. Implementar direto aumentaria o risco de sync financeiro implicito, promessa errada de nuvem financeira ou acoplamento prematuro com o motor local.

## 12. Fora do escopo explicito

Continuam fora desta fase:

- sync financeiro remoto;
- colecoes remotas autoritativas de clientes, contratos, pagamentos, caixa ou dashboard;
- `payment.linkContext`;
- alteracao do motor financeiro;
- conversao **automatica** remota de pedido aprovado em contrato (o **Bloco 2** é conversão **manual** **local** apenas);
- notificacoes FCM;
- Cloud Functions;
- redesign amplo;
- React Router;
- permissao financeira local baseada em vinculo remoto.

## 13. Historico

| Data | Nota |
|------|------|
| 2026-04-30 | Criacao do documento de proxima fase oficial: ponte controlada fornecedor/cliente, pre-financeira, sem implementacao e sem sync financeiro remoto. |
| 2026-05-01 | Planejamento-mestre da execucao `loanRequest` v1 movido para [`plans/completed/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md`](./plans/completed/PLANEJAMENTO_MESTRE_LOANREQUEST_PRE_FINANCEIRO.md) como referencia historica; direcao atual continua neste documento, [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) e [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md). |
| 2026-05-03 | Ordem oficial de execucao documentada para **`loanRequest` v1.1** (primeiro timestamps `readBy*`, depois contraposta; pacote nominal v1.1 com confronto ao historico de numeracao previa): [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./plans/completed/LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md) (arquivado). |
| 2026-05-03 | **Factual pos-implementacao:** pacote **`loanRequest` v1.1 RB+CN** registrado como **fechado** em QA [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md); LKG **`lkg-2026-05-03-loanrequest-v1-1`**. Este documento **nao escolhe** a proxima fase operacional — vetos (`converted_to_contract`, sync financeiro, FCM…) permanecem; ver [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md). |
| 2026-05-03 | **Roadmap complementar (documento vivo):** [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md) descreve evolucoes **planejadas** A1–F em `loanRequests`; nao altera guardrails nem substitui este arquivo; **`plans/completed/`** permanece so historico. |
| 2026-05-04 | **Plano executavel Bloco 1** arquivado: [`plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md`](./plans/completed/PLANEJAMENTO_BLOCO1_LOANREQUEST_OPERACIONAL.md) — **Opção A**, **Bloco 1 funcionalmente fechado**; **Bloco 2** próxima fase recomendada. |
| 2026-05-04 | **Bloco2-0:** ADR criado [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) (posteriormente **aprovado** — ver linha seguinte). |
| 2026-05-04 | **Bloco 2 fechado + Bloco2-E:** implementação **`624c725`**, **`3badcbc`**, **`5dd4c36`**; docs vivos + QA matriz § Bloco 2; **próximo:** mini ADR snapshots de nomes · Visão Fornecedores. |
| 2026-05-04 | **ADR — Financeiro Local do Cliente / «Minhas dívidas»:** [`ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md`](./ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md) — **`clientDebtLedger`** planejado; primeira fase sem **`calculations.js`** (registo inicial). |
| 2026-05-04 | **Governança Bloco 2 (aprovação inicial):** ADR **aprovado**; implementação subsequente nos commits acima. |
| 2026-05-05 | Mini ADR snapshots — **fechada** (implementação **`6793461`**–**`28f3f4a`**; deploy **`agemp-financas-pro`**; QA § [`QA_MATRIX_LOANREQUEST_V1_1.md`](./QA_MATRIX_LOANREQUEST_V1_1.md)); próximo **Visão Fornecedores**. |
| 2026-05-05 | Mini ADR [`ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md`](./ADR_IDENTIDADE_PUBLICA_SNAPSHOTS_NOMES.md) — direção snapshots (`links`/`loanRequests`); só docs na rodada inicial (Subfase 0). |
| 2026-05-16 | **«Minhas dívidas» — Subfases A–D1 + D2 documental:** commits **`5fc8a58`**, **`e24eb25`**, **`0f2c43b`**, **`40fa3a4`**, **`eedbd2e`**; backup/export/import/auto-backup incluem **`clientDebtLedger`**; **`calculations.js`**, **`firestore.rules`**, SDK e **`payment.linkContext`** intocados; matriz §10 Q5 e docs vivos alinhados. |
| 2026-05-17 | **«Minhas dívidas» — D3 documental + smoke manual OK integral:** linha **funcionalmente fechada nesta etapa** (ADR §20); **sem NOK crítico** informado pelo operador; sem alteração **`calculations.js`** / **`firestore.rules`** / Firebase SDK / **`payment.linkContext`** / sync financeiro remoto / contrato remoto autoritativo nesta linha. |

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
- o dominio financeiro nao esta sincronizado com Firebase.

## 2. Decisao da proxima fase

A proxima fase oficial deve iniciar uma **ponte controlada para a visao futura fornecedor/cliente**, ainda dentro do produto atual e preservando o financeiro local-first.

Essa ponte deve tratar futuras solicitacoes remotas de emprestimo como uma camada **pre-financeira e relacional**, separada de clientes, contratos, pagamentos, caixa, dashboard, backups e calculos locais.

Nao e uma nova trilha funcional local-first por inercia, e tambem nao e inicio de sync financeiro remoto.

## 3. Mini-ADR

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

Fluxo recomendado para a fase futura, ainda sem implementar:

1. Cliente autenticado com papel Cliente e vinculo aprovado escolhe um fornecedor vinculado.
2. Cliente registra intencao de pedido com valor e nota.
3. Fornecedor autenticado com papel Fornecedor visualiza fila relacional de pedidos.
4. Fornecedor pode aprovar, recusar ou propor contraproposta.
5. Cliente acompanha resposta.
6. Conversao em contrato fica bloqueada para fase posterior e exige decisao explicita.

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
| Q5 | Backup/exportacao local. | Nao inclui solicitacoes remotas como dominio financeiro local. |
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
- conversao automatica de pedido aprovado em contrato;
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
| 2026-05-03 | Ordem oficial de execucao documentada para **`loanRequest` v1.1** (primeiro timestamps `readBy*`, depois contraposta; pacote nominal v1.1 com confronto ao historico de numeracao previa): [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md). |

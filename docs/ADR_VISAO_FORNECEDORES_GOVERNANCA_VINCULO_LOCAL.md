# ADR/Plano — Visão Fornecedores + Governança de vínculo/local

**Tipo:** Architectural Decision Record + plano executável  
**Projeto:** AGEmp / Finanças Pro  
**Escopo:** UX relacional do lado cliente + governança local explícita de clientes/contratos convertidos, preservando o financeiro local-first.

---

## 1. Estado atual confirmado

- O domínio financeiro continua **local-first**, persistido em `localStorage` por escopo (`anonymous` e `account:{uid}`).
- Firebase continua como camada **remota relacional e pré-financeira**: Auth, perfil remoto, `accountRoles`, vínculos e `loanRequests`.
- **Bloco 2** está fechado: fornecedor pode registrar contrato **local** a partir de `loanRequest.approved`, com confirmação humana, sem contrato remoto e sem sync financeiro remoto.
- A mini ADR de snapshots de nomes também está fechada: nomes amigáveis já aparecem em vínculos, pedidos e conversão local quando o snapshot existe.
- O cliente já possui painel de pedidos enviados em `Conta`, mas ainda **não** tem uma visão dedicada de fornecedores vinculados com leitura agrupada por fornecedor.
- O card **“Fornecedores com vínculo aprovado”** ainda pode mostrar **“Fornecedor da plataforma”** em vínculos legados sem `supplierDisplayNameSnapshot`, mesmo quando o perfil remoto já teria um `displayName` útil.
- Excluir cliente local hoje apaga apenas o cadastro financeiro deste aparelho; vínculo remoto e pedido remoto permanecem intactos.
- A anti-duplicidade atual da conversão depende da existência de contrato local com `convertedFromLoanRequestId`; se o contrato for apagado, o pedido pode voltar a parecer “nunca convertido”.

## 2. Problemas de produto

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

1. Cliente abre **Visão Fornecedores** e vê fornecedores vinculados com nomes amigáveis.
2. Vínculo legado sem snapshot mostra nome remoto quando possível; senão usa fallback estável.
3. Pedidos aparecem agrupados por fornecedor com status corretos.
4. **Solicitar novo valor** parte do fornecedor correto.
5. A interface deixa claro que pedido aprovado na plataforma **não é contrato local**.
6. Ao excluir cliente local, o app avisa que o vínculo remoto e o pedido remoto continuam existindo.
7. Pedido já convertido antes, mas com contrato apagado, mostra aviso de histórico local de conversão anterior.
8. Se houver reconversão, ela exige confirmação extra.

## 14. Decisões pendentes

- Estratégia exata de fallback para vínculos legados:
  - carregar perfil remoto sob demanda;
  - ou pré-carregar perfis dos fornecedores aprovados.
- Superfície final da Visão Fornecedores:
  - nova subview dedicada;
  - ou evolução do painel atual com separação clara.
- Política final de reconversão:
  - bloquear por padrão;
  - ou permitir com confirmação forte quando o contrato foi apagado.
- Nível de visibilidade da ação **Excluir cliente**:
  - manter visível com confirmação forte;
  - ou mover para seção mais avançada do `ClientView`.

## 15. Próxima ação recomendada

- Aprovar este ADR/plano como referência oficial da fase.
- Executar em pacotes pequenos, na ordem:
  - **Pacote 1:** **Bloco A + Bloco B mínimo**
  - **Pacote 2:** **Bloco D + parte segura do Bloco C**
  - **Pacote 3:** **QA/docs finais**
- Ao concluir cada pacote, atualizar os docs vivos e registrar smoke curto antes de avançar para o seguinte.

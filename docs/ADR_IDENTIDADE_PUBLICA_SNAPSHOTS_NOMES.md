# ADR — Identidade pública e snapshots de nomes em vínculos e pedidos

**Tipo:** Architectural Decision Record + plano executável futuro  
**Projeto:** AGEmp / Finanças Pro  
**Escopo:** Legibilidade amigável entre aparelhos/contas na camada **relacional remota** (`links`, `loanRequests`), **sem** sincronizar financeiro nem tornar Firebase fonte financeira autoritativa.

**Relação:** Sucessor planejado da lacuna registada em [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) § Limitações (nome entre aparelhos). **Bloco 2 permanece fechado** — esta ADR **não** o reabre.

---

## 1. Status e decisão

| Dimensão | Valor |
|----------|--------|
| **Estado da decisão** | **Documento vivo aprovado como direção recomendada** para implementação futura em subfases. **Nenhuma implementação de código nem alteração de `firestore.rules` está autorizada apenas por existir este arquivo** — execução só após critérios de entrada da equipa e ordem das subfases (§13). |
| **Natureza** | ADR **e** plano executável (fonte viva para a mini fase «snapshots de nomes»). |
| **Implementação no repositório** | **Não iniciada** nesta rodada documental (somente `docs/`). |

### Direção recomendada (congelada neste ADR)

1. **Combinação:** perfil remoto atual (`users/{uid}.displayName`) **em conjunto com** snapshots em **`links`** **e** **`loanRequests`**.
2. **Nomes de campo:** `clientDisplayNameSnapshot`, `supplierDisplayNameSnapshot` (ambos opcionais / nullable no modelo).
3. **Semântica MVP:** snapshots são **históricos** — **não** atualizar automaticamente documentos antigos quando o utilizador alterar `displayName`.
4. **Herança em pedidos:** ao criar `loanRequest`, **sempre que possível** copiar snapshots do **`links/{linkId}`** aprovado; **`supplierDisplayNameSnapshot` no pedido deve vir preferencialmente do link**; leitura do perfil remoto é **fallback**; **o utilizador não digita nem edita manualmente o nome da contraparte no formulário do pedido**.
5. **Escrita por papel no vínculo:** **cliente** escreve apenas **`clientDisplayNameSnapshot`** na **criação** do vínculo; **fornecedor** escreve apenas **`supplierDisplayNameSnapshot`** na **aprovação** do vínculo.
6. **Rules:** podem validar formato, tamanho e papel/autoria da escrita; **não** devem tratar nome como dado financeiro nem como permissão para alterar motor/local-first.

---

## 2. Estado atual confirmado

### 2.1 Já existe no código e nas rules (factual)

- **`users/{uid}`:** `displayName` (string, até 80 caracteres nas rules atuais), editável pelo dono do documento.
- **`links/{supplierId__clientId}`:** participantes, `status`, `requestedBy`, timestamps — **sem** campos de nome além dos UIDs.
- **`loanRequests/{id}`:** modelo v1+v1.1 pré-financeiro — **sem** campos de nome de contraparte.
- **Leitura de perfil:** qualquer autenticado pode `get` em `users/{userId}` (validação de papéis na etapa de vínculo).
- **Bloco 2:** conversão governada usa fallback textual **«Cliente da plataforma»** quando não há nome remoto fiável; rótulos amigáveis ocultam IDs na superfície principal (`platformFriendlyLabels.js`, etc.).

### 2.2 Lacuna

Entre dois aparelhos, o fornecedor não vê de forma estável o nome escolhido pelo cliente no perfil (ex.: «Mello»), nem o cliente o do fornecedor, porque **nenhum snapshot relacional** é persistido em `links`/`loanRequests` e a UI de vínculos ainda pode depender de UID.

---

## 3. Problema de produto

- **«Cliente da plataforma»** e frases genéricas são aceitáveis como MVP do Bloco 2, mas **não escalam** quando há vários vínculos ou pedidos.
- Utilizadores precisam reconhecer **quem é quem** na relação fornecedor ↔ cliente **sem decorar UIDs** e sem confundir com o cadastro financeiro local.
- O problema é **identidade relacional na nuvem**, não livro-caixa local.

---

## 4. Decisão arquitetural recomendada

### 4.1 Princípios

1. **Local-first financeiro:** contratos, pagamentos, caixa e dashboard continuam locais; snapshots remotos são **somente metadado relacional**.
2. **Sem sync financeiro remoto** nem contrato remoto autoritativo.
3. **Sem `payment.linkContext`** e **sem alterações em `calculations.js`** nesta linha.
4. **Privacidade mínima:** apenas texto de nome público (espelho controlado do `displayName` ou cópia no momento da escrita permitida); sem telefone, documento ou dados financeiros.
5. **Separação de autoria:** cada lado só **commita** o snapshot do **próprio** nome no documento de vínculo; pedidos **herdam** do link quando existir.

### 4.2 Modelo combinado (perfil + snapshots)

| Fonte | Papel |
|--------|--------|
| **`users/{uid}.displayName`** | Valor atual editável pelo utilizador; usado para **preencher** snapshots no momento permitido e como **fallback de UI/leitura** quando snapshot ausente (documentos antigos). |
| **`links`** | Armazena **`clientDisplayNameSnapshot`** e **`supplierDisplayNameSnapshot`** estáveis no ciclo de vida do vínculo (escrita conforme §1). |
| **`loanRequests`** | Armazena cópias **`clientDisplayNameSnapshot`** e **`supplierDisplayNameSnapshot`** na **criação** do pedido, **preferindo o documento `links/{linkId}`** aprovado; fallback para perfil remoto quando o link não tiver snapshot. |

### 4.3 Por que snapshot histórico no MVP

Preserva o contexto da conversa («como se chamava cada um quando o pedido foi criado»). Mudanças futuras de `displayName` **não** reescrevem pedidos nem vínculos antigos automaticamente (produto pode acrescentar fluxo opcional numa fase posterior).

---

## 5. MVP proposto

### 5.1 Entra (quando implementado)

- Novos campos opcionais em **`links`** e **`loanRequests`** (`clientDisplayNameSnapshot`, `supplierDisplayNameSnapshot`).
- Fluxos de escrita alinhados a §1 e §7 (cliente/fornecedor, criação/aprovação, criação de pedido).
- UI: substituir gradualmente UID/genéricos por nome derivado (snapshot → perfil → fallback textual), mantendo linguagem «pré-financeiro / plataforma».
- Integração na **conversão local (Bloco 2):** sugerir nome do cliente local a partir do snapshot do pedido quando existir.

### 5.2 Fica fora do MVP desta mini ADR

- Atualização automática ou em massa de snapshots quando `displayName` mudar.
- «Visão Fornecedores» (aba/cliente agrupando fornecedores) — **fase posterior**, depois desta ADR.
- Modo avançado opcional para expor IDs (backlog separado).
- A2b/A2c (arquivamento remoto de pedidos).

---

## 6. Fora do escopo

- Sync financeiro remoto e coleções autoritativas de clientes/contratos/pagamentos/caixa/dashboard remotos.
- Contrato remoto.
- Persistir **`payment.linkContext`** (permanece conforme [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md)).
- Alterar **`calculations.js`** ou regras de negócio financeiras por vínculo.
- Utilizar nome como **motor de permissão financeira** local.
- Reabrir Bloco 2 nem Bloco 1; não implementar A2b/A2c aqui.

---

## 7. Campos e modelagem Firestore

### 7.1 `links/{linkId}`

| Campo | Tipo sugerido | Escrita |
|--------|----------------|---------|
| `clientDisplayNameSnapshot` | `string \| null` | Cliente, na **criação** do vínculo (ou reabertura que recria fluxo equivalente — detalhar na implementação). Valor derivado do **`displayName`** do próprio cliente (normalizado). |
| `supplierDisplayNameSnapshot` | `string \| null` | Fornecedor, na transição **`pending` → `approved`**. Valor derivado do **`displayName`** do próprio fornecedor. |

Regras de normalização sugeridas (implementação): string não vazia após trim, comprimento máximo alinhado ao perfil (ex.: 80); ausência → `null` ou campo omitido conforme política de schema escolhida na Subfase 2.

### 7.2 `loanRequests/{loanRequestId}`

| Campo | Tipo sugerido | Escrita |
|--------|----------------|---------|
| `clientDisplayNameSnapshot` | `string \| null` | Na **criação** do pedido pelo cliente: preferir cópia do **`links/{linkId}.clientDisplayNameSnapshot`**; se ausente, ler **`users/{clientId}.displayName`**. |
| `supplierDisplayNameSnapshot` | `string \| null` | Na **criação** do pedido: **preferir** **`links/{linkId}.supplierDisplayNameSnapshot`** (vínculo **aprovado**); se ausente, fallback **`users/{supplierId}.displayName`**. |

**Imutabilidade:** após `create`, estes dois campos **não** são atualizados por transições de negócio (`under_review`, `counteroffer`, etc.) — apenas formato/imutabilidade a consolidar nas rules na Subfase 2.

**UX obrigatória:** nenhum campo de formulário para o utilizador **digitar** nome da contraparte no pedido; valores são sempre **derivados** no cliente conforme esta ADR.

---

## 8. Regras Firestore prováveis

*(Especificação alvo — implementação na Subfase 2.)*

### 8.1 Links

- Incluir os dois snapshots na whitelist de campos permitidos.
- **Create (cliente):** pode definir apenas **`clientDisplayNameSnapshot`** no payload permitido; não pode definir **`supplierDisplayNameSnapshot`**.
- **Update (fornecedor aprova):** pode definir/atualizar apenas **`supplierDisplayNameSnapshot`** na transição `pending → approved`; **`clientDisplayNameSnapshot`** permanece igual ao existente.
- Validar tipo string com comprimento máximo ou `null`; **não** inferir valores financeiros.

### 8.2 LoanRequests

- Incluir ambos na whitelist; **`create`** pode exigir presença opcional conforme política (recomendação: permitir `null` se perfil vazio).
- **Updates:** vedado alterar snapshots após criação (diff apenas nos ramos já existentes de negócio).
- **Autoria:** escrita na criação apenas pelo **`clientId`** autenticado; snapshots devem corresponder aos participantes do documento (sem permitir ao cliente gravar campo «oficial» arbitrário do fornecedor que não seja cópia permitida — validação por igualdade ao link/perfil onde aplicável é opcional de produto e pode ser custosa nas rules; mínimo obrigatório: formato + papel).

### 8.3 Natureza jurídica nas rules

Os snapshots são **rótulos relacional-operacionais**, não montantes, não saldos, não aprovação financeira. As rules **não** devem usar nome como substituto de validação financeira.

---

## 9. Impacto em componentes

*(Alvo para implementação futura — sem compromisso de ficheiros nesta rodada.)*

| Área | Provável |
|------|-----------|
| Firebase helpers | `src/firebase/links.js`, `src/firebase/loanRequestsFirestore.js`, `src/firebase/loanRequests.js` |
| Rules | `firestore.rules` |
| UI Conta / vínculos | `src/components/AccountScreen.jsx` |
| Painéis pedidos | `LoanRequestsClientPanel.jsx`, `LoanRequestsSupplierPanel.jsx` |
| Conversão Bloco 2 | `src/utils/convertLoanRequestToLocalContract.js`, `platformFriendlyLabels.js` |
| Documentação modelo | [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) após alteração de schema |

---

## 10. Estratégia para dados antigos

- **Links** e **loanRequests** sem snapshots: **sem migração obrigatória**; UI/helpers podem usar **`getUserProfile`** como fallback quando política de produto permitir.
- **Clientes locais** já criados como «Cliente da plataforma»: **sem alteração automática**; utilizador pode renomear localmente.
- **Backfill em Cloud Functions ou scripts**: **fora** do MVP salvo decisão explícita futura.

---

## 11. UX / copy / fallbacks

- Ordem sugerida de exibição: **snapshot no documento** → **`displayName` do perfil remoto** (se leitura disponível) → texto estável tipo **«Cliente da plataforma»** / **«Fornecedor da plataforma»** → (só se necessário) UID em modo suporte/avançado futuro.
- Manter linguagem de que pedidos são **na plataforma**, não extrato financeiro sincronizado (alinhar a [`DESIGN.md`](../DESIGN.md), [`PROJECT_OVERRIDES.md`](../PROJECT_OVERRIDES.md)).

---

## 12. Privacidade e riscos

| Risco | Mitigação |
|-------|-----------|
| Nome falso ou ofensivo no perfil | Mesmo problema atual do `displayName`; snapshots apenas copiam; bloqueio/conteúdo é política de produto/comunidade. |
| Leitura de perfil entre utilizadores | Já permitida para `get` em `users`; snapshots reduzem chamadas repetidas. |
| Rules excessivamente permissivas | Revisão obrigatória + `npm run test:rules:loanRequests` e testes de links quando existirem. |
| Confundir nome com garantia financeira | Copy e ADRs de pré-financeiro; nome **não** afeta `calculations.js`. |

---

## 13. Subfases futuras (ordem obrigatória)

| Subfase | Conteúdo |
|---------|-----------|
| **0** | ADR / documentação viva (**este ficheiro** + ponteiros nos docs vivos). |
| **1** | Helpers puros de normalização de nome/snapshot + **testes unitários** (sem Firestore/rules). |
| **2** | **`firestore.rules`** + **rules tests** (emulador); atualizar documentação de modelo onde aplicável. |
| **3** | Snapshots em **`links`** (criação cliente + aprovação fornecedor). |
| **4** | Snapshots em **`loanRequests`** na criação (herança do link + fallback perfil). |
| **5** | UI em vínculos e pedidos (Conta + painéis). |
| **6** | Integração com **conversão local** Bloco 2 (nome sugerido a partir do pedido). |
| **7** | QA smoke (dois utilizadores), regressão Bloco 2 / loanRequests / vínculos, fecho documental. |

---

## 14. Testes necessários

- **Vitest:** helpers da Subfase 1; regressão de fluxos que tocam nomes.
- **Rules:** criar/atualizar links com snapshots; criar `loanRequest` com snapshots imutáveis; garantir que updates de negócio não alteram snapshots.
- **Smoke manual:** dois utilizadores/aparelhos — vínculo com nomes visíveis, pedido com herança do link, conversão local com nome sugerido.
- **Regressão:** Bloco 2 (anti-duplicidade, checkbox, microcopy); badges Bloco 1; CN/contraposta.

---

## 15. Decisões aprovadas e pendentes

### Aprovadas (neste ADR)

- Direção **perfil atual + snapshots em `links` + snapshots em `loanRequests`**.
- Nomes **`clientDisplayNameSnapshot`** e **`supplierDisplayNameSnapshot`**.
- Snapshots **históricos no MVP** (sem sync automático com mudanças futuras de `displayName`).
- **Herança** dos snapshots do **link** para o **pedido** sempre que possível; **`supplierDisplayNameSnapshot` do pedido preferencialmente do link**; perfil como fallback; **sem entrada manual** do nome da contraparte no pedido.
- Escrita no vínculo: **cliente** só **`clientDisplayNameSnapshot`** na criação; **fornecedor** só **`supplierDisplayNameSnapshot`** na aprovação.
- Rules validam formato/papel; nome **não** é dado financeiro.
- Ordem das subfases §13.
- **Visão Fornecedores** permanece **fase futura** após esta mini ADR.

### Pendentes (para resolver antes ou durante implementação)

- Política exata de **`null` vs campo ausente** em Firestore nos dois tipos de documento.
- Se **reabertura de vínculo** (`pending` após terminal) deve **reescrever** `clientDisplayNameSnapshot` ou preservar valor anterior.
- Validação nas rules de **igualdade** snapshot ↔ fonte (perfil/link) — custo vs benefício.

---

## 16. Próxima ação recomendada

1. Manter este ADR como referência até **aprovação explícita de implementação**.
2. Iniciar **Subfase 1** (helpers + testes unitários), depois **Subfase 2** (rules), sem saltar etapas.
3. Após fecho da mini fase de código: atualizar [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md), matrizes QA relevantes e [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md).

---

## 17. Histórico

| Data | Nota |
|------|------|
| 2026-05-05 | Criação do ADR oficial em `docs/` — documentação apenas; sem alteração a `src/`, `firestore.rules` nem testes. |

---

## Relação com outros documentos

| Documento | Papel |
|-----------|--------|
| [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md) | Estado consolidado do projeto |
| [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md) | Acompanhamento |
| [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md) | Ponte pré-financeira |
| [`LOANREQUEST_EVOLUTION_ROADMAP.md`](./LOANREQUEST_EVOLUTION_ROADMAP.md) | Roadmap A–F |
| [`ADR_BLOCO2_CONVERSAO_GOVERNADA.md`](./ADR_BLOCO2_CONVERSAO_GOVERNADA.md) | Bloco 2 fechado; lacuna de nomes |
| [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md) | Modelo remoto atual — atualizar quando schema mudar |
| [`ADR_PAYMENT_LINK_CONTEXT.md`](./ADR_PAYMENT_LINK_CONTEXT.md) | Pagamento só espelho derivado |

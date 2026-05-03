# LoanRequest v1.1 — contrato funcional (histórico / arquivado)

**Tipo:** documento **histórico** nesta pasta **`docs/plans/completed/`** — **não** é plano ativo nem fonte prioritária sobre estado corrente (preferir [`HANDOFF_MASTER.md`](../../HANDOFF_MASTER.md), [`CHECKPOINT_CHECKLIST.md`](../../CHECKPOINT_CHECKLIST.md), [`FIRESTORE_LOANREQUESTS.md`](../../FIRESTORE_LOANREQUESTS.md)).  
**Execução:** contrato funcional da extensão v1.1 (**Fatia RB:** `readBy*` · **Fatia CN:** `counteroffer` / `counteroffer_declined`) **aplicado no código**; pacote **`loanRequest` v1.1** (RB+CN), **fechado** com smoke manual e LKG **`lkg-2026-05-03-loanrequest-v1-1`** (marco só RB: **`lkg-2026-05-03-loanrequest-v1-1-rb`**).  
**Base v1:** [`LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`](./LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md) · [`FIRESTORE_LOANREQUESTS.md`](../../FIRESTORE_LOANREQUESTS.md) · [`QA_MATRIX_LOANREQUEST_V1.md`](./QA_MATRIX_LOANREQUEST_V1.md) · [`NEXT_PHASE_OFFICIAL.md`](../../NEXT_PHASE_OFFICIAL.md)

---

## Guardrails (inalteráveis)

- Camada **pré-financeira e relacional** apenas; sem sync financeiro remoto.
- Sem conversão automática pedido/contraproposta → contrato **local ou remoto**.
- Sem criar coleções autoritativas de clientes, contratos, pagamentos, caixa ou dashboard no Firestore.
- Sem `payment.linkContext`; sem alterações em `calculations.js`.
- Vínculo remoto ≠ permissão obrigatória do motor financeiro local.
- Sem FCM obrigatório; timestamps de leitura **não** substituem notificação formal.

---

## Recorte oficial do pacote v1.1

O pacote **`loanRequest` v1.1** engloba duas capacidades já previstas conceptualmente em [`NEXT_PHASE_OFFICIAL.md`](../../NEXT_PHASE_OFFICIAL.md):

1. **Leitura operacional (`readByClientAt` / `readBySupplierAt`)** — metadados opcionais de “visto” na plataforma.
2. **Contraproposta (`counteroffer` + valores associados)** — negociação **de rodada única** antes de decisão terminal.

Este documento **não substitui** o congelamento da v1; registra **extensões** que foram **implementadas** (rules + cliente + QA). Referência técnica viva dos caminhos remotos: [`FIRESTORE_LOANREQUESTS.md`](../../FIRESTORE_LOANREQUESTS.md).

---

## Decisão explícita: ordem de entrega dentro de v1.1

### Histórico de referência (planejamento-mestre antigo — não prioritário sobre este doc)

No material histórico arquivado, a narrativa tinha sido numerada como evoluções em sequência (ex.: uma subfase de **contraproposta** antes de **timestamps de leitura**). Isso aparece como direção exploratória junto ao modelo conceitual em [`NEXT_PHASE_OFFICIAL.md`](../../NEXT_PHASE_OFFICIAL.md) e materiais complementares já arquivados.

### Ordem oficial de execução **recomendada e adotada** para v1.1 (prioridade técnica e de risco)

| Ordem | Entrega dentro de `loanRequest` v1.1 | Razão objetiva principal |
|:-----:|--------------------------------------|---------------------------|
| **1** | `readByClientAt` / `readBySupplierAt` | Menor complexidade semântica: **nenhum novo `status`** de negociação; superfície de Firestore Rules concentrada em `diff()` pequenos e bem isolados sobre timestamps. |
| **2** | `counteroffer` (rodada única) | Maior impacto produto/rules: novo `status` aberto ou equivalente na máquina de estados + transições de cliente + garantia forte de UX “não é contrato”. |

**Confronto explícito com a ordem histórica (contraproposta antes de readBy\*):**

- Mantém-se o **valor de produto histórico** (contraproposta como marco forte).
- Inverte-se apenas a **ordem de código e validação regressiva**, para navegar primeiro por um incremento onde:
  - a chance de regressão nos fluxos já fechados de v1 (pendente/em análise/aprovação/recusa/cancelamento) é menor;
  - QA e revisão das rules ficam mais baratas na primeira promoção parcial para LKG.
- Ou seja: **esta decisão altera relação apenas com a sequência editorial/histórica de “subfase 5 / 6”**, não abandonando nenhuma das duas capacidades no escopo nominal **v1.1**.

---

## Impactos solicitados pela decisão (resumo obrigatório)

| Dimensão | Leituras `readBy*` primeiro | Contraproposta segundo |
|-----------|----------------------------|-------------------------|
| **Produto** | Melhora coordenação e confiança no canal antes de comportamento de barganha mais carregado. | Entrega maior utilidade econômica depois da base de “presença/atenção”. |
| **Firestore Rules** | Novos branches de `allow update`: campos apenas de leitura + `updatedAt` (vide § abaixo), sem novo `status`. | Novos `status`/transitions, validação cruzada de valores, papel cliente em `counteroffer` → decisão terminal. |
| **UI / microcopy** | Indicadores discretos de “novo/não aberto”; **sem** SLA, confirmação legal ou obrigação de resposta — alinhado a [`PROJECT_OVERRIDES.md`](../../../PROJECT_OVERRIDES.md) sobre poucos badges. | Estado “Contraproposta” com texto explícito: **pedido/plataforma, não contrato**; valores secundários após solicitado/fornecedor. |
| **QA / regressão** | Matriz enxuta; foco duplo usuários + guardrails financeiros já existentes. | Matriz ampliada; obrigatória regressão de **todos** os fluxos v1 já fechados. |
| **Lógica de subfases histórica** | **Preserva o pacote nominal v1.1**; altera apenas a sequência recomendada de PRs/smokes antes de novo LKG. | Idem |

---

## 1. Leitura operacional (`readByClientAt` / `readBySupplierAt`)

### 1.1. Semântica (decisão)

- São **somente evidência operacional** de que cada parte registrou uma “leitura” no app.
- **Não**: confirmação de recebimento legal; garantia temporal de “mensagem vista”; auditoria forte; permissão financeira local.
- **Não**: acoplamento obrigatório a notificações (FCM) nesta fatia.

### 1.2. Permissões (decisão)

- Apenas **`clientId`** atualiza `readByClientAt`.
- Apenas **`supplierId`** atualiza `readBySupplierAt`.
- Cada lado pode apenas **incrementar/monotonizar pelo relógio do servidor**: em implementação típica, `readBy* <= request.time` e substituição permitida apenas se `request.time >= campo anterior` quando o campo já existir (detalhar nas rules revisadas).

### 1.3. Correlação com `updatedAt` (decisão obrigatória antes do PR de código)

Duas políticas válidas:

| Opção | Vantagem | Risco |
|-------|----------|--------|
| **A)** `readBy*` sempre acompanham `updatedAt == request.time` | Reuso do padrão já presente nos updates v1 — simplifica migrações mentais das rules. | “Último evento relevante na lista” mistura negócio e leitura. |
| **B)** atualizações apenas em `readBy*` sem tocar outros campos | Separa ordenação/lista do “motor relacional”; leituras não aparecem como “evento principal”. | `loanRequestAllowedV1Keys`/diff atual precisa de ramo próprio bem testado para não regressar segurança. |

**Escolha de governança v1.1:** **preferir política B** na especificação, **desde que** o projeto aceite trabalho extra único nas rules/helpers; caso o time avalie alto risco de regressão temporal, usar **política A** explicitamente no PR e refletir na matriz QA.

### 1.4. Correlação com vínculo revogado (herança v1)

- Manter comportamento atual: escritas dependem de vínculo aprovado onde aplicável; leituras históricas permanecem possíveis para participantes (**como já documentado para v1**).
- **`readBy*`** conta como escrita trivial: deve seguir mesma pré-condição de vínculo **apenas se** política atual de transições assim exige; caso contrário, registrar explicitamente no PR (evitar dois sistemas paralelos entre “mudança negocial” vs “metadado de leitura”).

---

## 2. Contraproposta (rodada única)

### 2.1. Semântica (decisão)

- Ao menos **uma contraproposta ativa por pedido**.
- Ciclo máximo curtíssimo: fornecedor propõe **um** novo valor monetário opcionalmente com nota; cliente **aceita** ou **declina**.
- Aceitar culmina em **`approved`** com **valor efetivamente acordado = contraproposto** (`approvedAmount`), permanecendo claro por microcopy que **não há contrato no app**.
- Declinar deve produzir **terminal relacional não ambíguo** para cliente e fornecedor (vide § 2.3).

### 2.2. Status e valores (proposta técnico-produto)

Introdução do status **`counteroffer`** aos **status abertos** (além de `pending` / `under_review`), para fins de unicidade (“um pedido aberto por vínculo”):

- Abertos: `{ pending, under_review, counteroffer }`
- Terminais preservados onde possível: `approved`, `rejected`, `cancelled_by_client`
- Opcional já previsto **`converted_to_contract`** permanece **inativo** em v1.1 como em v1 / [`NEXT_PHASE_OFFICIAL.md`](../../NEXT_PHASE_OFFICIAL.md)

**Novos/atualizados campos sugeridos (após revisão técnica no PR):**

| Campo | Papel na contraproposta |
|-------|--------------------------|
| `counterofferAmount` | inteiros centavos BRL — mesmos limites de `requestedAmount` |
| `counterofferedAt` | timestamp servidor quando entrar em `counteroffer` |
| `supplierNote` | já existe em v1; pode repetir papel de observação opcional até limite atual ([`LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md`](./LOANREQUEST_V1_CONTRATO_FUNCIONAL_SUBFASE1.md)) |

`requestedAmount` e `clientNote` permanecem imutáveis.

### 2.3. Terminal ao **declinar** contraposta (decisão obrigatória)

Para evitar reutilização ambígua de `rejected` (historicamente apenas fornecedor rejeita o pedido original), usar um status terminal dedicado **`counteroffer_declined`** **ou**, alternativa equivalente já documentada antes do PR, garantir discriminador explícito em doc+rules (**não apenas inferência pela UI anterior** porque o histórico de status não existe no snapshot antigo ao reler documento direto).

**Decisão v1.1:** adotar terminal **`counteroffer_declined`** (rótulos de UI próprios) — simplifica QA e comunicação cliente/fornecedor.

### 2.4. Matriz macro de transições (orientação ao PR)

Esta seção **preparou** revisão técnica; a implementação espelha em [`firestore.rules`](../../../firestore.rules) **e** em helpers JS.

**Fornecedor**

- De `pending` ou `under_review` → `counteroffer` (**com `counterofferAmount` ≠ `requestedAmount` obrigatoriamente?** caso contrário seria aprovação direta já existente; impor no PR: entrada em `counteroffer` exige `counterofferAmount` válido e **≠ requestedAmount**.)
- Mantém transições v1 já existentes: de `pending` ou `under_review` → `approved` ou `rejected`
- Impedir explicitamente regressões `counteroffer` → `pending`

**Cliente**

- De `counteroffer` → `approved` (**com `approvedAmount == counterofferAmount`** e timestamps de resposta)
- De `counteroffer` → **`counteroffer_declined`**
- Manter fluxos já existentes (`cancelled_by_client` desde `pending` / `under_review`)

**Única rodada enforcement**

Após primeiro `counteroffer`, fornecedor **não pode** propor novo valor naquele mesmo documento (`counteroffer` não retorna ao fornecedor com novo valor exceto mediante cancelamento cliente / doc novo — decidido já por “terminal” cliente).

---

## Critérios de entrada para iniciar código (pré-execução — cumpridos)

Itens históricos satisfeitos na entrega v1.1:

- [x] Governança aceitou este arquivo como especificação vinculável.
- [x] Política A vs B sobre `updatedAt` em atualizações de leitura refletida no código/regras (política B preferida na especificação).
- [x] Matriz QA v1.1 e smoke: [`QA_MATRIX_LOANREQUEST_V1_1.md`](../../QA_MATRIX_LOANREQUEST_V1_1.md); LKG **`lkg-2026-05-03-loanrequest-v1-1`**.

---

## Histórico

| Data       | Nota |
|------------|------|
| 2026-05-03 | Formalização inicial do planejamento v1.1, ordem de entrega confrontada ao histórico e escopo preservado dentro da ponte pré-financeira (`NEXT_PHASE_OFFICIAL.md`). |
| 2026-05-03 | Pacote v1.1 RB+CN **fechado** (smoke, LKG); este contrato **arquivado** em `docs/plans/completed/` como referência histórica; estado vivo em [`FIRESTORE_LOANREQUESTS.md`](../../FIRESTORE_LOANREQUESTS.md) e [`QA_MATRIX_LOANREQUEST_V1_1.md`](../../QA_MATRIX_LOANREQUEST_V1_1.md). |

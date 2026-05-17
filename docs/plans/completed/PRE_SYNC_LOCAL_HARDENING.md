# Pré-Sync Local Hardening — pacote encerrado

## Estado deste documento

| Campo | Valor |
| --- | --- |
| **Status** | **Encerrado — documentação viva atualizada (Onda 2B)** |
| **Finalidade original** | Orientar ondas de implementação **locais** antes da fase online/sincronismo |
| **Arquivo** | `docs/plans/completed/PRE_SYNC_LOCAL_HARDENING.md` (**referência histórica** — não é plano ativo) |

**Arquivo de origem:** plano criado em **`9bdf9de`** (`docs/plans/PRE_SYNC_LOCAL_HARDENING.md` na raiz de `plans/`). **Encerramento documental:** Onda **2B** (**2026-05-16** — registos nos docs vivos correlatos).

---

## Encerramento por ondas (commits de referência)

| Onda | Descrição | Commit |
| --- | --- | --- |
| **Onda 1** | UX/language hardening + lembretes visuais derivados (`dueDate` / `dueDay`), sem motor central | **`d6f69af`** |
| **Onda 2A** | Export JSON específico do `clientDebtLedger` (envelope tipado), distinto do backup completo | **`8228b5c`** |
| **Correção pós-smoke** | Restauro de `debtStatusLabelPt` em `ClientSupplierDebtDetail` (evita `ReferenceError` / tela branca) | **`b86ae9b`** |

**Plano vivo inicial:** **`9bdf9de`** — `docs(plans): add active PRE_SYNC_LOCAL_HARDENING plan`.

**Contexto anterior:** linha «Minhas dívidas» **A–D3** fechada com LKG **`lkg-2026-05-17-minhas-dividas`** e smoke **D3** OK (**2026-05-17**).

---

## Smoke manual final (operador — Onda 2B)

**Data do registro:** **2026-05-16** · **Resultado:** **OK** · **NOK crítico:** nenhum informado após **`b86ae9b`**

Execução humana confirmou (entre outros):

- Aba **Fornecedores** abre normalmente — **OK**
- Separação **Plataforma** vs **Dados locais neste aparelho** — **OK**
- Lembretes simples aparecem **sem** alterar cálculo do motor central — **OK**
- Dívida criada a partir de pedido **approved** abre no detalhe **sem** tela branca após bugfix — **OK**
- Export JSON específico baixa corretamente — **OK**
- JSON contém **`clientDebtLedger`** normalizado no envelope — **OK**
- Na raiz do JSON exportado específico **não** há **`clients`** nem **`fundsTransactions`** — **OK**
- Sem erro visual crítico informado após correção — **OK**

---

## Guardrails registados (pacote inteiro — preservados)

- **Local-first** preservado; **`clientDebtLedger`** continua **dado local neste aparelho** (por escopo).
- **Firebase não é fonte financeira autoritativa** do ledger; **sem sync financeiro remoto**; **sem contrato financeiro remoto** autoritativo nesta linha.
- **Sem `payment.linkContext`** nova; **sem alteração** em **`calculations.js`**, **`firestore.rules`** nem Firebase SDK por este pacote.
- **Lembretes:** apenas **visuais / derivados** — sem mora, multa, juros por atraso nem cálculo financeiro novo persistido como regra.
- **Export JSON específico** **não substitui** backup/export completo da app; **sem** fluxo de importação/restauração a partir desse arquivo nesta entrega.
- **Pedido `approved`** na plataforma **não cria** dívida local automaticamente.

---

## Contexto e objetivo (histórico)

Após o fechamento documental da linha **«Minhas Dívidas»** (`clientDebtLedger`, backup/import/auto-backup, ADR correspondente), este pacote refinou **experiência local** e **exportação dedicada** do ledger — **sem** abrir sincronização financeira remota nem alterar o núcleo financeiro central.

---

## Execução em duas ondas (realização)

### Onda 1 — UX/language hardening + lembretes simples — **concluída** (`d6f69af`)

- Microcopy e hierarquia na aba **Fornecedores** e **detalhe do fornecedor** (Plataforma vs dados locais neste aparelho).
- Lembretes derivados de `dueDate` / `dueDay` em **`clientDebtLedger.js`** (`deriveDebtDueReminder`, `deriveSupplierDueSummary`), sem **`calculations.js`**.

### Onda 2 — export JSON + QA final + fechamento documental — **concluída**

- **2A (`8228b5c`):** `buildClientDebtLedgerExportPayload` / `exportClientDebtLedgerJsonDownload` em **`storage.js`**; UI discreta na aba Fornecedores (`<details>`).
- **2B (este arquivo + docs vivos):** registro de smoke final, commits, guardrails e arquivamento do plano.

---

## Riscos e mitigações (resumo — histórico)

| Risco | Mitigação |
| --- | --- |
| UX sugere «nuvem financeira» | Copy reforçando **local neste aparelho** vs **plataforma**. |
| Lembretes como «cobrança» | Linguagem informativa; sem alterar saldos. |
| Confusão backup vs export ledger | Envelope tipado, nome de ficheiro e texto na UI. |

---

## Decisões finais (congeladas — histórico)

1. Pacote **local-only** — sem sync financeiro remoto do ledger.
2. **`calculations.js`** intocado.
3. Sem mudanças em **`firestore.rules`**, SDK, **`payment.linkContext`**, contrato remoto autoritativo nem redefinição do dashboard global.
4. **`dueDate` > `dueDay`**; `dueDay` em mês curto → último dia válido.
5. Export dedicado JSON — separado conceptualmente do backup completo.
6. **Approved ≠ dívida automática.**

---

## Referências relacionadas

- ADR «Minhas Dívidas»: [`ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md`](../../ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md)
- Índice de planos: [`README.md`](../README.md)

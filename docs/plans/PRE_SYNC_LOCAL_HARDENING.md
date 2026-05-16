# Pré-Sync Local Hardening — plano ativo

## Estado deste documento

| Campo | Valor |
| --- | --- |
| **Status** | **Ativo — não concluído** |
| **Finalidade** | Orientar **ondas de implementação locais** antes da fase online/sincronismo |
| **Arquivo** | `docs/plans/PRE_SYNC_LOCAL_HARDENING.md` (raiz de `docs/plans/`) |

**Este plano está em execução futura planejada:** trata-se de backlog organizado em ondas, não de estado já entregue.

**Não arquivar ainda:** **não** mover este arquivo para `docs/plans/completed/` até o pacote ser executado e formalmente encerrado na documentação viva (ADR, handoff, QA conforme fluxo do projeto).

---

## Contexto e objetivo

Após o fechamento documental da linha **«Minhas Dívidas»** (`clientDebtLedger`, backup/import/auto-backup, ADR correspondente), o próximo passo natural é **refinar a experiência local** e a **robustez operacional** do ledger — **sem** abrir sincronização financeira remota nem alterar o núcleo financeiro central.

**Objetivo do pacote:** endurecer UX, linguagem, pequenos indicadores derivados de vencimento e exportação específica do ledger, preservando **local-first** e preparando terreno conceitual para fases futuras **sem** tratá-las como já implementadas.

---

## Execução em duas ondas

O pacote **Pré-Sync Local Hardening** será executado em **2 ondas**, nesta ordem:

### Onda 1 — UX/language hardening + lembretes simples

- Refinar microcopy e hierarquia visual na aba **Fornecedores** e no **detalhe do fornecedor**, deixando explícita a fronteira **Plataforma (remota)** vs **dados financeiros locais neste aparelho**.
- Introduzir **lembretes visuais simples**, derivados apenas de metadados já presentes no modelo local do ledger (ex.: `dueDate`, `dueDay`), **sem** novo motor financeiro.

### Onda 2 — export JSON do `clientDebtLedger` + QA final + fechamento documental

- Entregar **export específico em JSON** do **`clientDebtLedger`**, alinhado à normalização existente e **claramente distinto** do backup geral da app (evitar divergência conceitual entre «backup completo» e «extração do ledger»).
- Fechar o pacote com **testes** focados nas novidades permitidas pelo escopo, **smoke manual** amplo onde couber e **atualização da documentação viva** (incluindo a ADR da linha «Minhas Dívidas», se o pacote permanecer dentro dos guardrails já definidos — ver decisões abaixo).

---

## Guardrails obrigatórios (pacote inteiro)

O pacote **preserva local-first**: dados financeiros continuam autoritativos **neste aparelho** (`localStorage` no modelo atual); **não inicia sync financeiro remoto**.

**Explicitamente fora de escopo — não alterar:**

- `src/utils/calculations.js` (motor financeiro central).
- `firestore.rules`.
- Firebase SDK / caminhos que tornem o remoto fonte autoritativa do financeiro.
- Persistência ou semântica de `payment.linkContext` (ADR vigente permanece válida).
- Contrato remoto autoritativo ou dashboard financeiro global como substituto do modelo local.

**Comportamento de produto já consolidado — mantido:**

- **Pedido aprovado (`approved`) não cria dívida local automaticamente**; qualquer vínculo ou pré-preenchimento continua governado pelo que já está definido na linha «Minhas Dívidas», sem automatismo novo que grave dívida só pelo estado remoto.

---

## Regras para lembretes derivados (vencimento)

Lembretes são **somente visuais**, **locais** e **derivados** dos campos já armazenados no ledger — **sem** mora, **sem** multa, **sem** cálculo financeiro novo e **sem** persistir novas regras de cobrança.

**Prioridade de campos:**

- Se existir **`dueDate`**, ela tem **prioridade** sobre **`dueDay`** para exibição/agrupamento dos lembretes derivados.

**`dueDay` em meses curtos:**

- Quando apenas **`dueDay`** for usado para derivar uma data no mês corrente (ou no mês de referência escolhido na UI), **mês curto** deve usar o **último dia válido** daquele mês (ex.: dia 31 → fevereiro vira 28 ou 29 conforme o ano).

---

## Export específico do ledger

- O export específico deste pacote será **JSON do `clientDebtLedger`** (estrutura coerente com normalização/helpers já existentes).
- Deve ficar **claro para o usuário** que não substitui o **backup/export completo** da aplicação; documentação e rótulos de UI devem evitar ambiguidade.

---

## Riscos e mitigações (resumo)

| Risco | Mitigação |
| --- | --- |
| UX que sugira «nuvem financeira» ou sync inexistente | Copy e hierarquia visual reforçando **local neste aparelho** vs **plataforma**. |
| Lembretes parecerem «motor» de juros/multa | Linguagem neutra; apenas estado derivado; sem alterar saldos ou `calculations.js`. |
| Dois tipos de export (backup vs ledger) gerarem confusão | Nomes distintos, ajuda curta na UI e doc viva alinhada. |
| Saturação visual nos cartões/listas | Estados discretos (ex.: cores/espaçamento já do design system). |

---

## Arquivos prováveis de impacto (referência para execução futura)

> Lista orientadora quando as ondas forem implementadas; **nenhuma mudança aqui implica alteração já feita só por constar neste plano.**

- UI: `src/components/ClientSuppliersPanel.jsx`, `src/components/ClientSupplierDebtDetail.jsx` (e adjacentes já usados pela linha «Minhas Dívidas»).
- Domínio ledger: `src/utils/clientDebtLedger.js`.
- Persistência/export: `src/utils/storage.js` (apenas para o export específico JSON, sem misturar com payload do backup completo de forma ambígua).
- Documentação viva: `docs/ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md`, `docs/HANDOFF_MASTER.md`, matrizes de QA pertinentes, e este arquivo até encerramento.

---

## Decisões finais antes da execução

Estas decisões fecham o escopo **antes** de qualquer PR de implementação; revisá-las apenas se houver ADR ou decisão explícita de produto.

1. **Pacote local-only:** nenhuma entrega deste plano inicia **sync financeiro remoto**, nem replicação autoritativa de `clientDebtLedger` para Firebase.
2. **Núcleo financeiro intocado:** `calculations.js` permanece fora do escopo; lembretes não recalculam juros, saldo ou disponível.
3. **Superfícies sensíveis intocadas:** sem mudanças em `firestore.rules`, Firebase SDK por necessidade deste pacote, `payment.linkContext`, contrato remoto autoritativo nem redefinição do dashboard global.
4. **Duas ondas fixas:** **Onda 1** = UX/idioma + lembretes derivados simples; **Onda 2** = export JSON do ledger + QA + fechamento documental.
5. **Approved ≠ dívida automática:** aprovação remota continua **sem** criar registro de dívida local por si só.
6. **Semântica de vencimento na UI derivada:** `dueDate` prevalece sobre `dueDay`; `dueDay` em mês curto → último dia válido do mês.
7. **Export dedicado:** um fluxo claro de **JSON só do `clientDebtLedger`**, separado conceptualmente do backup completo.
8. **Lembretes estritamente cosméticos/informativos:** locais, derivados, sem nova obrigação financeira persistida e sem linguagem de mora/multa como se fossem calculadas.

---

## Critérios de conclusão do pacote (para quando executado)

- Onda 1 e 2 implementadas conforme guardrails acima.
- Testes adequados ao escopo **realmente tocado** na implementação (sem expandir para áreas proibidas).
- Smoke manual registrado onde o projeto costuma registrar (matriz/handoff conforme convenção vigente).
- Atualização da documentação viva e decisão explícita de **arquivar** este plano em `docs/plans/completed/` **somente após** esse encerramento formal — até lá, permanece **ativo** na raiz de `docs/plans/`.

---

## Referências relacionadas

- ADR «Minhas Dívidas»: [`ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md`](../ADR_FINANCEIRO_LOCAL_CLIENTE_MINHAS_DIVIDAS.md)
- Índice de planos: [`README.md`](./README.md)

# Visão operacional local por vínculo — decisão de recorte

Documento vivo, alinhado a [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md), [`CHECKPOINT_CHECKLIST.md`](./CHECKPOINT_CHECKLIST.md) e ao plano aprovado de **próximo bloco estratégico** (sem sync financeiro remoto, sem `payment.linkContext` persistido).

## 1. Problema

Após consolidar **cliente → contrato (`loan.linkContext`) → exibição derivada no pagamento**, o próximo ganho eficiente é responder com clareza, **somente nos dados locais**:

> **O que há neste escopo neste aparelho que está anotado para este vínculo?**

Sem prometer financeiro na nuvem, sem alterar [`src/utils/calculations.js`](../src/utils/calculations.js) e sem persistir novo campo em pagamento.

## 2. Decisão de recorte (implementação em fases)

### Fase atual (implementada neste pacote)

- **Leitura operacional combinada**, na **aba Clientes**, sem nova rota nem React Router:

  - Manter filtros já existentes (Todos / Com anotação / Sem anotação) e refinamento por `linkId`.
  - **Enriquecer o refinamento** com contagens derivadas **no cliente**, **nos contratos** (`loan.linkContext`) e **lançamentos de pagamento** (quantidade de itens em `loan.payments` só em contratos cuja `loan.linkContext` coincide com aquele `linkId`).

- **Resumo textual curto**: quando há um vínculo selecionado no refinamento, exibir uma linha de ajuda que resume essas contagens (sempre com microcopy que deixa explícito: leitura local neste aparelho).

**Não entra nesta fase:**

- Novo dashboard global por vínculo.
- Persistência de `payment.linkContext`.
- Qualquer gravar contrato/pagamento/caixa no Firestore como domínio financeiro.
- Uso do vínculo para regra de permissão financeira ou cálculo.

### Fases futuras (só após decisão explícita de produto)

- **Opcional**: resumo operacional parecido em outra superfície (ex.: bloco pontual na visão atual), desde que igualmente derivação local e sob os mesmos guardrails — não antecipada neste pacote.
- **`payment.linkContext`**: apenas se houver ADR/requisitos de auditoria/imutabilidade por pagamento ([`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md)).
- **Sync financeiro remoto**: fase própria, fora deste pacote.

## 3. Mini-ADR

| Campo | Conteúdo |
|-------|----------|
| **Status** | Implementado; base estável `lkg-2026-04-28-link-operational-view` · commit `28f7936` |
| **Contexto** | `linkContext` v1 consolidado por camada conforme HANDOFF/CHECKPOINT; pagamento apenas derivado do contrato. |
| **Decisão** | Implementar primeiro a **visão operacional local por vínculo** como derivações puras + microcopy sobre a lista já existente. |
| **Consequências** | Mais valor operacional por baixo risco; dados antigos continuam válidos (`linkContext` opcional); `calculations.js` intocado; sem novo campo persistente em pagamento. |
| **Implementação técnica** | [`src/utils/linkOperationalDerive.js`](../src/utils/linkOperationalDerive.js) |

## 4. Histórico

| Data | Nota |
|------|------|
| 2026-04-29 | Decisão de recorte e encaixe na aba Clientes; utilitários puros + testes. |
| 2026-04-29 | Promovido a LKG `lkg-2026-04-28-link-operational-view` (`28f7936`); `HANDOFF_MASTER` / `CHECKPOINT_CHECKLIST` atualizados como base estável. |

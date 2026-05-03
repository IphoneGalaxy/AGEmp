# Matriz QA — `loanRequest` v1.1 (pré-financeira)

**Status da matriz:** **FECHAMENTO FORMAL RB + CN** — **Pacote nominal v1.1 completo** considerado **concluído e validado** após smoke manual real da **Fatia CN** (contraproposta). A **Fatia RB** mantém seu marco próprio (**`lkg-2026-05-03-loanrequest-v1-1-rb`**). Promoção integral: tag LKG **`lkg-2026-05-03-loanrequest-v1-1`**.

**Pacote anterior fechado:** [`QA_MATRIX_LOANREQUEST_V1.md`](./plans/completed/QA_MATRIX_LOANREQUEST_V1.md) (v1 + LKG `lkg-2026-05-01-loanrequest-v1-complete`)  
**Especificação v1.1:** [`LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md`](./LOANREQUEST_V1_1_CONTRATO_FUNCIONAL.md) · [`NEXT_PHASE_OFFICIAL.md`](./NEXT_PHASE_OFFICIAL.md)  
**Firestore / rules:** [`FIRESTORE_LOANREQUESTS.md`](./FIRESTORE_LOANREQUESTS.md)

Registrar data, ambiente (`build`/commit/tag), operador e **OK / NOK / N/A** por linha. **NOK crítico bloqueia** promoção futura equivalente nesta espécie de matriz.

---

## Execução registrada — Fatia RB (`readBy*`)

| Campo | Registro |
|-------|----------|
| **Implementação** | Commit **`7270409`** (`readByClientAt`, `readBySupplierAt`; política B em `updatedAt` conforme código/regras) |
| **Rules publicadas** | Comando utilizado pela equipe: `npx -y firebase-tools@latest deploy --only firestore:rules --project agemp-financas-pro` — sucesso (compilação + release) |
| **Smoke manual** | Executado pela operadora humana; **OK**, **sem NOK crítico** informado neste ciclo RB |
| **Promoção** | Tag LKG **`lkg-2026-05-03-loanrequest-v1-1-rb`** (marcador somente RB) |

---

## Execução registrada — Fatia CN (contraproposta — rodada única)

| Campo | Registro |
|-------|----------|
| **Commits relevantes** | **`60f95df`** — implementação inicial CN · **`ff78c52`** — vínculo revogado permite nova solicitação · **`72328c6`** — pré-check duplicidade com **`clientId`** na query (`findOpenLoanRequestForLinkId`) · **`f97e1eb`** — timestamp único em `createLoanRequest` (+ regras / emulador) · **`785f89b`** — timestamps únicos em contraproposta / aceite / recusa da contraproposta pelo cliente · **`4e8dcae`** — alinhamento final do payload de contraproposta às Security Rules (**`loanRequestHasCommittedCounteroffer`**, ordenação econômica nas rules, suite de testes no emulador) |
| **Rules / testes** | `npm run test:rules:loanRequests` (Vitest + emulador Firestore): create + contraproposta (**`assertSucceeds`** / **`assertFails`** valor igual ao pedido / doc com `counterofferAmount: null` legado) |
| **Smoke manual real (operador humano)** | **OK integral** na sequência abaixo, **sem NOK crítico** informado |
| **Promoção pacote v1.1** | Tag LKG anotada **`lkg-2026-05-03-loanrequest-v1-1`** (RB + CN validados em conjunto no fechamento documental) |

### Smoke manual — checklist registrado (Fatia CN + guardrails)

1. Cliente cria pedido (pré-financeiro).  
2. Fornecedor recebe pedido na lista.  
3. Fornecedor envia **contraproposta** com valor **diferente** do solicitado.  
4. Cliente **visualiza** a contraproposta.  
5. Cliente **aceita** contraproposta → pedido **`approved`** com **`approvedAmount`** igual ao valor contraposto.  
6. Outro pedido com contraproposta: cliente **recusa** → terminal **`counteroffer_declined`**.  
7. **Não** cria contrato financeiro local/remoto automático.  
8. **Não** altera caixa / dashboard / motor local.  
9. **Não** sincroniza dados financeiros locais.  
10. Fluxo permanece **pré-financeiro / plataforma** conforme UX e copys existentes.

---

## Como usar esta matriz (duas promoções opcionais — histórico)

A governança v1.1 promoveu primeiro **somente RB** (`lkg-2026-05-03-loanrequest-v1-1-rb`) e encerrou **RB+CN** com **`lkg-2026-05-03-loanrequest-v1-1`**.

| ID da fatia | Conteúdo |
|-------------|----------|
| **RB** | `readByClientAt` · `readBySupplierAt` |
| **CN** | `counteroffer` + terminal `counteroffer_declined` + decisão do cliente |

---

## Guardrails globais (obrigatórios — herança v1 estendida)

| ID | Cenário | Resultado esperado | OK |
|----|---------|-------------------|----|
| G1 | Fluxos RB/CN conforme aplicável | Não altera dados financeiros locais (dashboard/clientes/contratos/pagamentos/caixa) | OK (smoke/fechamento) |
| G2 | Idem | Não grava coleções autoritativas financeiras remotas | OK |
| G3 | Idem | `calculations.js` permanece efetivamente intocado pela fatia RB/CN | OK |
| G4 | Idem | `payment.linkContext` continua inexistente após cenários RB/CN | OK |
| G5 | Usuário sem conta | App financeiro local disponível como hoje sem dependência obrigatória de pedidos remotos | N/A típico / herdado |
| G6 | Backup/export/import | Pedidos continuam **fora** do domínio financeiro serializado localmente | OK |

*(Demais linhas RB\*/CN\* desta matriz permanecem como catálogo de regressão quando houver necessidade futura de reexecutar fino; no fechamento v1.1 o critério de promoção foi o smoke estrutural acima + testes/rules automatizados listados.)*

---

## Histórico

| Data | Nota |
|------|------|
| 2026-05-03 | Criação da matriz planejável v1.1 alinhada à ordem de entrega oficial documentada (`readBy*` → `counteroffer`). |
| 2026-05-03 | **Fatia RB** — registro de promoção manual: código `7270409`, deploy de rules em **`agemp-financas-pro`**, smoke OK sem NOK crítico informado — LKG **`lkg-2026-05-03-loanrequest-v1-1-rb`**. |
| 2026-05-03 | **Fatia CN** implementada/corrigida até validação **real no app**; commits listados na seção CN; último patch **`4e8dcae`**; smoke manual integral OK; pacote nominal **v1.1 RB+CN** declarado **fechado** com LKG **`lkg-2026-05-03-loanrequest-v1-1`**. |

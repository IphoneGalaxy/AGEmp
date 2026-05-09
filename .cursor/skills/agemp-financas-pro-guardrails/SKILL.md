---
name: agemp-financas-pro-guardrails
description: >-
  Applies essential AGEmp / Finanças Pro guardrails for planning, ADRs, implementation,
  code review, QA, living documentation, continuity prompts, and changes touching the
  financial core, Firebase, storage, vínculos, loanRequests, main UI, or dashboard.
  Enforces local-first finance, Firebase only for identity/profile/roles/links and
  pre-financial flows, repository code and living docs as primary truth, and no remote
  financial sync or remote financial contracts without a dedicated ADR.
---

# AGEmp / Finanças Pro — Guardrails principais

Use esta skill sempre que a tarefa envolver o projeto AGEmp / Finanças Pro, especialmente:
- planejamento;
- ADR;
- implementação;
- revisão de código;
- QA;
- documentação viva;
- prompts de continuidade;
- mudanças em financeiro, Firebase, storage, vínculos, loanRequests, UI principal ou dashboard.

## Fontes de verdade

Prioridade das fontes:
1. Código real atual do repositório.
2. docs/HANDOFF_MASTER.md.
3. docs/CHECKPOINT_CHECKLIST.md.
4. docs/NEXT_PHASE_OFFICIAL.md.
5. ADRs vivos em docs/.
6. Matrizes QA vivas em docs/.
7. Project Rule como guardrail, não como fonte factual principal quando estiver desatualizada.
8. DESIGN.md / BRAND.md / PROJECT_OVERRIDES.md quando houver UI.

Nunca rebaixar o entendimento do sistema com base em documento antigo se o código real e o HANDOFF_MASTER mais recente indicarem outro estado.

## Guardrails de produto

- O núcleo financeiro é local-first.
- Firebase não é fonte financeira autoritativa.
- Firebase pode ser usado para identidade, perfil, papéis, vínculos e pedidos pré-financeiros.
- Não sincronizar contratos, caixa, pagamentos, dashboard ou saldos financeiros com Firebase sem ADR própria.
- Não criar contrato financeiro remoto sem ADR própria.
- Não criar payment.linkContext sem decisão explícita.
- Não alterar src/utils/calculations.js sem autorização explícita.
- Não misturar domínio local de fornecedor com domínio local de cliente.
- clients[] representa o controle local do fornecedor: “quem me deve”.
- clientDebtLedger representa o controle local do cliente: “para quem eu devo”.
- loanRequests são pré-financeiros e remotos; não criam dívida local automaticamente.
- Dívida local só nasce por ação explícita do usuário.

## Guardrails técnicos

- Antes de alterar código, identificar arquivos impactados.
- Evitar mudanças amplas em App.jsx sem justificar.
- Não alterar firestore.rules sem necessidade explícita e testes de rules.
- Se alterar firestore.rules, avisar que é necessário deploy das rules no projeto Firebase real.
- Não criar sync financeiro remoto por acidente.
- Não salvar dados financeiros dentro de documentos remotos de vínculo/pedido.
- Respeitar storage escopado por anonymous/account:{uid}.
- Não misturar clientDebtLedger com loanManagerData, clients[] ou loanRequestConversionRegistry.

## Guardrails de documentação

- Docs vivos ficam em docs/.
- docs/plans/completed/ é histórico, não plano ativo.
- ADRs devem registrar decisões, fora de escopo, riscos, testes e próxima ação.
- Não tratar backlog como implementado.
- Não alterar documentação sem deixar claro se é planejamento, fechamento ou ponteiro.

## Guardrails de UI

Quando mexer em UI:
- consultar DESIGN.md, BRAND.md e PROJECT_OVERRIDES.md;
- manter clareza, conforto visual, hierarquia e linguagem simples;
- esconder IDs técnicos da superfície principal;
- mostrar IDs apenas em detalhe opcional/avançado;
- separar claramente “Plataforma” de “Dados locais neste aparelho”.

## Saída esperada ao usar esta skill

Ao final de qualquer tarefa relevante, sempre informar:
- arquivos alterados;
- o que foi implementado;
- o que não foi alterado;
- testes executados;
- riscos/observações;
- sugestão de commit;
- se houve mudança em rules, informar necessidade de deploy.

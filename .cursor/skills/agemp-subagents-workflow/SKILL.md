---
name: agemp-subagents-workflow
description: >-
  Orchestrates AGEmp / Finanças Pro work through the global subagent pipeline
  pm-po → analyst → architect → dev → qa using Task with subagent_type in sequence,
  mandatory handoffs between steps, and no parallel Tasks that conflict on the same files.
  Use when the user requests real subagents, phase planning, high-risk implementation,
  changes to finance, storage, Firebase/rules, structural App.jsx edits, QA or phase
  closure, or prompts that name pm-po, analyst, architect, dev, or qa.
---

# AGEmp — Workflow de Subagents

Use esta skill quando uma tarefa pedir explicitamente uso dos subagents do projeto, especialmente em:
- planejamento de fase;
- implementação com risco;
- alterações em financeiro;
- alterações em storage;
- alterações em Firebase/rules;
- mudanças estruturais em App.jsx;
- QA e fechamento de fase;
- prompts de Cursor que exigem pm-po, analyst, architect, dev e qa.

## Subagents globais disponíveis

Os subagents globais configurados no Cursor são:

- pm-po
- analyst
- architect
- dev
- qa

Eles ficam configurados no perfil do usuário do Cursor, não necessariamente dentro do repositório.

## Regra principal

Quando o usuário pedir uso real dos subagents, não apenas simule os papéis.

Use a ferramenta Task com subagent_type em sequência:

1. Task subagent_type="pm-po"
2. Task subagent_type="analyst"
3. Task subagent_type="architect"
4. Task subagent_type="dev"
5. Task subagent_type="qa"

Nunca rode Tasks em paralelo quando elas puderem editar ou raciocinar sobre os mesmos arquivos.

## Responsabilidade de cada subagent

### pm-po

Objetivo:
- validar escopo;
- confirmar valor para o usuário;
- definir critérios de aceite;
- impedir aumento indevido da fase.

Permissões:
- não editar arquivos;
- não implementar;
- não rodar mudanças de código.

Saída esperada:
- escopo aprovado;
- fora de escopo;
- critérios de aceite;
- riscos de produto.

### analyst

Objetivo:
- validar regras de negócio;
- mapear estados;
- levantar exceções;
- identificar casos de borda;
- transformar o escopo em checklist testável.

Permissões:
- não editar arquivos;
- não implementar.

Saída esperada:
- regras funcionais;
- estados válidos/inválidos;
- casos de borda;
- checklist para dev/qa.

### architect

Objetivo:
- validar arquitetura;
- arquivos impactados;
- separação de domínios;
- riscos técnicos;
- dependências;
- plano mínimo de implementação.

Permissões:
- não editar arquivos;
- não implementar.

Saída esperada:
- desenho técnico;
- arquivos permitidos;
- arquivos proibidos;
- riscos;
- plano de implementação para dev.

### dev

Objetivo:
- implementar somente o escopo aprovado;
- respeitar os limites definidos por pm-po, analyst e architect;
- criar ou ajustar testes quando necessário.

Permissões:
- pode editar apenas os arquivos autorizados;
- pode rodar comandos de teste/build;
- não fazer commit sem autorização explícita.

Saída esperada:
- arquivos alterados;
- resumo da implementação;
- comandos executados;
- pendências.

### qa

Objetivo:
- revisar aderência ao escopo;
- validar regressões;
- rodar testes/build quando aplicável;
- produzir checklist de smoke.

Permissões:
- por padrão, não editar arquivos;
- se encontrar bug, relatar;
- só corrigir se o usuário autorizar explicitamente.

Saída esperada:
- testes executados;
- resultado;
- regressões possíveis;
- checklist de smoke;
- recomendação: aprovado / ajustar antes de commit.

## Handoff obrigatório entre subagents

Entre cada Task, o agente principal deve resumir o resultado anterior em 5–15 linhas e passar esse resumo para a próxima Task.

Formato do handoff:

- objetivo da etapa;
- decisões fechadas;
- arquivos permitidos/proibidos;
- riscos;
- critérios de aceite;
- pendências.

## Se não conseguir acionar subagents reais

Se o ambiente não permitir chamar Task/subagent_type, pare antes de implementar e informe:

“Não consegui acionar os subagents reais neste ambiente.”

Não implemente a tarefa se o usuário exigiu subagents reais.

## Entrega final esperada

Ao final, responder com:

1. Relatório dos subagents:
   - pm-po:
   - analyst:
   - architect:
   - dev:
   - qa:

2. Arquivos criados/alterados.
3. Resumo da implementação ou planejamento.
4. Testes executados.
5. Confirmação do que não foi alterado.
6. Riscos/observações.
7. Sugestão de commit.
8. Checklist de smoke manual, quando aplicável.

## Regras adicionais

- Não fazer commit sem autorização explícita.
- Não ampliar escopo.
- Não misturar planejamento, implementação e fechamento documental se a fase pediu apenas uma dessas coisas.
- Para tarefas simples, o usuário pode autorizar “lógica dos subagents” sem Tasks reais.
- Para tarefas críticas, usar Tasks reais.

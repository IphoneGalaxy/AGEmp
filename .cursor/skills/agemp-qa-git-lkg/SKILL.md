---
name: agemp-qa-git-lkg
description: >-
  Padroniza QA, validação, Git, commits e LKGs no AGEmp / Finanças Pro: Vitest,
  build npm, testes de Firestore rules quando existirem, smoke manual,
  Conventional Commits, push e tags LKG. Indicada no fechamento de fases ou
  entregas, após alterações em código, UI, firestore.rules, Firebase SDK,
  loanRequests remotos, links, roles, permissões ou documentação viva do projeto.
---

# AGEmp — QA, Git e LKG

Use esta skill no final de fases, subfases, implementações, ajustes de UI, alterações em Firestore Rules, documentação viva e fechamento de entregas no AGEmp / Finanças Pro.

## Testes padrão

Sempre que houver alteração em código:

- Rodar `npx vitest run`.
- Rodar `npm run build`.

Quando houver alteração em Firestore Rules, Firebase SDK, loanRequests remotos, links, roles ou permissões:

- Rodar também `npm run test:rules:loanRequests`, se existir no projeto.
- Informar explicitamente se as rules precisam de deploy no projeto Firebase real.

Quando houver alteração focada em util/helper específico:

- Rodar teste focado primeiro, por exemplo:
  `npx vitest run src/utils/__tests__/arquivo.test.js`
- Depois rodar a suíte geral.

## Smoke manual

Ao final da tarefa, gerar checklist curto de smoke manual com foco no fluxo alterado.

O checklist deve conter:
- fluxo feliz;
- estado vazio;
- caso legado quando aplicável;
- mobile/dark quando houver UI;
- troca de conta/escopo quando houver storage local;
- regressão principal.

## Git

Não fazer commit sem autorização explícita do usuário.

Quando sugerir commit, usar Conventional Commits:

- `feat(...)`
- `fix(...)`
- `docs(...)`
- `refactor(...)`
- `test(...)`
- `chore(...)`

Sempre sugerir comando completo:

`git status && git add <arquivos> && git commit -m "<mensagem>" && git push origin main`

Evitar `git add .` quando a tarefa tiver escopo sensível ou houver arquivos não rastreados não relacionados.

## Deploy de Firestore Rules

Se `firestore.rules` for alterado e os testes passarem, lembrar que o comportamento real só vale depois do deploy:

`npx -y firebase-tools@latest deploy --only firestore:rules --project agemp-financas-pro`

Não executar deploy automaticamente sem autorização explícita.

## LKG

Quando o usuário disser que “deu tudo certo” e declarar que a versão virou LKG, sugerir tag anotada:

`git tag -a lkg-AAAA-MM-DD -m "LKG AAAA-MM-DD: <descrição>"`

e push:

`git push origin lkg-AAAA-MM-DD`

Se já houver tag no mesmo dia, sugerir sufixo:

`lkg-AAAA-MM-DD-2`

## Relatório final

Ao final de cada tarefa, responder com:

1. Arquivos criados/alterados.
2. Resumo do que mudou.
3. Testes executados e resultados.
4. Smoke manual sugerido.
5. Confirmação do que não foi alterado.
6. Riscos/observações.
7. Sugestão de commit.
8. Comando git completo, se o usuário pedir commit.

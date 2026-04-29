# AGEmp / Finanças Pro — Checkpoint e checklist geral

## Status do documento

Documento de **acompanhamento** e **checklist** do projeto — complementa [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md); não o substitui.

**Papel (continuidade PM/PO):** registrar o que está **feito**, **validado**, **fora de escopo**, **congelado** e **provável a seguir**, para alinhamento rápido entre releases e sem reabrir decisões já consolidadas no código.

Leitura recomendada junto com:

1. código real do repositório  
2. [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md)  
3. prompt base permanente e prompts base dos subagents (quando aplicável)  
4. Project Rule (guardrail: limites, cautela, direção futura — trechos de “estado atual” na rule podem estar defasados; priorizar código + handoff)  
5. `DESIGN.md`, `BRAND.md`, `PROJECT_OVERRIDES.md` (UX/UI)

**Base estável de referência (LKG):** `lkg-2026-04-27-payment-linkcontext-display` · commit `e0de30c` — confirmar com `git tag` / `git rev-parse` ao retomar.

---

## 1. Visão geral consolidada

O Finanças Pro / AGEmp é uma aplicação web/PWA de empréstimos pessoais com **núcleo financeiro local-first** no navegador e **camada remota separada** para identidade e relacionamento (Firebase).

| Camada | O que persiste | Observação |
|--------|----------------|------------|
| Domínio financeiro local | clientes, contratos, pagamentos, caixa, dashboard, backups, preferências operacionais por escopo | `localStorage` particionado (`anonymous` · `account:{uid}`) |
| Identidade e vínculo remoto | Auth, perfil, `accountRoles`, vínculos fornecedor ↔ cliente | Firestore + regras da camada remota; **não** substitui dados financeiros na nuvem nesta fase |

**Diretriz central (congelada):** não misturar cedo demais o domínio financeiro local com o backend remoto.

---

## 2. Princípios estruturais já consolidados

- Núcleo financeiro permanece **local-first**.
- Domínio financeiro **não** está sincronizado com Firebase nesta fase.
- Identidade remota e vínculo remoto **não** implicam dados financeiros na nuvem.
- `accountRoles` é o shape principal; **role legado** permanece como fallback.
- `activeView` / `accountView` são **contexto de interface**, não modelo de autorização.
- Evolução incremental, reversível e testável.
- `calculations.js` é área crítica: sem mudança sem decisão explícita do projeto.
- `storage.js`, `autoBackup.js`, `storageScope.js`, `ClientView.jsx`, `public/sw.js`: cautela extrema.

---

## 3. Estrutura técnica estabelecida

### 3.1. Base tecnológica

React, Vite, JSX/JavaScript, `localStorage`, PWA (manifest + SW), Vitest, Firebase Auth + Firestore para camada remota de identidade/vínculos; `npm run build` em uso.

### 3.2. Base remota já funcional

Implementado e coberto por fluxos de UI + testes onde existentes:

- Auth **sem** gate global (uso local preservado).
- Perfil remoto em `users/{uid}`, edição de `displayName`, recuperação de senha.
- `accountRoles` com fallback para role legado.
- Conta/perfil compatíveis com fluxo “híbrido”.
- Vínculos fornecedor ↔ cliente no Firestore (`src/firebase/links.js`); fluxos mínimos de solicitação / aprovação / recusa / revogação na camada de conta.
- **Links** exercitados em ambiente real durante a consolidação (conforme promoção a LKGs); dados financeiros continuam locais.

### 3.3. Base local já robusta

- Persistência financeira, backup manual, importação, backup automático.
- Compatibilidade com formatos antigos.
- Escopo **`anonymous`** vs **`account:{uid}`** com reidratação ao trocar sessão.
- Decisão explícita de **legado** no primeiro login (fluxo implementado).
- Preferências de aparelho vs configurações por escopo distinguíveis onde aplicável.

---

## 4. Checklist — entregas já concluídas

### 4.1. Infraestrutura e identidade remota

- Integração Firebase (inicialização segura).
- Auth opcional; uso sem conta preservado.
- Área de conta/perfil na configurações.
- Perfil remoto mínimo; sincronização coerente `displayName` onde definido.
- Recuperação de senha.
- `accountRoles` como shape principal + fallback role legado.
- Camada remota de vínculos fornecedor ↔ cliente + UI mínima na conta.

### 4.2. Persistência local e escopo

- Persistência financeira consolidada.
- Backup / import / auto-backup.
- Compatibilidade com dados legados.
- Separação por escopo e reidratação.
- Decisão explícita de legado no primeiro login.
- Clareza operacional entre identidade remota e dados financeiros locais.

### 4.3. Clareza de contexto e UX estrutural

- Modo sem conta, conta autenticada com dados financeiros vazios no aparelho, separação identidade vs financeiro vs legado.
- Mobile-first e navegação principal por estado (sem React Router).
- Sem redesign amplo; linguagem sem prometer sync financeiro remoto inexistente.

### 4.4. Linha `linkContext` v1 — **cliente** (`client.linkContext`)

Metadado local opcional (`version`, `linkId`, `supplierId`, `clientId`, `associatedAt`); sem impacto em cálculos; sem sync financeiro remoto.

- Primeiro portador do contexto no cadastro local.
- Associação e remoção individuais; leitura no `ClientView`.
- Microcopy clara onde aplicável.
- Filtro por presença de anotação (Todos / Com / Sem).
- Organização/refino por `linkId`; estados vazios e indicadores discretos na lista.
- Criação de cliente com **herança opcional** do vínculo ativo (checkbox explícito, reversível).
- Operações em **lote** (seleção, anotação/remoção com regras conservadoras — não sobrescrever outro vínculo sem critério explícito); seleção efêmera.

### 4.5. Linha `linkContext` v1 — **contrato** (`loan.linkContext`)

- Herança **opcional** na criação do empréstimo a partir do cliente quando aplicável (`loanLinkContextInherit`).
- Filtro visual de contratos: Todos / Com anotação / Sem anotação (`loanLinkContextFilter`).
- Gestão **manual** local da anotação no contrato (adicionar/remover) (`loanLinkContextManage`).
- Contrato pode divergir do cliente (snapshot por empréstimo).

### 4.6. Linha `linkContext` v1 — **pagamento** (somente UI)

- Exibição **derivada** na lista de pagamentos a partir de `loan.linkContext` (`paymentLinkContextDisplay` / uso em `ClientView`).
- **`payment.linkContext` não é persistido**; motor financeiro não consome vínculo.

### 4.7. Trilha `linkContext` — síntese

Fluxo já consolidado no código:

**cliente → contrato (`loan`) → lista de pagamentos (exibição derivada)**

Sempre como: metadado local opcional, leitura operacional; **sem** alterar `calculations.js`; **sem** sync financeiro remoto deste domínio.

---

## 5. Validado

### 5.1. Validação técnica (automática)

- `npx vitest run` estável nas fases recentes (quantidade atual de testes: validar no repo ao retomar).
- `npm run build` após mudanças sensíveis.
- Testes de Firebase, storage/escopo/settings/backup preservados/ampliados.
- Testes adicionais na linha `linkContext`: modelagem, filtros cliente, organização, herança criação cliente, lote, contrato (herança/filtro/gestão), exibição em pagamentos.

### 5.2. Validação manual

- Fluxos das fases recentes exercitados ao longo do desenvolvimento.
- Promoção sucessiva a **LKGs** ao estabilizar fatias.

### 5.3. Lacuna consciente (não é ausência de QA)

- **Matriz QA manual única** ainda não existe como documento consolidado; isso **não** implica falta de validação prática — apenas registro único pendente para regressão sistemática.

---

## 6. Decisões congeladas que permanecem válidas

- Núcleo financeiro **local-first**.
- Não sincronizar domínio financeiro com Firebase sem desenho e aprovação explícitos.
- Não ligar contratos/pagamentos/caixa/dashboard ao remoto como **domínio financeiro** nesta fase.
- `accountRoles` principal; role legado em fallback.
- `activeView` / `accountView` ≠ permissão.
- `linkContext` v1: local, opcional, reversível, **sem** impacto em cálculo.
- Navegação principal sem redesenho estrutural amplo por capricho.
- Preferir mudanças pequenas, reversíveis e testáveis.
- **`calculations.js` intocado** na linha de evolução já consolidada até o LKG atual (salvo revisão formal do motor).

---

## 7. Fora do escopo atual

- Sync remoto do **domínio financeiro**.
- Persistir **`payment.linkContext`** (snapshot por pagamento) sem decisão/ADR próprios.
- Regras em `calculations.js` baseadas em vínculo sem plano explícito.
- Contratos/pagamentos/caixa/dashboard como **coleções financeiras remotas** autoritativas.
- Dashboard por vínculo remoto ou “dashboard financeiro na nuvem”.
- Múltiplos vínculos por cliente local (salvo produto definir).
- Automations/notificações Firebase atacando dados financeiros locais antes da hora.
- Remoção do role legado sem migração planejada.
- Refatoração ampla do motor financeiro sem necessidade clara.
- IndexedDB como camada financeira obrigatória.
- Service worker cacheando dados financeiros dinâmicos.
- Tratar login como sinônimo de “financeiro na nuvem”.

---

## 8. Estado atual do `linkContext` (por camada)

| Camada | Campo | Papel hoje |
|--------|--------|------------|
| Cliente | `client.linkContext` | Contexto amplo do cadastro local; lista, refinamento, lote, heranças. |
| Contrato | `loan.linkContext` | Snapshot local opcional; pode divergir do cliente; filtro e CRUD manual local da anotação. |
| Pagamento | *(nenhum campo persistido)* | Só repetição visual derivada de `loan.linkContext` na UI. |

**Ainda não faz (implícito):** garantir status remoto em tempo real; reconciliar automaticamente com a nuvem; auditoria imutável por pagamento; substituir histórico financeiro real; alterar motor ou caixa/dashboard por vínculo.

---

## 9. Próximas fases e próximo foco **provável**

### 9.1. Próximo foco conservador (imediato, sem nova feature obrigatória)

- Opcionalmente **formalizar matriz QA única** (checklist curto: dois escopos, cliente → contrato → pagamento, backup/import, fluxos de conta/vínculo). **Pacote relacionado já iniciado:** [`QA_MATRIX_LINK_OPERATIONAL_VIEW.md`](./QA_MATRIX_LINK_OPERATIONAL_VIEW.md) + decisão/recorte [`LINK_OPERATIONAL_VIEW.md`](./LINK_OPERATIONAL_VIEW.md).
- Manter documentos vivos (`HANDOFF_MASTER`, este checkpoint) atualizados ao fechar fases ou novos LKGs.

### 9.2. Decisão de produto (quando houver demanda; **não** implementação automática)

- Pagamentos devem ter **snapshot próprio** (`payment.linkContext`) no futuro ou permanecer **apenas espelho do contrato**?  
  Depende de requisitos de histórico imutável e possível sync futuro — ver [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md).

### 9.3. Médio prazo (direção, não compromisso de sprint)

- Aproximação gradual entre contexto relacional remoto e domínio financeiro local **só** com desenho explícito.
- Leituras operacionais adicionais por vínculo **sem** virar backend financeiro autoritativo até decisão contrária.

### 9.4. Longo prazo (alinhado à visão do produto / Project Rule)

- Pedidos, filas, contrapropostas, notificações, eventual conversão pedido → contrato, eventual **sync financeiro remoto** — **apenas se e quando** houver desenho aprovado; não tratar como implementado.

---

## 10. Condição de “trilha” satisfatória para a fatia atual

A trilha **`linkContext` v1 no fluxo operacional local (cliente → contrato → exibição em pagamento)** está **consolidada** no estado do LKG referenciado acima, com motor financeiro íntegro, escopos e backups preservados.

Evoluções além disso (snapshot por pagamento, sync remoto financeiro, regras por vínculo) exigem **fases e decisões explícitas**, não continuidade automática da mesma fatia.

---

## 11. Resumo executivo

| Dimensão | Situação |
|----------|----------|
| **Concluído (alto nível)** | Base remota identidade/vínculo; escopo local + legado; clareza de contexto; `linkContext` v1 em cliente, contrato e UI de pagamentos (derivada); testes e LKGs na linha. |
| **Validado** | Automático recorrente + manual ao longo das fases; matriz QA única ainda opcional como documento. |
| **Congelado** | Local-first financeiro; sem sync financeiro remoto; `calculations.js` na linha preservada; Firebase não como fonte financeira. |
| **Fora de escopo** | Sync financeiro remoto; `payment.linkContext` persistido sem ADR; motor por vínculo sem plano. |
| **Próximo foco real (provável)** | Estabilização documental + QA consolidado opcional; decisão futura explícita sobre snapshot por pagamento — **não** reabrir implementação de contrato/pagamento da trilha já fechada. |

---

## 12. Ordem em caso de conflito entre fontes

1. Código / estado confirmado no repositório  
2. [`HANDOFF_MASTER.md`](./HANDOFF_MASTER.md)  
3. Este checkpoint (acompanhamento; pode evoluir entre releases)  
4. Prompt base / subagents  
5. Project Rule como guardrail (sem reimportar “estado atual” desatualizado como verdade factual)  
6. `DESIGN.md` · `BRAND.md` · `PROJECT_OVERRIDES.md` para UI  

---

## 13. Histórico de atualizações do checkpoint

| Data | Nota |
|------|------|
| 2026-04-29 | Pacote inicial de **visão operacional local por vínculo**: `LINK_OPERATIONAL_VIEW.md`, utilitários `linkOperationalDerive`, QA `QA_MATRIX_LINK_OPERATIONAL_VIEW`; refinamento enriquecido na lista de clientes. |

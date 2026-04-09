# DESIGN.md

## Objetivo
Este arquivo define o sistema visual base e os princípios de experiência do projeto.

Ele deve orientar:
- layout
- componentes
- espaçamento
- tipografia
- cores
- estados visuais
- consistência entre telas
- conforto visual
- responsividade
- escrita da interface

Este é o principal documento operacional de UI.

---

## Identidade visual
Este projeto segue uma assinatura visual com foco em:
- clareza
- leveza
- elegância discreta
- conforto visual
- fácil entendimento
- sensação premium sem exagero

A interface deve parecer:
- amigável
- minimalista
- moderna
- bem cuidada
- confiável
- organizada
- simples de entender

O objetivo não é impressionar com excesso visual, mas transmitir refinamento, segurança e facilidade de uso.

---

## Papel deste arquivo
Este arquivo define:
- padrões estruturais de interface
- sistema visual base
- comportamento esperado de componentes
- hierarquia visual
- decisões preferenciais de UI

Se houver conflito:
- `PROJECT_OVERRIDES.md` ajusta contexto específico do projeto
- `DESIGN.md` define os padrões estruturais e operacionais de interface
- `BRAND.md` orienta sensação geral, identidade e direção emocional

Overrides nunca devem quebrar:
- clareza
- legibilidade
- acessibilidade
- consistência
- conforto visual

Em caso de conflito forte, sinalizar antes de implementar.

---

## Princípios da interface

### 1. Clareza acima de tudo
O usuário deve entender rapidamente:
- onde está
- o que é mais importante
- o que pode fazer agora

### 2. Conteúdo em primeiro plano
O layout deve servir ao conteúdo e à tarefa.
Os elementos visuais nunca devem competir com a informação principal.

### 3. Minimalismo com personalidade
Reduzir ruído visual sem criar uma interface fria, genérica ou sem vida.

### 4. Hierarquia visual forte
Títulos, seções, dados importantes, ações e estados devem ser percebidos sem esforço.

### 5. Conforto visual prolongado
A interface deve ser agradável mesmo após uso contínuo.

### 6. Consistência obsessiva
Componentes equivalentes devem ter aparência e comportamento equivalentes em todas as telas.

---

## Em caso de dúvida
Quando houver mais de uma solução visual possível, priorizar nesta ordem:
1. clareza
2. legibilidade
3. consistência
4. conforto visual
5. refinamento estético

---

## Personalidade da UI
A interface deve transmitir:
- calma
- confiança
- sofisticação leve
- acolhimento
- organização
- objetividade

Evitar aparência:
- agressiva
- poluída
- cansativa
- infantilizada
- fria demais
- técnica demais
- genérica de dashboard lotado

---

## Tokens de design

### Cores base

#### Neutros claros
- `color-bg`: `#F7F7F5`
- `color-surface`: `#FFFFFF`
- `color-surface-muted`: `#F2F2EF`
- `color-border`: `#E5E7EB`
- `color-border-strong`: `#D1D5DB`

#### Texto
- `color-text`: `#111827`
- `color-text-soft`: `#4B5563`
- `color-text-muted`: `#6B7280`
- `color-text-inverse`: `#FFFFFF`

#### Primária
- `color-primary`: `#2563EB`
- `color-primary-hover`: `#1D4ED8`
- `color-primary-soft`: `#DBEAFE`
- `color-primary-ring`: `rgba(37, 99, 235, 0.22)`

#### Semânticas
- `color-success`: `#16A34A`
- `color-success-soft`: `#DCFCE7`
- `color-warning`: `#D97706`
- `color-warning-soft`: `#FEF3C7`
- `color-danger`: `#DC2626`
- `color-danger-soft`: `#FEE2E2`
- `color-info`: `#0EA5E9`
- `color-info-soft`: `#E0F2FE`

### Dark mode

#### Fundos e superfícies
- `color-bg-dark`: `#0B0D10`
- `color-surface-dark`: `#111418`
- `color-surface-muted-dark`: `#171B21`
- `color-border-dark`: `#252B34`
- `color-border-strong-dark`: `#374151`

#### Texto
- `color-text-dark`: `#F3F4F6`
- `color-text-soft-dark`: `#D1D5DB`
- `color-text-muted-dark`: `#9CA3AF`

#### Primária dark
- `color-primary-dark`: `#60A5FA`
- `color-primary-soft-dark`: `rgba(96, 165, 250, 0.16)`
- `color-primary-ring-dark`: `rgba(96, 165, 250, 0.30)`

---

## Tipografia

### Fonte
Preferência:
- `font-sans`: `"Inter", "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif`

### Escala
- `font-size-xs`: `12px`
- `font-size-sm`: `14px`
- `font-size-md`: `16px`
- `font-size-lg`: `18px`
- `font-size-xl`: `20px`
- `font-size-2xl`: `24px`
- `font-size-3xl`: `30px`

### Pesos
- `font-weight-regular`: `400`
- `font-weight-medium`: `500`
- `font-weight-semibold`: `600`
- `font-weight-bold`: `700`

### Altura de linha
- `line-height-tight`: `1.2`
- `line-height-normal`: `1.5`
- `line-height-relaxed`: `1.65`

---

## Espaçamento
- `space-1`: `4px`
- `space-2`: `8px`
- `space-3`: `12px`
- `space-4`: `16px`
- `space-5`: `20px`
- `space-6`: `24px`
- `space-8`: `32px`
- `space-10`: `40px`
- `space-12`: `48px`
- `space-16`: `64px`

Regras:
- a interface deve respirar
- preferir respiro generoso
- evitar blocos apertados
- evitar excesso de informação no mesmo agrupamento visual

---

## Bordas e arredondamento
- `radius-sm`: `10px`
- `radius-md`: `14px`
- `radius-lg`: `18px`
- `radius-xl`: `24px`
- `radius-pill`: `999px`

Padrão:
- botões e inputs: `14px`
- cards: `18px`
- modais: `24px`

---

## Sombras
- `shadow-sm`: `0 1px 2px rgba(16, 24, 40, 0.04)`
- `shadow-md`: `0 8px 24px rgba(16, 24, 40, 0.08)`
- `shadow-lg`: `0 16px 40px rgba(16, 24, 40, 0.10)`

Regras:
- usar sombra com moderação
- priorizar elevação suave
- não usar sombras pesadas como padrão

---

## Motion
- `duration-fast`: `120ms`
- `duration-normal`: `180ms`
- `duration-slow`: `260ms`
- `ease-standard`: `cubic-bezier(0.2, 0.8, 0.2, 1)`

Regras:
- motion deve ser curto, suave e funcional
- usar para feedback, mudança de estado, foco e entrada/saída de elementos
- evitar animação chamativa

---

## Layout

### Estrutura geral
- mobile-first
- fluxo vertical claro
- largura confortável para leitura
- no desktop, usar múltiplas colunas apenas quando melhorar a compreensão

### Larguras recomendadas
- conteúdo principal: `960px` a `1200px`
- formulários: `560px` a `720px`
- blocos de leitura: evitar linhas excessivamente longas

### Densidade
Evitar:
- cards demais na mesma linha
- cabeçalhos pesados
- muitas ações concorrendo no topo
- tabelas muito densas sem necessidade

---

## Componentes

### Botão primário
- fundo com `color-primary`
- texto branco
- hover com `color-primary-hover`
- foco visível com `color-primary-ring`
- altura mínima: `44px`
- padding horizontal confortável
- fonte com peso `600`
- raio `14px`

### Botão secundário
- fundo discreto ou transparente
- borda suave
- texto com bom contraste
- hover sutil
- nunca competir com o botão primário

### Inputs
- altura mínima `44px`
- label clara
- borda sutil
- foco elegante e visível
- erro curto e objetivo
- raio `14px`

### Cards
- fundo `color-surface`
- borda sutil
- sombra leve opcional
- padding entre `20px` e `24px`
- raio `18px`

Uso:
- agrupar conteúdo
- destacar blocos importantes
- evitar card dentro de card sem necessidade

### Tabelas
- leitura rápida
- bom espaçamento entre linhas
- cabeçalho discreto e claro
- números fáceis de escanear
- ações visíveis sem poluição
- no mobile, adaptar para listas ou cards

### Modais
- raio `24px`
- estrutura simples
- título forte
- texto curto
- ação principal evidente
- evitar rolagem longa

### Alertas e feedback
- claros
- curtos
- sem dramatização visual
- usar cor semântica com fundo soft
- não depender só de cor para comunicar o estado

---

## Hierarquia tipográfica

### Página
- título principal: `30px`, `700`
- subtítulo: `16px`, `400` ou `500`, cor suave

### Seção
- título de seção: `20px`, `600`
- descrição de apoio: `14px` ou `16px`, cor suave

### Conteúdo
- texto principal: `16px`
- texto auxiliar: `14px`
- legenda/metadado: `12px`

### Dados importantes
- números, saldos, totais e indicadores devem ter contraste alto e leitura imediata
- evitar estilos decorativos em informações críticas

---

## Ícones
- simples
- poucos
- consistentes
- sempre com função real

Evitar:
- excesso de ícones decorativos
- misturar estilos muito diferentes de ícones

---

## Acessibilidade
Sempre garantir:
- contraste suficiente
- foco visível
- área de toque confortável
- texto legível
- estados claros
- informação não dependente apenas de cor

---

## Responsividade
Prioridade total para mobile:
- empilhamento natural
- ações principais acessíveis
- boa área de toque
- conteúdo principal visível sem esforço
- densidade reduzida em telas pequenas

---

## Escrita da interface
O tom da interface deve ser:
- humano
- direto
- gentil
- claro
- sem tecnicismo desnecessário

Preferir:
- “Salvar alterações”
- “Tente novamente”
- “Nenhum resultado encontrado”

Evitar:
- mensagens robóticas
- textos vagos
- labels técnicas demais

---

## Tradução prática da identidade visual
A assinatura visual deve aparecer em:
- espaçamentos generosos
- superfícies limpas
- poucos elementos competindo por atenção
- CTAs claros e não agressivos
- contraste confortável
- tipografia legível
- ícones discretos e úteis
- organização visual previsível

---

## O que fazer
- usar bastante respiro
- dar destaque ao essencial
- manter consistência forte
- criar sensação premium por refinamento
- usar cores com função
- manter legibilidade como prioridade

## O que evitar
- poluição visual
- excesso de cor
- bordas pesadas
- sombras fortes demais
- muitos botões primários na mesma área
- visual carregado
- componentes inconsistentes entre telas

---

## Instruções para agentes

### Architect
Ao propor frontend, layout, grid, design system ou componentes reutilizáveis:
- usar este arquivo como referência principal de consistência visual e estrutural
- não propor padrões que conflitem com este documento

### Dev
Antes de criar ou alterar qualquer interface:
- consultar este arquivo
- reutilizar padrões definidos
- não inventar novos estilos sem necessidade
- justificar rapidamente se alguma decisão fugir do padrão

### QA
Ao revisar interface:
- validar clareza
- validar consistência visual
- validar responsividade
- validar acessibilidade básica
- validar conforto visual e hierarquia

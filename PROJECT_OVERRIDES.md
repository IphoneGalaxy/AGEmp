# PROJECT_OVERRIDES.md

## Objetivo
Este arquivo ajusta a assinatura visual padrão para as necessidades específicas do projeto **Finanças Pro**.

Ele complementa o `DESIGN.md` e o `BRAND.md`, sem substituir seus princípios centrais.

---

## Tipo de produto
- app financeiro
- painel operacional leve
- sistema de uso recorrente
- interface orientada a leitura, registro e acompanhamento rápido

---

## Contexto do projeto
O **Finanças Pro** é um app web/PWA de controle de empréstimos pessoais com foco em:
- clientes
- contratos
- pagamentos
- caixa
- pendências mensais
- backup
- configurações

A interface deve favorecer uso frequente, leitura rápida e segurança operacional. A estrutura atual do projeto indica um frontend enxuto em React/Vite com organização simples e sem sinais de uma UI muito pesada ou de um design system grande já implantado. 

---

## Prioridades visuais do projeto
Priorizar fortemente:
- clareza de números, saldos, totais e pendências
- leitura rápida de informações financeiras
- boa separação entre blocos operacionais
- baixo esforço cognitivo no mobile
- formulários fáceis de preencher
- navegação simples e direta
- sensação de controle, organização e confiança

---

## Sensação desejada neste projeto
A interface deste app deve transmitir:
- segurança
- clareza
- controle
- organização
- agilidade
- confiança
- leve sofisticação

Evitar aparência:
- excessivamente decorativa
- lúdica demais
- fria e burocrática demais
- visualmente carregada
- densa no mobile
- com destaque excessivo em muitos elementos ao mesmo tempo

---

## Componentes mais importantes
Os componentes mais importantes deste projeto são:
- formulários
- listas de clientes
- blocos de contrato
- blocos de pagamentos
- áreas de resumo financeiro
- modais de confirmação
- feedbacks de sucesso, erro e confirmação
- ações principais de cadastro, edição, exclusão e registro

---

## Diretrizes específicas para layout

### Mobile
- priorizar empilhamento vertical
- manter ações principais facilmente acessíveis
- evitar muitas ações concorrendo na mesma dobra da tela
- reduzir ruído visual
- manter boa distância entre blocos clicáveis
- favorecer leitura em sequência lógica

### Desktop
- usar múltiplas colunas apenas quando isso melhorar a leitura e a comparação de dados
- evitar visual de dashboard carregado
- evitar distribuir informação crítica em áreas muito afastadas entre si

---

## Diretrizes específicas para informação financeira
- números, saldos, pendências e totais devem ter alta legibilidade
- valores monetários devem ter destaque visual superior ao texto auxiliar
- dados críticos devem ser fáceis de escanear rapidamente
- metadados e textos secundários devem existir, mas sem competir com os números principais
- evitar excesso de elementos decorativos próximos de informações financeiras importantes

---

## Diretrizes específicas para formulários
- formulários devem parecer simples, organizados e leves
- labels devem ser claras e diretas
- campos relacionados devem estar visualmente agrupados
- erros devem ser objetivos e fáceis de corrigir
- ações primárias como salvar, registrar e confirmar devem ficar muito claras
- evitar formulários longos com sensação pesada
- priorizar fluidez operacional acima de ornamentação visual

### Exceção prática aprovada para controles inline compactos
- inputs principais seguem altura mínima de `44px`
- botões principais seguem altura mínima de `44px`
- em fluxos inline compactos, controles podem usar `40px` quando isso preservar melhor o layout mobile e a clareza operacional
- essa exceção deve ser usada com moderação e apenas quando `44px` piorar a densidade do fluxo sem ganho real de usabilidade

---

## Diretrizes específicas para listas e blocos operacionais
- favorecer leitura rápida
- facilitar identificação do cliente e do estado atual
- ações recorrentes devem ser fáceis de localizar
- evitar poluição com botões, badges ou chips em excesso
- usar hierarquia clara entre nome, status, resumo financeiro e ações
- cada bloco deve ter foco claro e função evidente

---

## Diretrizes específicas para modais
- modais devem ser curtos, objetivos e focados
- evitar modais com rolagem longa, salvo necessidade real
- título forte e direto
- ação principal clara
- ação destrutiva com contraste e sem ambiguidade
- priorizar entendimento rápido do que será confirmado ou alterado

---

## Diretrizes específicas para feedback visual
- sucesso, erro, aviso e informação devem ser fáceis de distinguir
- usar semântica de cor com moderação
- não depender apenas da cor para indicar estado
- mensagens devem ser curtas, úteis e humanas
- evitar feedback excessivamente chamativo

---

## Ajustes permitidos neste projeto
- aumentar destaque visual de números e totais
- reforçar contraste em informações financeiras críticas
- simplificar cabeçalhos e áreas de navegação
- reduzir densidade de certos blocos no mobile
- usar semântica visual clara para pendências, atenção e confirmação
- dar destaque controlado para ações principais quando houver ação operacional importante

---

## Ajustes proibidos neste projeto
- criar visual agressivo ou chamativo demais
- transformar o app em dashboard carregado
- usar muitos destaques simultâneos
- comprometer legibilidade de números
- usar excesso de badges, etiquetas ou elementos decorativos
- densificar demais a interface no mobile
- esconder ações importantes atrás de excesso de navegação
- sacrificar clareza por estética

---

## Prioridade de leitura visual
Quando houver disputa por atenção na tela, priorizar nesta ordem:
1. valores e informações críticas
2. ação principal da tela
3. contexto do bloco atual
4. ações secundárias
5. informações auxiliares

---

## Semântica visual recomendada para este projeto
Usar estados visuais com moderação e clareza.

Sugestão de leitura:
- sucesso / recebido / confirmado → verde
- atenção / pendência / aviso → âmbar ou laranja suave
- erro / risco / exclusão → vermelho
- informação / contexto / apoio → azul
- texto secundário / metadado → neutros suaves

---

## Escrita da interface neste projeto
A linguagem da interface deve ser:
- humana
- simples
- direta
- confiável
- respeitosa
- sem jargão desnecessário

Preferir textos como:
- “Salvar alterações”
- “Registrar pagamento”
- “Criar contrato”
- “Excluir contrato”
- “Nenhum cliente encontrado”
- “Tente novamente”
- “Backup gerado com sucesso”

Evitar:
- mensagens robóticas
- excesso de formalidade
- frases técnicas demais para ações comuns
- textos vagos em confirmações e erros

---

## Regra final de override
Neste projeto, a estética deve sempre servir ao fluxo operacional e à clareza das informações financeiras.

Se houver dúvida entre:
- algo mais bonito
- algo mais claro e rápido de usar

priorizar o que for:
- mais claro
- mais seguro
- mais legível
- mais fácil de operar

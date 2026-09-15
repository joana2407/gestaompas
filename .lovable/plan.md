# Recuperar a formatação visual original da Manus

## Objetivo
Aplicar à ferramenta atual a organização visual do projeto original da Manus, mantendo intactos os dados, permissões por PIN e funcionalidades já implementadas.

## Alterações
- Substituir o menu horizontal pelo menu lateral original, dividido em **Principal**, **Gestão** e **Documentos**, apenas com as áreas válidas: Dashboard, Fábricas, Matérias-primas, Fornecedores e Documentação.
- Manter a barra superior compacta com título, descrição, ações da página e opção para trocar de utilizador.
- Recuperar a navegação móvel do original: menu deslizante e barra inferior com acessos principais.
- Replicar a paleta verde institucional, fundo cinza-claro, tipografia, dimensões, sombras e cartões do original.
- Ajustar o dashboard ao padrão visual original, com indicadores acompanhados por ícones e blocos de alertas mais fáceis de distinguir.
- Harmonizar a página de entrada com a identidade “Gestão Matérias Primas A&S”.
- Preservar o conteúdo e os formulários atuais das restantes páginas, que herdarão automaticamente a nova estrutura visual.

## Validação
- Confirmar entrada por PIN, navegação e saída.
- Verificar Dashboard, Fábricas, Matérias-primas, Fornecedores e Documentação em computador e telemóvel.
- Confirmar que não existem sobreposições, cortes de texto ou erros visuais.

## Detalhes técnicos
- Reutilizar os tokens visuais e a composição do projeto Manus como referência direta.
- Manter TanStack Start e todos os acessos protegidos existentes.
- Não acrescentar RASFF, Food Fraud ou Receções do projeto Manus.

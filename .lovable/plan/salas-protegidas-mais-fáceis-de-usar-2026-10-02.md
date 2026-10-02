# Salas protegidas mais fáceis de usar

## O que será alterado
- Exibir um botão destacado **Criar sala** no topo do mapa somente para administradores.
- Abrir o formulário de nome, descrição, camada e senha diretamente por esse botão.
- Manter no painel administrativo a troca de senha e exclusão das salas existentes.
- Remover a lista de salas da barra lateral; a entrada acontecerá somente pelos círculos do mapa.
- Fazer cada círculo bloqueado abrir a janela de senha e, após validação, entrar na sala.
- Manter o acesso liberado até o administrador trocar a senha, quando os acessos anteriores serão revogados.
- Ajustar os textos do menu móvel para refletir que ele contém apenas membros e conta.

## Verificação
- Testar como administrador: botão visível, formulário abre e mapa continua exibindo as salas.
- Testar o clique em uma sala bloqueada e a solicitação de senha.
- Confirmar que a barra lateral não exibe mais a lista de salas.
- Confirmar que a aplicação abre sem erros em desktop e celular.

## Detalhes técnicos
- Reutilizar o formulário administrativo e a validação existentes, sem alterar as regras de segurança do banco.
- Preservar os acessos persistidos por usuário e a revogação automática na troca de senha.

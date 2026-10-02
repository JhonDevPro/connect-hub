# Editar salas e escolher ícones

## O que será alterado
- Transformar cada sala existente no painel em um item editável, com ação **Editar**.
- Abrir um formulário preenchido com nome, descrição, camada do círculo, senha e ícone atual.
- Permitir salvar nome, descrição, camada e ícone juntos; a senha só será trocada quando uma nova for informada.
- Manter a troca de senha revogando os acessos antigos, como acontece hoje.
- Adicionar uma grade visual de ícones apropriados para salas (trabalho, projeto, clientes, vídeo, equipe, dados e outros), com seleção clara.
- Usar o ícone escolhido dentro da bolinha da sala no mapa; salas antigas receberão um ícone padrão compatível com sua camada.
- Manter criação, exclusão e visualização de senha no mesmo painel.

## Verificação
- Criar uma sala escolhendo camada e ícone, e confirmar que ela aparece corretamente no mapa.
- Editar nome, descrição, camada e ícone de uma sala existente e confirmar a atualização imediata do círculo.
- Trocar a senha pelo formulário de edição e confirmar a revogação do acesso anterior.
- Confirmar que salvar sem preencher uma nova senha preserva a senha atual.
- Conferir o painel e o mapa em desktop e celular.

## Detalhes técnicos
- Adicionar à sala um campo `icon` com valor padrão e restrição aos ícones oferecidos pela interface.
- Centralizar o catálogo de ícones para que o formulário e o mapa usem exatamente os mesmos nomes e componentes Lucide.
- Atualizar os tipos e consultas de salas para carregar o ícone.
- Executar alterações de sala e senha usando as políticas administrativas já existentes, sem expor senhas para usuários comuns.

# Melhorias de chamada, mapa e chat

## Objetivo
Implementar somente as funções solicitadas, mantendo salas protegidas, chamada P2P e limite de 10 participantes.

## Chamada
- Reconectar automaticamente após perda temporária de internet ou queda de uma conexão entre participantes, com tentativas graduais e sem pedir nova permissão de câmera.
- Mostrar estado visível da chamada: **Conectando**, **Conectado**, **Conexão instável** ou **Reconectando**.
- Medir periodicamente perda de pacotes e tempo de resposta das conexões para detectar qualidade fraca.
- Quando a conexão estiver fraca, exibir a ação **Usar somente áudio**, desligando o envio de vídeo sem sair da chamada.
- Adicionar compartilhamento de tela, janela ou aba pelo seletor nativo do navegador, com troca segura entre câmera e apresentação.
- Permitir entrar com câmera e/ou microfone desligados e lembrar essas preferências no dispositivo.
- Adicionar **Levantar a mão**, sincronizado ao vivo com todos da sala e visível no vídeo e na lista de membros.

## Mapa de salas
- Fazer o diagrama ocupar melhor o espaço disponível em telas grandes e continuar legível em celular.
- Mostrar em cada círculo quantas pessoas estão online naquela sala, usando a presença já existente e sem revelar membros de salas às quais o usuário não tem acesso.

## Chat
- Adicionar contador de mensagens não lidas no botão do chat e limpar ao abrir o painel.
- Permitir responder a uma mensagem, mostrando a referência acima da nova mensagem.
- Adicionar reações rápidas por usuário, com contagem e atualização ao vivo.
- Mostrar “alguém está digitando” por alguns segundos usando eventos temporários da sala.
- Destacar menções `@nome` e sugerir membros da sala enquanto o usuário digita.
- Exibir notificação discreta quando chegar mensagem com o painel fechado.

## Dados e segurança
- Criar os campos/tabelas necessários para respostas e reações com acesso restrito aos membros autorizados da sala.
- Manter digitação, mão levantada, qualidade e estados de conexão como eventos temporários, sem gravá-los no histórico.
- Atualizar as mensagens ao vivo para criação, edição de reação e referências de resposta.

## Validação
- Verificar compilação e erros em execução.
- Testar mapa em desktop e celular.
- Testar entrada com câmera/microfone desligados, compartilhamento de tela e ação de somente áudio.
- Testar mensagens não lidas, resposta, reação, menção, digitação e notificação com duas sessões quando houver contas disponíveis.

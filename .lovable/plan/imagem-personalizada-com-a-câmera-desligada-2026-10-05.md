# Imagem personalizada com a câmera desligada

## Objetivo
Permitir que cada usuário escolha uma imagem de exibição própria, válida em todas as salas e dispositivos, para substituir a inicial quando sua câmera estiver desligada.

## Experiência
- Adicionar a ação **Escolher imagem** antes de entrar e nos controles da chamada.
- Aceitar imagens comuns, validar tamanho e formato e mostrar uma prévia antes de salvar.
- Permitir **Trocar imagem** e **Remover imagem**; ao remover, volta a aparecer a inicial do nome.
- Exibir a imagem escolhida para todos os participantes quando a câmera estiver desligada.
- Manter nome, estado do microfone, mão levantada e volume individual funcionando normalmente.

## Exibição da imagem
- Usar ajuste proporcional equivalente a `contain`: a foto sempre aparece inteira, sem esticar e sem cortar.
- Imagens quadradas deixam espaços laterais no quadro horizontal; imagens verticais ou horizontais recebem o espaço necessário ao redor.
- Centralizar a foto sobre o fundo escuro atual da câmera desligada.
- Não espelhar a imagem e preservar o comportamento atual da câmera e do compartilhamento de tela.

## Persistência e segurança
- Guardar a imagem em uma área privada de arquivos de perfil.
- Salvar no perfil apenas a referência do arquivo, com alteração permitida somente pelo próprio usuário.
- Distribuir a referência temporária pela presença da sala, para que os demais participantes vejam a imagem sem tornar o arquivo público.
- Substituir ou apagar o arquivo anterior ao trocar/remover a imagem, evitando arquivos abandonados.

## Validação
- Conferir imagem quadrada, vertical e horizontal em quadros grandes, pequenos e no modo de participante ampliado.
- Confirmar que a escolha permanece após sair, entrar novamente e usar outra sala ou dispositivo.
- Testar troca, remoção, câmera ligada/desligada e compartilhamento de tela.
- Verificar desktop e celular, além da compilação e erros em execução.

## Detalhes técnicos
- Manter `avatar_url` para a foto pequena de perfil já existente e criar um campo separado para a imagem de câmera desligada.
- Atualizar perfil, presença da sala, `VideoTile` e os controles de entrada/chamada sem alterar o transporte WebRTC.
- Criar políticas de arquivos e dados limitadas a usuários autenticados, com escrita apenas no diretório do próprio usuário.

# Corrigir foto de exibição e participantes fantasmas

## O que foi verificado
- Sua foto está salva corretamente no seu perfil e os outros participantes têm permissão para vê-la.
- Hoje a foto chega aos outros apenas pelo "aviso de presença" da sala. Quem está com uma versão antiga aberta (site publicado ou app do PC sem a atualização) não recebe esse dado e continua vendo só a inicial.
- Os quadros fantasmas vêm de vídeos antigos que ficam na tela quando alguém sai, recarrega ou reconecta: a ligação antiga não é encerrada, então a mesma pessoa pode aparecer duas vezes ou alguém que já saiu continua lá.

## O que vamos corrigir
1. **Foto para todos**: cada quadro busca a foto direto no perfil da pessoa (além da presença), e atualiza ao trocar ou remover a imagem.
2. **Sem fantasmas**: mostrar apenas quadros de quem está realmente na chamada agora; encerrar ligações de quem saiu; se a mesma pessoa reconectar, manter só o quadro mais recente.
3. **Publicar** depois da correção, para que o site e o app do PC dos seus amigos recebam a versão nova (eles devem recarregar a página).

## Validação
- Simular chamada com duas sessões: conferir a foto no quadro do outro participante e que sair/entrar não deixa quadros extras.
- Conferir compilação sem erros.

## Detalhes técnicos
- `VideoTile`/sala: buscar `profiles.display_image_path` por `user_id` como fonte principal, presença como atualização rápida.
- `useRoomSession`: filtrar `remotes` pelos `peer_id` presentes em `members`; fechar `callsRef` de peers ausentes no efeito do mesh; deduplicar por `user_id` mantendo o `peer_id` atual da presença.

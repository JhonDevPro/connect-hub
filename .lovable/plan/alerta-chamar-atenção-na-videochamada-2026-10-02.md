# Alerta “Chamar atenção” na videochamada

## Experiência
- Adicionar um botão de sino na barra da chamada, disponível somente durante a videochamada.
- Ao abrir, permitir escolher **Todos na chamada** ou um participante específico.
- Quem receber ouvirá um toque mesmo com microfone ou saída da chamada silenciados e verá um aviso com o nome de quem chamou.
- Aplicar uma breve animação visual no palco para reforçar o alerta.
- Impedir disparos repetidos em sequência com um pequeno intervalo entre alertas.

## Funcionamento técnico
- Usar o canal em tempo real já aberto para a sala, enviando apenas nome/ID do remetente, destinatário e identificador do alerta.
- Aceitar o alerta somente quando o destinatário for o usuário atual ou quando for direcionado ao grupo da chamada.
- Gerar o toque localmente pelo navegador, sem arquivo externo; o primeiro gesto de entrada na chamada habilita o áudio.
- Manter o alerta separado do áudio WebRTC, para funcionar mesmo quando a saída da chamada estiver silenciada.
- Não persistir o alerta no histórico e não misturar eventos entre salas.

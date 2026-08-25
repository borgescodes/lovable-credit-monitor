# Credit Monitor 0.7.2

Extensão local para acompanhar o uso pessoal de créditos do Lovable usando a tela **People** como fonte oficial.

## Como funciona

A extensão lê somente a linha que contém `(you)`, independentemente do nome da pessoa, e usa a coluna mensal de uso e `Credit limit`. Não existe limite padrão embutido.

O navegador pode ser aberto normalmente sem criar uma aba People. A extensão só cria o collector depois de atividade real em um projeto Lovable ou por Sync manual. Se qualquer aba `Settings > People` já estiver aberta, ela é reutilizada globalmente, inclusive ao trabalhar com mais de um projeto.

O service worker pode recarregar somente a People existente para obter o valor oficial mais recente. Editor, preview e páginas de desenvolvimento nunca são recarregados pela extensão.

Os valores e o estado de sincronização são compartilhados por `chrome.storage.local` e `chrome.storage.onChanged`.

## Interface

- Full, Compact, Minimal e Ring.
- `Change view` percorre Full → Compact → Minimal.
- No Minimal, um clique retorna ao Compact e dois cliques rápidos abrem o Ring.
- No Ring, um clique retorna ao Minimal.
- Ring circular de 60 px com preenchimento sólido próprio de cada tema, sem superfície retangular aparente.
- Paletas Original, Red, Juparanã e Black & White, combinadas com Auto, Light e Dark.
- Swatches 50/50 reais para paletas multicoloridas e borda de contraste automática: branca no Dark e preta no Light.
- Countdown com unidades `d`, `h`, `m` e `s`.
- Sync manual nos modos Full e Compact.
- Drag somente pelo grip dedicado.

## Motion

A abertura inicial e toda troca de visualização reproduzem motion curto com opacity, translate e scale, sem blur. Full, Compact e Minimal também repetem o count-up dos valores e a animação da barra ao entrar. O Ring anima o número de zero até o saldo atual junto com o arco de progresso.

`prefers-reduced-motion` é respeitado automaticamente.

## Posicionamento nas bordas

A posição agora é edge aware. Quando o painel está próximo de uma borda e muda de tamanho, ele preserva a distância daquela borda e cresce para dentro da viewport. A mesma regra é usada ao redimensionar a janela. Posições livres continuam livres e o drag não possui snap agressivo.

## Sync manual

Ao clicar em Sync, a extensão reutiliza uma People existente ou cria uma em background se nenhuma estiver disponível. Somente a People é atualizada.

## Privacidade e interferência

A extensão não intercepta `fetch` ou XHR, não clica em controles do Lovable, não envia eventos de teclado e não altera rotas. Não há servidor próprio da extensão; os dados permanecem no navegador.

## Instalação

Chrome: abra `chrome://extensions`, ative o modo de desenvolvedor, escolha `Load unpacked` e selecione a pasta que contém `manifest.json`.

Edge: abra `edge://extensions`, ative `Developer mode`, escolha `Load unpacked` e selecione a mesma pasta.

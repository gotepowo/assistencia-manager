# Correção da sincronização após a mudança de nome

O nome visual do produto mudou de **Gotelip Assistência** para **Gotelip Manager**.
Versões anteriores, porém, já possuíam histórico de revisões na pasta:

`Gotelip Assistencia Sync`

A versão que usava somente `Gotelip Manager Sync` podia criar uma segunda linha de revisões e comparar o `baseRevision` local com o manifesto errado, gerando um conflito falso.

A correção em `electron/cloudSync.js` agora:

- reconhece `Gotelip Manager Sync`, `Gotelip Assistencia Sync` e `Gotelip Assistência Sync`;
- prefere a pasta cuja revisão coincide com a revisão-base deste computador;
- na ausência de coincidência, usa o histórico válido com a maior revisão;
- salva em `cloud-sync.json` qual pasta de histórico foi escolhida;
- não renomeia nem duplica automaticamente o histórico antigo;
- diferencia uma revisão realmente mais nova de uma pasta com histórico anterior/divergente;
- continua criando backup local antes de baixar dados do OneDrive.

O `appId` permanece `com.gotelip.assistencia` de propósito, para manter compatibilidade com instalações anteriores. Isso não altera o nome exibido ao usuário, que continua sendo **Gotelip Manager**.

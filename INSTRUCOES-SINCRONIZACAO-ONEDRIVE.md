# Sincronização pela pasta do OneDrive

Esta versão não usa Azure, Microsoft Graph, Client ID nem registro de aplicativo. O programa grava snapshots dentro da pasta local do OneDrive, e o cliente oficial do OneDrive faz o envio para a nuvem.

## Preparação nos dois computadores

1. Instale o OneDrive do Windows e entre com a mesma conta Microsoft nos dois computadores.
2. Confirme que a pasta do OneDrive aparece no Explorador de Arquivos.
3. No OneDrive, deixe a opção de inicialização automática ativada.
4. Use a mesma versão do Gotelip Assistência nos dois computadores.

## Primeiro computador (o que já possui seus dados)

1. Abra o Gotelip Assistência.
2. Vá em **Configurações**.
3. Na seção **Sincronização pela pasta do OneDrive**, escolha a pasta detectada ou clique em **Selecionar pasta do OneDrive**.
4. Selecione a pasta principal do OneDrive, por exemplo `C:\\Users\\Thiago\\OneDrive`. Não selecione uma pasta dentro dela.
5. Clique em **Sincronizar agora**.
6. O programa criará `Gotelip Assistencia Sync` dentro do OneDrive e enviará a primeira revisão.
7. Espere o ícone do OneDrive indicar que a sincronização terminou antes de desligar ou usar o outro computador.

## Segundo computador

1. Confirme que o OneDrive já terminou de baixar a pasta `Gotelip Assistencia Sync`.
2. Abra o Gotelip Assistência e configure a mesma pasta principal do OneDrive.
3. Clique em **Sincronizar agora**.
4. A versão mais recente será baixada. O aplicativo recarregará automaticamente.

## Uso diário

- Abra apenas um computador por vez.
- Ao começar, aguarde o OneDrive terminar de baixar os arquivos e abra o aplicativo.
- Antes de trocar de computador, clique em **Sincronizar agora**.
- Aguarde a mensagem de sucesso e depois aguarde o ícone do OneDrive ficar atualizado.
- Só então feche o app e abra o outro computador.

O aplicativo também tenta sincronizar automaticamente ao abrir, a cada 5 minutos e ao fechar, mas o botão manual é recomendado antes de trocar de máquina.

## Proteção contra conflitos

Cada envio cria uma revisão imutável. Se o OneDrive possuir uma revisão mais nova enquanto este computador também tiver alterações locais, o aplicativo não sobrescreve nada automaticamente. Ele avisa sobre o conflito e oferece baixar a versão da nuvem. Antes de restaurar a nuvem, o banco local é salvo na pasta `backups` ao lado do executável.

## Estrutura criada no OneDrive

```text
OneDrive/
└── Gotelip Assistencia Sync/
    ├── manifest.json
    ├── revision-00000001/
    │   ├── data/database.json
    │   ├── uploads/
    │   └── snapshot.json
    └── revision-00000002/
```

As 10 revisões mais recentes são mantidas.

## Observações importantes

- Não edite manualmente `manifest.json` nem as pastas `revision-*`.
- Não coloque o executável inteiro dentro do OneDrive; apenas configure a pasta pela tela do aplicativo.
- Se o OneDrive estiver pausado ou sem internet, os dados continuam salvos localmente. Não troque de computador até ele terminar o envio.
- Para trocar de conta ou pasta, use **Trocar pasta** nas configurações.

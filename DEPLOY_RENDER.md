# Deploy no Render

Este projeto ja esta preparado para publicar no Render com disco persistente.

## Configuracao

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Disk mount path: `/var/data`
- Variavel `STORAGE_DIR`: `/var/data`

## Variaveis obrigatorias

Defina no painel do Render:

```text
NODE_ENV=production
NODE_VERSION=22
STORAGE_DIR=/var/data
ADMIN_PASSWORD=sua-senha-forte
ADMIN_TOKEN_SECRET=um-texto-longo-aleatorio-e-secreto
```

O arquivo `render.yaml` ja descreve essa configuracao. Ao conectar o repositorio no Render, use a opcao de Blueprint quando disponivel.

## Importante

O app salva produtos e fotos no disco persistente configurado em `/var/data`. Sem esse disco, os uploads podem sumir em reinicios ou novos deploys.

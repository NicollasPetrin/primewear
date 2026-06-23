# Catalogo online Primewear Imports

Aplicacao Node/Express com vitrine publica e painel administrativo para cadastrar pecas, precos, tamanhos, cores, descricoes e fotos.

## Rodar no computador

```bash
npm install
npm start
```

Depois acesse:

- Site publico: http://localhost:3000
- Painel admin: http://localhost:3000/admin

Senha inicial local, quando `.env` nao existir: `admin123`

## Configurar senha

Crie um arquivo `.env` para uso local:

```bash
PORT=3000
ADMIN_PASSWORD=sua-senha-forte
ADMIN_TOKEN_SECRET=um-texto-longo-e-secreto
```

## Publicar no Render

Este repositorio inclui `render.yaml`, pronto para Blueprint no Render.

1. Suba o projeto para um repositorio GitHub.
2. No Render, escolha New > Blueprint.
3. Conecte o repositorio.
4. Configure os secrets solicitados:
   - `ADMIN_PASSWORD`
   - `ADMIN_TOKEN_SECRET`
5. Confirme o deploy.

O Render vai usar:

- Build command: `npm install`
- Start command: `npm start`
- Health check: `/health`
- Disco persistente: `/var/data`

## Onde ficam os dados

Em producao, com `STORAGE_DIR=/var/data`:

- Produtos: `/var/data/data/products.json`
- Dados da loja: `/var/data/data/settings.json`
- Fotos enviadas: `/var/data/uploads/`

No computador local:

- Produtos: `data/products.json`
- Dados da loja: `data/settings.json`
- Fotos enviadas: `public/uploads/`

## Importante

O painel salva arquivos enviados pelos administradores. Em hospedagem, use sempre disco/volume persistente para nao perder produtos e fotos em reinicios ou redeploys.

# Almoxarifado Municipal

MVP full-stack para controle de almoxarifados, produtos, estoques e movimentacoes
de uma prefeitura.

## Stack

- Monorepo com `pnpm` workspaces.
- Frontend em React, Vite, TypeScript, Tailwind CSS e componentes shadcn/ui.
- Backend em Node.js, Express, TypeScript, Prisma e SQLite por padrao, com preparo para PostgreSQL ou MySQL via `.env`.

## Estrutura

```txt
/
|- apps/
|  |- backend/
|  `- frontend/
|- package.json
|- pnpm-workspace.yaml
`- README.md
```

## Funcionalidades do MVP

- Login por email e senha com papeis `Admin` e `Operador`.
- Dashboard com destaque para o almoxarifado geral.
- CRUD de almoxarifados e categorias de almoxarifados.
- CRUD de produtos, categorias de produtos e unidades de medida.
- Codigo de produto gerado automaticamente com sete digitos.
- Estoque por produto e almoxarifado, com estoque minimo configuravel.
- Entrada direta para admin, solicitacao de entrada para operador e saida avulsa.
- Transferencia enviada pelo almoxarifado geral e efetivada somente apos recebimento.
- Menu de solicitacoes, notificacoes internas e confirmacao de quem recebeu.
- Cadastro de usuarios com vinculo de operadores a almoxarifados especificos.
- Nota fiscal opcional e reutilizavel em entradas de estoque.
- Historico de movimentacoes com filtros.

## Requisitos

- Node.js compativel com Vite 6.
- `pnpm` instalado.
- Oficios sao renderizados pelo frontend em uma pagina A4 e salvos como PDF
  pelo fluxo nativo de impressao do navegador.

## Configuracao local

1. Instale dependencias:

   ```bash
   pnpm setup
   ```

2. Configure o backend:

   ```powershell
   Copy-Item apps/backend/.env.example apps/backend/.env
   ```

   O SQLite usa por padrao `apps/backend/prisma/dev.db`.

   O provider do banco precisa combinar com a URL. O historico de migrations
   versionado neste repositorio esta atualmente travado para SQLite
   (`apps/backend/prisma/migrations/migration_lock.toml`). Para usar PostgreSQL
   ou MySQL em producao, crie e revise um historico de migrations especifico
   para esse provider antes do deploy; o comando `db:deploy` falha fechado se
   detectar provider diferente para evitar corrupcao de banco.

   Exemplos de configuracao futura para outro banco:

   ```env
   DATABASE_PROVIDER="postgresql"
   DATABASE_URL="postgresql://usuario:senha@host:5432/almoxarifado?schema=public"
   ```

   Tambem sao aceitos `DATABASE_PROVIDER="sqlite"` e `DATABASE_PROVIDER="mysql"`.

3. Aplique as migrations versionadas:

   ```bash
   pnpm db:deploy
   ```

   `pnpm db:migrate` e um alias seguro para o mesmo fluxo: aplica apenas
   migrations ja versionadas e nao cria migration nova ao baixar o projeto em
   outro local.

4. Popule dados de exemplo:

   ```bash
   pnpm db:seed
   ```

5. Inicie frontend e backend:

   ```bash
   pnpm dev
   ```

   - Frontend: `http://127.0.0.1:5173`
   - Backend: `http://127.0.0.1:3333`

## Scripts uteis

```bash
pnpm dev
pnpm dev:frontend
pnpm dev:backend
pnpm build
pnpm test
pnpm db:generate
pnpm db:validate
pnpm db:status
pnpm db:deploy
pnpm db:migrate
pnpm db:migration:create -- --name nome_da_migration
pnpm db:push
pnpm db:seed
```

`pnpm db:generate` prepara o schema Prisma conforme `DATABASE_PROVIDER`.
`pnpm db:validate` e leitura segura: valida provider, URL, checksums das
migrations, drift entre schema e migrations e operacoes SQL arriscadas.
`pnpm db:deploy` aplica somente migrations versionadas e e o comando correto
para producao. `pnpm db:migrate` aponta para o mesmo fluxo seguro para evitar
que um pull em outro ambiente crie migration duplicada por acidente.

Para alterar o schema em desenvolvimento, edite `schema.prisma` e rode:

```bash
pnpm db:migration:create -- --name nome_da_migration
```

Revise o SQL gerado antes de versionar. `pnpm db:push` e apenas para
prototipagem local descartavel; ele e bloqueado em producao e nao deve ser usado
para deploy.

## Uploads

Os uploads de logos e favicon sao salvos em `apps/backend/uploads` quando nao houver S3 configurado. O banco guarda apenas a URL do arquivo.

Para usar S3 sem mudar codigo, configure no backend:

```env
S3_BUCKET="almoxarifado-uploads"
S3_REGION="sa-east-1"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_URL="https://cdn.seudominio.com"
```

Tambem e possivel usar `S3_ENDPOINT` e `S3_FORCE_PATH_STYLE="true"` para storage compativel com S3.

## Login do MVP

A seed cria dois acessos locais:

- Email: `admin@prefeitura.local`
- Senha: `admin123`
- Permissao: `Admin`

- Email: `operador.saude@prefeitura.local`
- Senha: `operador123`
- Permissao: `Operador` do Almoxarifado da Saude

## Dados iniciais

A seed inclui:

- Almoxarifado Central como unico almoxarifado geral.
- Almoxarifados de Saude, Educacao e Obras.
- Categorias de almoxarifado e de produto.
- Unidades `UN`, `CX`, `PCT`, `L` e `KG`.
- Produtos de exemplo e estoques iniciais no almoxarifado geral.
- Usuario admin e usuario operador de exemplo.

## Regras importantes

- Apenas um almoxarifado pode ser marcado como geral.
- Admin acessa todos os cadastros e sempre acessa o almoxarifado geral.
- Operador ve apenas os almoxarifados liberados para ele.
- Operador pode solicitar entrada e registrar saida avulsa.
- Operador nao cadastra produto, unidade ou categoria.
- O almoxarifado geral pode enviar transferencia para os demais.
- A transferencia fica pendente ate o destino confirmar o recebimento.
- A confirmacao registra quem recebeu, data e hora.
- Solicitacao de entrada so altera o estoque depois da aprovacao do admin.
- Entrada aprovada ou direta cria o estoque do produto quando necessario.
- Transferencia recebida cria o estoque no destino quando necessario.
- Saida e transferencia validam saldo antes de reduzir estoque.
- O saldo nunca pode ficar negativo.

## Fluxos novos

1. O admin cria usuarios em `Usuarios` e escolhe os almoxarifados de cada operador.
2. O operador usa `Solicitar entrada` no almoxarifado atribuido.
3. O admin aprova ou rejeita a entrada em `Solicitacoes`.
4. Em uma entrada direta, o admin pode criar ou selecionar uma nota fiscal.
5. Uma transferencia do almoxarifado geral aparece em `Solicitacoes` do destino.
6. Ao confirmar o recebimento, o sistema grava as movimentacoes de saida e entrada.

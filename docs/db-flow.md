# Fluxo de Banco de Dados (Prisma + Neon)

1. Toda alteração de banco deve incluir:
   - Update em `prisma/schema.prisma`
   - Uma migration versionada: `prisma/migrations/<timestamp>_<nome>/migration.sql`

2. Não utilizar `prisma db push` em produção.
3. Não editar PRs pelo GitHub. Alterações devem ser feitas pelo Codez, que atualiza o mesmo PR.
4. Seeds não rodam em produção (ver `prisma/seed.ts`).
5. Deploy:
   - Merge na `main` ➜ GitHub Actions roda `prisma migrate deploy` no Neon (produção).
6. Ambientes:
   - `DATABASE_URL` ➜ Neon branch `production`
   - `SHADOW_DATABASE_URL` ➜ Neon branch `shadow`

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed ignorado em produção.')
    return
  }

  console.log('Seed (dev/staging) concluído — nada a fazer por padrão.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

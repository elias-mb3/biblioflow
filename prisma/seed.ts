import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('secret123', 10);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@biblioflow.com' },
    update: {},
    create: {
      role: 'MANAGER',
      fullName: 'Admin Gestor',
      phone: '11999999999',
      email: 'manager@biblioflow.com',
      passwordHash,
    },
  });

  const user = await prisma.user.upsert({
    where: { cpf: '12345678900' },
    update: {},
    create: {
      role: 'USER',
      fullName: 'Maria Leitora',
      phone: '11888888888',
      cpf: '12345678900',
      passwordHash,
    },
  });

  const book = await prisma.book.upsert({
    where: { registrationCode: 'BIB-SEED-001' },
    update: {},
    create: {
      registrationCode: 'BIB-SEED-001',
      title: 'Dom Quixote',
      description: 'O romance de cavalaria mais famoso da literatura universal.',
      author: 'Miguel de Cervantes',
      quantity: 3,
      isbn: '9788573264227',
      publisher: 'Editora 34',
      publishedYear: 2002,
    },
  });

  console.log({ manager, user, book });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

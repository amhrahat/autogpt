/**
 * Seeds the first admin user from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 * Usage: npm run seed   (or: npx ts-node prisma/seed.ts)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@echogpt.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const name = process.env.ADMIN_NAME ?? 'Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists, nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: 'ADMIN',
    },
  });

  await prisma.subscription.create({
    data: {
      userId: admin.id,
      plan: 'TEAM',
      status: 'ACTIVE',
      monthlyLimit: -1, // unlimited
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`Created admin user ${email} (id: ${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

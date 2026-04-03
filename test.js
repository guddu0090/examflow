const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany().then(users => {
  console.log(JSON.stringify(users, null, 2));
  return prisma.$disconnect();
}).catch(e => {
  console.error(e);
  return prisma.$disconnect();
});

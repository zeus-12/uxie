import { prisma } from "../server/db";

const main = async () => {
  const users = await prisma.user.findMany({
    include: {
      documents: true,
    },
  });

  const usersWithMoreThanOneDocument = users
    .filter((user) => user.documents.length > 1)
    .map((item) => ({
      name: item.name,
      count: item.documents.length,
    }));

  console.log(usersWithMoreThanOneDocument);
};
main();

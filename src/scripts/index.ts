import { prisma } from "@/server/db";

const main = async () => {
  const hasMoreThanOnePdfAndUsedInLastSevenDays = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const accounts = await prisma.user.findMany({
      select: {
        name: true,
        documents: {
          select: {
            id: true,
            updatedAt: true,
          },
        },
      },
    });

    const res = accounts
      .filter((item) => {
        return (
          item.documents.length > 1 &&
          item.documents.some((doc) => {
            return doc.updatedAt > sevenDaysAgo;
          })
        );
      })
      .map((item) => {
        return {
          name: item.name,
          documents: item.documents.length,
        };
      });

    return res;
  };

  console.log(await hasMoreThanOnePdfAndUsedInLastSevenDays());
};
main();

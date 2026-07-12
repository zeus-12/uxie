import { prisma } from "@/server/db";

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

const emailEndings = async () => {
  const emails = await prisma.user.findMany({
    select: {
      email: true,
    },
  });

  return emails
    .map((email) => {
      return email?.email?.split("@")[1] ?? "";
    })
    .filter((email) => {
      return email !== "" && email !== "gmail.com";
    });
};

const getFlashcardsCount = async () => {
  const res = await prisma.document.findMany({
    select: {
      id: true,
      flashcards: {
        select: {
          id: true,
        },
      },

      owner: {
        select: {
          name: true,
        },
      },
    },
  });

  const fin = res
    .map((i) => ({
      ...i,
      flashcards: i.flashcards.length,
    }))
    .filter((i) => i.flashcards > 5);

  console.log(fin);
};

const main = async () => {
  // console.log(await hasMoreThanOnePdfAndUsedInLastSevenDays());
  console.log(await emailEndings());
  // console.log(await getFlashcardsCount());
};
main();

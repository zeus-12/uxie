export async function generateEmbeddings(text: string) {
  try {
    const response = await fetch(
      "https://pranav1483-uxieembedder.hf.space/embed",
      {
        method: "POST",
        body: JSON.stringify({
          texta: text,
        }),
      },
    );
    const result = await response.json();
    return result.embeddings[0] as number[];
  } catch (error: any) {
    console.log("ERROR EMBEDDING DATA", error.message);
    throw error;
  }
}

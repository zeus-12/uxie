import pdf from "pdf-parse";

const main = async () => {
  function render_page(pageData: any) {
    let render_options = {
      //replaces all occurrences of whitespace with standard spaces (0x20). The default value is `false`.
      normalizeWhitespace: false,
      //do not attempt to combine same line TextItem's. The default value is `false`.
      disableCombineTextItems: false,
    };

    return pageData.getTextContent(render_options).then(function (
      textContent: any,
    ) {
      let lastY,
        text = "";
      for (let item of textContent.items) {
        if (lastY == item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = item.transform[5];
      }
      return text;
    });
  }

  let options = {
    pagerender: render_page,
  };

  const url =
    "https://utfs.io/f/72f0c559-dd7c-4971-94d8-66061ccb7f1b-mv46dj.pdf";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  if (!response.headers.get("content-type")?.includes("application/pdf")) {
    throw new Error("Invalid file type. Only PDFs are allowed.");
  }
  const blob = await response.blob();
  const dataInBufferFormat = await blob.arrayBuffer();
  const buf = Buffer.from(dataInBufferFormat);

  pdf(buf, options).then(function (data) {
    console.log(data.text);
  });
};
main();

import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { PLANS } from "@/lib/constants";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import { useDropzone } from "@uploadthing/react";
import { XIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  generateClientDropzoneAccept,
  generatePermittedFileTypes,
} from "uploadthing/client";
import { z } from "zod";
// @ts-ignore
import scribe from "scribe.js-ocr";

const MAX_FILE_SIZE_ALLOWED = 8 * 1024 * 1024;
const MAX_FILE_SIZE_ALLOWED_IN_TEXT = "8MB";

const UploadFileModal = ({
  refetchUserDocs,
  docsCount,
}: {
  refetchUserDocs: () => void;
  docsCount: number;
}) => {
  const session = useSession();

  const userPlan = (
    session.data?.user?.plan ? PLANS[session.data?.user?.plan] : PLANS.FREE
  ).maxPagesPerDoc;

  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File>();
  const [uploadProgress, setUploadProgress] = useState<number>();
  const [doOcr, setDoOcr] = useState(false);

  const [open, setOpen] = useState(false);
  const [isOcring, setIsOcring] = useState(false);

  const closeModal = () => setOpen(false);

  const onUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(undefined);
    setUrl(e.target.value);
  };

  const { isLoading: isUrlUploading, mutateAsync: mutateAddDocumentByLink } =
    api.document.addDocumentByLink.useMutation();

  const {
    startUpload,
    routeConfig,
    isUploading: isUploadthingUploading,
  } = useUploadThing("docUploader", {
    onBeforeUploadBegin: async (files) => {
      try {
        const firstFile = files[0];
        if (!files || files.length !== 1 || !firstFile) {
          throw new Error("Please upload a single PDF file.");
        }

        if (doOcr) {
          setIsOcring(true);
          // await scribe.init({ pdf: true, ocr: true, font: true });
          // const params = {
          //   extractPDFTextNative: optGUI.extractText,
          //   extractPDFTextOCR: optGUI.extractText,
          // };
          scribe.opt.displayMode = "invis";

          await scribe.importFiles(
            files,
            // params
          );
          await scribe.recognize({
            mode: "quality",
            langs: ["eng"],
            modeAdv: "combined",
            vanillaMode: true,
            combineMode: "data",
          });

          const data = (await scribe.exportData("pdf")) as string | ArrayBuffer;

          const blob = new Blob([data], { type: "application/pdf" });
          const file = new File([blob], firstFile.name, {
            type: "application/pdf",
          });

          setIsOcring(false);
          return [file];
        }
        return files;
      } catch (err) {
        setIsOcring(false);
        throw new Error("Something went wrong while ocr-ing the file.");
      }
    },
    onClientUploadComplete: () => {
      toast.success("File uploaded successfully.");
    },
    onUploadError: () => {
      toast.error("Error occurred while uploading", {
        duration: 3000,
      });
    },
    onUploadProgress: (p) => {
      setUploadProgress(p);
    },
  });

  const uploadFile = async () => {
    if ((file && url) || (!file && !url)) {
      toast.error("Please upload a file or enter a URL.", {
        duration: 3000,
      });
      return;
    }
    try {
      if (file) {
        await startUpload([file]);
      } else if (url) {
        const urlSchema = z.string().url();
        try {
          urlSchema.parse(url);
        } catch (err) {
          toast.error("Invalid URL", {
            duration: 3000,
          });
          return;
        }

        const res = await fetch(url);
        const contentType = res.headers.get("Content-Type");
        if (contentType !== "application/pdf") {
          toast.error("URL is not a PDF", {
            duration: 3000,
          });
          return;
        }

        const fileName =
          res.headers.get("Content-Disposition")?.split("filename=")[1] ||
          url.split("/").pop();

        await mutateAddDocumentByLink({
          title: fileName ?? "Untitled",
          url,
        });

        toast.success("File uploaded successfully.", {
          duration: 3000,
        });
      }
      closeModal();
      setFile(undefined);
      setUrl("");
      refetchUserDocs();
    } catch (err: any) {
      console.log("error", err.message);

      toast.error(
        "Error occurred while uploading. Please make sure the PDF is accessible.",
        {
          duration: 3000,
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogTrigger>
        <div
          onClick={(e) => {
            const userPlan = session?.data?.user?.plan;
            if (!userPlan) return;
            const allowedDocsCount = PLANS[userPlan].maxDocs;

            if (docsCount >= allowedDocsCount) {
              e.preventDefault();
              toast.error("Free upload limit exceeded.", {
                duration: 3000,
                description: `Upgrade your plan to upload more than ${allowedDocsCount} document.`,
              });
              return;
            }
          }}
          className={cn(buttonVariants())}
        >
          Upload File
        </div>
      </DialogTrigger>
      <DialogContent hideClose={true}>
        <DialogHeader>
          <DialogTitle>
            <p className="text-xl">Upload File</p>
            <p className="text-sm font-normal text-gray-500">
              Choose files with {userPlan} or less pages to use AI features.
              (For now)
            </p>
          </DialogTitle>

          <div className="mb-2" />

          <Uploader
            routeConfig={routeConfig}
            setUrl={setUrl}
            setFile={setFile}
            file={file}
          />

          <div className="relative flex items-center py-5">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="mx-3 flex-shrink text-xs text-gray-500">OR</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <div>
            <p>Import from URL</p>
            <p className="mb-2 text-xs font-normal text-gray-500">
              Your files are not stored, only the URL is retained, also supports
              Google Drive and Dropbox links.
            </p>

            <Input
              value={url}
              onChange={onUrlChange}
              placeholder="https://example.com/file.pdf"
              className="w-full"
            />
          </div>

          <div>
            <div className="my-3 flex items-center space-x-2">
              <Checkbox
                id="ocr"
                checked={doOcr}
                onCheckedChange={(c) => setDoOcr(!!c)}
              />
              <label
                htmlFor="ocr"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                OCR for scanned documents. (Beta - really slow 🐢)
              </label>
            </div>
          </div>

          <div>
            <Button
              disabled={
                (!file && !url) ||
                isUploadthingUploading ||
                isUrlUploading ||
                isOcring
              }
              className="mt-4 w-full"
              onClick={uploadFile}
            >
              {isUploadthingUploading || isUrlUploading || isOcring ? (
                <>
                  <Spinner />
                  {isUploadthingUploading && (
                    <p className="ml-2">{uploadProgress}%</p>
                  )}

                  {isOcring && (
                    <span>Applying OCR, it might take a while...</span>
                  )}
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
export default UploadFileModal;

const Uploader = ({
  setUrl,
  setFile,
  file,
  routeConfig,
}: {
  setUrl: (url: string) => void;
  setFile: (file?: File) => void;
  file?: File;
  routeConfig: any;
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles || acceptedFiles.length !== 1 || !acceptedFiles[0]) {
        toast.error(
          `Please upload a single PDF with a maximum file size of ${MAX_FILE_SIZE_ALLOWED_IN_TEXT}.`,
          {
            duration: 3000,
          },
        );

        return;
      }

      setUrl("");
      setFile(acceptedFiles[0]);
    },
    [setFile, setUrl],
  );

  const { getRootProps, getInputProps } = useDropzone({
    disabled: !!file,
    onDrop,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE_ALLOWED,
    multiple: false,
    accept: generateClientDropzoneAccept(
      generatePermittedFileTypes(routeConfig).fileTypes,
    ),
  });

  return (
    <div
      {...getRootProps()}
      className="flex flex-col items-center justify-center gap-4 rounded-md border-[0.75px] border-gray-300 px-4 py-12"
    >
      <input {...getInputProps()} />

      {file ? (
        <div className="my-5 flex items-center gap-2">
          <p>{file.name}</p>
          <XIcon
            onClick={() => setFile()}
            className="h-4 w-4 text-gray-500 hover:cursor-pointer"
          />
        </div>
      ) : (
        <>
          <p>Upload the pdf</p>
          <p className="text-sm text-gray-500">Single PDF upto 8MB</p>
        </>
      )}
    </div>
  );
};

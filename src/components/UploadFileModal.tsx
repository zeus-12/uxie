import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useUploadThing } from "@/lib/uploadthing";
import { useCallback, useState } from "react";
import { generateClientDropzoneAccept } from "uploadthing/client";
import { useDropzone } from "@uploadthing/react";
import { Checkbox } from "@/components/ui/checkbox";
import { XIcon } from "lucide-react";
import { api } from "@/lib/api";
import { z } from "zod";

const UploadFileModal = ({
  refetchUserDocs,
}: {
  refetchUserDocs: () => void;
}) => {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File>();

  const [open, setOpen] = useState(false);
  const closeModal = () => setOpen(false);

  const onUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(undefined);
    setUrl(e.target.value);
  };

  const { isLoading: isUrlUploading, mutateAsync: mutateAddDocumentByLink } =
    api.document.addDocumentByLink.useMutation();

  const {
    startUpload,
    permittedFileInfo,
    isUploading: isUploadthingUploading,
  } = useUploadThing("docUploader", {
    onClientUploadComplete: () => {
      toast({
        title: "Success",
        description: "File uploaded successfully.",
      });
      closeModal();
    },
    onUploadError: () => {
      toast({
        title: "Error",
        description: "error occurred while uploading",
        variant: "destructive",
      });
    },
  });

  const uploadFile = async () => {
    if ((file && url) || (!file && !url)) {
      toast({
        title: "Error",
        description: "Please upload a file or enter a URL.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (file) {
        startUpload([file]);
      } else if (url) {
        const urlSchema = z.string().url();
        try {
          urlSchema.parse(url);
        } catch (err) {
          toast({
            title: "Error",
            description: "Invalid URL",
            variant: "destructive",
          });
          return;
        }

        const res = await fetch(url);
        const contentType = res.headers.get("Content-Type");
        if (contentType !== "application/pdf") {
          toast({
            title: "Error",
            description: "URL is not a PDF",
            variant: "destructive",
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

        toast({
          title: "Success",
          description: "File uploaded successfully.",
        });
        setUrl("");
        closeModal();
      }
    } catch (err: any) {
      console.log("error", err.message);
      toast({
        title: "Error",
        description: "Error occurred while uploading",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogTrigger>
        <Button>Upload File</Button>
      </DialogTrigger>
      <DialogContent hideClose={true}>
        <DialogHeader>
          <DialogTitle>
            <h1 className="text-xl">Upload File</h1>
            <p className="text-sm font-normal text-gray-500">
              Choose files under 6 pages to use AI, flashcard. (For now)
            </p>
          </DialogTitle>

          <div className="mb-2" />

          <Uploader
            permittedFileInfo={permittedFileInfo}
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
            <p className="mb-1">Import from URL</p>
            <Input
              value={url}
              onChange={onUrlChange}
              placeholder="https://example.com/file.pdf"
              className="w-full"
            />
          </div>

          <div>
            <div className="my-3 flex items-center space-x-2">
              <Checkbox id="terms2" disabled />
              <label
                htmlFor="terms2"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                OCR for scanned documents. (Coming soon)
              </label>
            </div>
          </div>

          <div>
            <Button
              disabled={
                (!file && !url) || isUploadthingUploading || isUrlUploading
              }
              className="mt-4 w-full"
              onClick={uploadFile}
            >
              Upload
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
  permittedFileInfo,
}: {
  setUrl: (url: string) => void;
  setFile: (file?: File) => void;
  file?: File;
  permittedFileInfo: any;
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (
      !acceptedFiles ||
      acceptedFiles.length === 0 ||
      acceptedFiles.length > 1 ||
      !acceptedFiles[0]
    ) {
      toast({
        title: "Error",
        description: "Please upload a single file.",
        variant: "destructive",
      });
      return;
    }

    setUrl("");
    setFile(acceptedFiles[0]);
  }, []);

  const fileTypes = permittedFileInfo?.config
    ? Object.keys(permittedFileInfo?.config)
    : [];

  const { getRootProps, getInputProps } = useDropzone({
    disabled: !!file,
    onDrop,
    maxFiles: 1,
    maxSize: 8 * 1024 * 1024,
    multiple: false,
    accept: fileTypes ? generateClientDropzoneAccept(fileTypes) : undefined,
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

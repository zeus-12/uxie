import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
});

const ImageDetailsModal = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values);
  };

  return "hi";
  // <Dialog.Root defaultOpen={true}>
  //   <DialogTrigger>Open</DialogTrigger>
  //   <DialogContent>
  //     <DialogHeader>
  //       <DialogTitle>Enter image url</DialogTitle>
  //       <DialogDescription>
  //         <Form {...form}>
  //           <form
  //             onSubmit={form.handleSubmit(onSubmit)}
  //             className="space-y-8"
  //           >
  //             <FormField
  //               control={form.control}
  //               name="username"
  //               render={({ field }) => (
  //                 <FormItem>
  //                   <FormLabel>Username</FormLabel>
  //                   <FormControl>
  //                     <Input placeholder="shadcn" {...field} />
  //                   </FormControl>
  //                   <FormDescription>
  //                     This is your public display name.
  //                   </FormDescription>
  //                   <FormMessage />
  //                 </FormItem>
  //               )}
  //             />
  //             <Button type="submit">Submit</Button>
  //           </form>
  //         </Form>
  //       </DialogDescription>
  //     </DialogHeader>
  //   </DialogContent>
  // </Dialog.Root>
};

export default ImageDetailsModal;

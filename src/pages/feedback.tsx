import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import {
  FEEDBACK_FORM_DEFAULT_VALUES,
  FEEDBACK_TYPES,
  feedbackFormSchema,
} from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

const Feedback = () => {
  const { mutateAsync: submitFeedbackMutation, isLoading } =
    api.user.submitFeedback.useMutation();

  const form = useForm<z.infer<typeof feedbackFormSchema>>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: FEEDBACK_FORM_DEFAULT_VALUES,
  });

  const onSubmit = async () => {
    await submitFeedbackMutation(form.getValues());
    toast({
      title: "Feedback submitted!",
      description: "Thank you for sharing your thoughts with us 🥳",
    });

    form.reset();
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col items-center px-4 py-2 lg:px-16">
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Submit Feedback!
      </h1>
      <p className="mb-4 text-sm text-gray-400">
        Help us make the app even better 🥳
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {/* feedback message */}
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Suggestion</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What would you like to see in the app?"
                    className="w-[90vw] max-w-md resize-none"
                    {...field}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
          {/* feedback-type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Feedback type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-[90vw] max-w-md pl-2">
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                  </FormControl>

                  <SelectContent>
                    {FEEDBACK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="w-[90vw] max-w-md">
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="To hear back from us (optional)"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button disabled={isLoading} className="mt-2 w-full" type="submit">
            Submit
          </Button>
        </form>
      </Form>
    </div>
  );
};
export default Feedback;

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { bookCallSchema, type BookCallRequest } from "@shared/schema";
import { useState } from "react";

interface BookCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

export function BookCallDialog({ open, onOpenChange, source = "Website" }: BookCallDialogProps) {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<BookCallRequest>({
    resolver: zodResolver(bookCallSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateTime: "",
      message: "",
      source,
    },
  });

  const bookCallMutation = useMutation({
    mutationFn: async (data: BookCallRequest) => {
      const response = await apiRequest("POST", "/api/book-call", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to book call");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Call Booked Successfully!",
        description: "Check your email for confirmation details.",
      });

      setTimeout(() => {
        form.reset();
        setIsSuccess(false);
        onOpenChange(false);
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookCallRequest) => {
    bookCallMutation.mutate(data);
  };

  // Get minimum datetime (now + 1 hour)
  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-book-call">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Book a Discovery Call</DialogTitle>
          <DialogDescription>
            Schedule a call with our team to discuss how OnSpot can help your business.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="booking-success">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Booking Confirmed!</h3>
            <p className="text-muted-foreground">
              Check your email for confirmation and meeting details.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="John"
                          data-testid="input-firstname"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Doe"
                          data-testid="input-lastname"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="john@company.com"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+1 555 123 4567"
                        data-testid="input-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Date & Time *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          {...field}
                          type="datetime-local"
                          min={getMinDateTime()}
                          className="pl-10"
                          data-testid="input-datetime"
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Select a time at least 1 hour from now
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Tell us briefly what you'd like to discuss..."
                        rows={3}
                        data-testid="input-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                  disabled={bookCallMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={bookCallMutation.isPending}
                  data-testid="button-submit-booking"
                >
                  {bookCallMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      Book Call
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

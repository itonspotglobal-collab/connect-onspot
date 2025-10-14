import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight } from "lucide-react";

export function AccessPortalModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"client" | "talent">("client");
  const [emailError, setEmailError] = useState("");

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when modal closes
      setTimeout(() => {
        setStep(1);
        setEmail("");
        setRole("client");
        setEmailError("");
      }, 200); // Delay to allow close animation
    }
  };

  const handleContinue = () => {
    setStep(2);
  };

  const handleEmailNext = () => {
    // Validate email contains "@"
    if (!email.includes("@")) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");
    setStep(3);
  };

  const handleSubmit = () => {
    // Log the submission (you can replace this with actual API call)
    console.log("Portal Access Request:", {
      email,
      role,
      timestamp: new Date().toISOString(),
    });

    // Close the modal
    handleOpenChange(false);

    // You could also show a success toast here
    // toast({ title: "Thanks for your interest!", description: "We'll notify you when we launch." });
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-white text-primary hover:bg-white/90 font-semibold border border-white/30 shadow-lg"
        data-testid="button-access-portal"
      >
        ACCESS PORTAL
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {/* Step 1: Coming Soon Message */}
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-center">
                  The First Superhuman BPO is Coming Soon.
                </DialogTitle>
              </DialogHeader>
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleContinue}
                  size="lg"
                  className="min-w-[200px]"
                  data-testid="button-continue"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Email Input */}
          {step === 2 && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Enter Your Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleEmailNext();
                      }
                    }}
                    className={emailError ? "border-red-500" : ""}
                    data-testid="input-email"
                  />
                  {emailError && (
                    <p className="text-sm text-red-500" data-testid="text-email-error">
                      {emailError}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    data-testid="button-back-step1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleEmailNext}
                    data-testid="button-next-step2"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Role Selection */}
          {step === 3 && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Select Your Role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <RadioGroup value={role} onValueChange={(value: "client" | "talent") => setRole(value)}>
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate transition-all duration-200">
                    <RadioGroupItem value="client" id="client" data-testid="radio-client" />
                    <Label
                      htmlFor="client"
                      className="flex-1 cursor-pointer font-medium"
                    >
                      Client
                      <p className="text-sm text-muted-foreground font-normal">
                        I want to hire talent
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate transition-all duration-200">
                    <RadioGroupItem value="talent" id="talent" data-testid="radio-talent" />
                    <Label
                      htmlFor="talent"
                      className="flex-1 cursor-pointer font-medium"
                    >
                      Talent
                      <p className="text-sm text-muted-foreground font-normal">
                        I want to find work
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    data-testid="button-back-step2"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    data-testid="button-submit"
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

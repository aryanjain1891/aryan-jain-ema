import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Phone, Mail } from "lucide-react";

interface ClaimConfirmationProps {
  claimNumber: string;
  onReset: () => void;
}

export const ClaimConfirmation = ({ claimNumber, onReset }: ClaimConfirmationProps) => {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl">Claim Submitted Successfully</CardTitle>
          <CardDescription className="text-lg">
            Your claim has been received and is being processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-card border rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Your Claim Number</p>
            <p className="text-3xl font-bold text-primary">{claimNumber}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Please save this number for your records
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">What happens next?</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <p className="text-sm">
                  Our team will review your claim and all submitted documentation within 1-2 business days.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <p className="text-sm">
                  A claims adjuster may contact you if additional information is needed.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <p className="text-sm">
                  You will receive an email with your claim decision and next steps.
                </p>
              </li>
            </ul>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h4 className="font-semibold">Need Help?</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Call Us</p>
                  <p className="text-sm text-muted-foreground">1-800-CLAIMS</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email Support</p>
                  <p className="text-sm text-muted-foreground">claims@insurance.com</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              A confirmation email has been sent to your registered email address with all claim details.
            </p>
          </div>

          <Button onClick={onReset} variant="outline" className="w-full">
            File Another Claim
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
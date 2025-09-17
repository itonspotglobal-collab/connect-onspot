import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, RefreshCw, Mail, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

interface OAuthErrorProps {
  error?: string;
  provider?: string;
  message?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OAuthErrorDialog({ error, provider, message, open, onOpenChange }: OAuthErrorProps) {
  const { toast } = useToast();
  const [retryCount, setRetryCount] = useState(0);

  const getErrorMessage = (error: string, provider: string) => {
    switch (error) {
      case 'access_denied':
        return `You declined to authorize OnSpot access to your ${provider} account. To continue, please try again and grant the necessary permissions.`;
      case 'invalid_scope':
        return `There was an issue with the ${provider} authentication scopes. This is likely a temporary issue - please try again.`;
      case 'server_error':
        return `${provider} encountered an error during authentication. Please try again in a few moments.`;
      case 'temporarily_unavailable':
        return `${provider} authentication is temporarily unavailable. Please try again in a few minutes.`;
      case 'invalid_client':
        return `There's a configuration issue with ${provider} authentication. Our team has been notified and is working on a fix.`;
      case 'email_missing':
        return `Your ${provider} account doesn't have a public email address. Please ensure your email is visible in your ${provider} profile settings, or use a different sign-in method.`;
      case 'profile_incomplete':
        return `Your ${provider} profile is missing required information. Please complete your profile and try again.`;
      default:
        return message || `Authentication with ${provider} failed. This could be due to a network issue or temporary service disruption.`;
    }
  };

  const getErrorTitle = (error: string, provider: string) => {
    switch (error) {
      case 'access_denied':
        return `${provider} Authorization Declined`;
      case 'email_missing':
        return `Email Address Required`;
      case 'invalid_client':
        return `Service Configuration Issue`;
      default:
        return `${provider} Sign-In Failed`;
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    onOpenChange(false);
    
    // Add a small delay to prevent rapid retries
    setTimeout(() => {
      if (provider?.toLowerCase() === 'google') {
        window.location.href = '/api/auth/google';
      } else if (provider?.toLowerCase() === 'linkedin') {
        window.location.href = '/api/auth/linkedin';
      }
    }, 1000);
  };

  const handleContactSupport = () => {
    const subject = encodeURIComponent(`OAuth Authentication Issue - ${provider} - Error: ${error}`);
    const body = encodeURIComponent(
      `Hi OnSpot Support,\n\nI'm experiencing an issue with ${provider} authentication.\n\nError: ${error}\nProvider: ${provider}\nMessage: ${message}\nRetry attempts: ${retryCount}\n\nPlease help me resolve this issue.\n\nThanks!`
    );
    window.open(`mailto:support@onspotglobal.com?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <img 
              src={onspotLogo} 
              alt="OnSpot" 
              className="h-10 w-auto"
            />
          </div>
          <DialogTitle className="text-xl flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            {getErrorTitle(error || 'unknown', provider || 'OAuth')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm leading-relaxed">
              {getErrorMessage(error || 'unknown', provider || 'the authentication provider')}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button 
              onClick={handleRetry} 
              className="w-full flex items-center gap-2"
              disabled={retryCount >= 3}
              data-testid="button-retry-oauth"
            >
              <RefreshCw className="w-4 h-4" />
              {retryCount >= 3 ? 'Too Many Retries' : `Try ${provider} Again`}
            </Button>

            <Button 
              variant="outline" 
              onClick={handleContactSupport}
              className="w-full flex items-center gap-2"
              data-testid="button-contact-support"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </Button>

            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="w-full"
              data-testid="button-close-error"
            >
              Close & Try Email Sign-In
            </Button>
          </div>

          {error === 'email_missing' && provider?.toLowerCase() === 'linkedin' && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>LinkedIn Profile Settings:</strong>
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                <li>Go to your LinkedIn profile settings</li>
                <li>Navigate to "Visibility" → "Profile visibility"</li>
                <li>Make sure your email address is visible to "Your network"</li>
                <li>Save changes and try signing in again</li>
              </ol>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto mt-2 text-xs"
                onClick={() => window.open('https://www.linkedin.com/mypreferences/d/visibility', '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open LinkedIn Settings
              </Button>
            </div>
          )}

          {retryCount >= 2 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Still having trouble?</p>
              <p className="text-xs text-muted-foreground">
                Try clearing your browser cookies, using an incognito window, or contact our support team for personalized assistance.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to parse URL parameters and show OAuth error dialog
export function useOAuthError() {
  const [errorInfo, setErrorInfo] = useState<{
    error?: string;
    provider?: string;
    message?: string;
    show: boolean;
  }>({ show: false });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const provider = urlParams.get('provider');
    const message = urlParams.get('message');

    if (error && (error === 'oauth' || urlParams.has('provider'))) {
      setErrorInfo({
        error: error,
        provider: provider || 'OAuth',
        message: message || undefined,
        show: true
      });

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const closeErrorDialog = () => {
    setErrorInfo(prev => ({ ...prev, show: false }));
  };

  return {
    ...errorInfo,
    onOpenChange: closeErrorDialog
  };
}
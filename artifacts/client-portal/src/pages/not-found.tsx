import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Page Not Found — Let's Roll";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, follow";
    return () => {
      meta!.content = "index, follow";
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center p-6 max-w-sm">
        <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist. If you were given a booking link, please check with your instructor.
        </p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          Go Home
        </Button>
      </div>
    </div>
  );
}

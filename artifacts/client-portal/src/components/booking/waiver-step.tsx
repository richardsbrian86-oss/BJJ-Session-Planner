import { useRef, useState } from "react";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, PenLine } from "lucide-react";

const WAIVER_TEXT = `RELEASE OF LIABILITY, WAIVER OF CLAIMS, AND INDEMNITY AGREEMENT

Please read this document carefully. By signing below you agree to the following terms:

1. ASSUMPTION OF RISK
I acknowledge that Brazilian Jiu-Jitsu (BJJ) and related martial arts training involve physical contact and carries an inherent risk of injury, including but not limited to: bruises, sprains, strains, fractures, dislocations, concussions, and in rare cases permanent disability or death. I voluntarily choose to participate with full knowledge and understanding of these risks.

2. RELEASE OF LIABILITY
In consideration of being permitted to participate in training sessions, I hereby release, discharge, and hold harmless the instructor, their affiliates, employees, agents, successors, and assigns (collectively "Released Parties") from any and all claims, demands, losses, damages, costs, and causes of action arising out of or related to my participation in training, whether caused by negligence of the Released Parties or otherwise.

3. MEDICAL FITNESS
I represent that I am in good physical health and that I am not aware of any medical condition that would prevent my participation in physical training. I agree to inform the instructor of any medical conditions, injuries, or limitations before training.

4. INDEMNIFICATION
I agree to indemnify and hold harmless the Released Parties from any and all claims, damages, losses, costs, and expenses (including reasonable attorney fees) arising out of or related to my participation in training.

5. PHOTOGRAPH AND VIDEO
I grant the instructor permission to take photographs or videos during training sessions and to use such media for promotional or educational purposes, unless I provide written notice of objection.

6. GOVERNING LAW
This agreement shall be governed by applicable state law. If any provision of this agreement is found to be unenforceable, the remaining provisions shall remain in full force and effect.

7. ACKNOWLEDGMENT
I have read and understand this Release of Liability, Waiver of Claims, and Indemnity Agreement. I understand that by signing this document I am giving up substantial rights, including my right to sue. I am signing this agreement freely and voluntarily.`;

interface WaiverStepProps {
  slug: string;
  onComplete: (data: { waiverId: number; clientName: string; clientEmail: string }) => void;
}

export function WaiverStep({ slug, onComplete }: WaiverStepProps) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    clientName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail) &&
    signatureData !== null;

  const handleClear = () => {
    padRef.current?.clear();
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !signatureData) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/${encodeURIComponent(slug)}/waiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim().toLowerCase(),
          signatureData,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { waiverId: number };
      onComplete({
        waiverId: data.waiverId,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit waiver. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Liability Waiver</h2>
        <p className="text-sm text-muted-foreground">
          Read and sign below to continue with your booking.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="waiver-name">Full Name</Label>
          <Input
            id="waiver-name"
            placeholder="John Doe"
            className="bg-card"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waiver-email">Email Address</Label>
          <Input
            id="waiver-email"
            type="email"
            placeholder="john@example.com"
            className="bg-card"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
      </div>

      <div
        className="border border-border/50 rounded-xl bg-card/50 p-4 overflow-y-auto"
        style={{ maxHeight: "240px" }}
      >
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {WAIVER_TEXT}
        </pre>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PenLine className="w-4 h-4 text-primary" />
            <span>Signature</span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            Clear
          </button>
        </div>

        <SignaturePad
          ref={padRef}
          onSign={setSignatureData}
          onClear={() => setSignatureData(null)}
          className="border-primary/30"
        />

        <p className="text-xs text-muted-foreground text-center">
          By signing above you confirm you have read and agree to this waiver.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm flex gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="pt-2">
        <Button
          size="lg"
          className="w-full h-14 text-base rounded-xl"
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…
            </>
          ) : (
            "Agree & Continue"
          )}
        </Button>
      </div>
    </div>
  );
}

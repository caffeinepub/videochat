import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, Copy, Share2, X } from "lucide-react";
import { useState } from "react";
import { SiWhatsapp } from "react-icons/si";
import { toast } from "sonner";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  roomUrl: string;
}

export function ShareDialog({ open, onClose, roomUrl }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(`Join my video call: ${roomUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="share.dialog"
        className="sm:max-w-md glass-heavy border-border/60"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Share Room Link
            </DialogTitle>
            <Button
              data-ocid="share.close_button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted/50"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-muted-foreground text-sm">
            Share this link to invite others to your video call.
          </p>

          {/* URL Input + Copy */}
          <div className="flex gap-2">
            <Input
              readOnly
              value={roomUrl}
              className="bg-input/30 border-border/50 text-sm font-mono text-muted-foreground"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              data-ocid="share.copy_link_button"
              variant="secondary"
              size="icon"
              className="flex-shrink-0 w-11 h-10"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* WhatsApp Share */}
          <Button
            data-ocid="share.whatsapp_button"
            className="w-full h-11 font-semibold"
            style={{
              background: "oklch(0.55 0.18 143)",
              color: "white",
            }}
            onClick={handleWhatsApp}
          >
            <SiWhatsapp className="w-5 h-5 mr-2" />
            Share on WhatsApp
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Anyone with this link can join your video call
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

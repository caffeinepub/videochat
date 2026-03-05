import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";
import { useState } from "react";

const USERNAME_KEY = "videochat_username";

interface UsernameDialogProps {
  open: boolean;
  onSave: (name: string) => void;
}

export function UsernameDialog({ open, onSave }: UsernameDialogProps) {
  const [name, setName] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(USERNAME_KEY, trimmed);
    onSave(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm glass-heavy border-border/60 [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="font-display text-lg">
              Set Your Name
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Choose a display name for the chat. Others in the room will see
            this.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-3 pt-2">
          <Input
            data-ocid="username.input"
            placeholder="Your display name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={30}
            className="bg-input/50 border-border/60 focus:border-primary/60 h-11"
          />
          <Button
            data-ocid="username.save_button"
            type="submit"
            className="w-full h-11 bg-primary text-primary-foreground font-semibold"
            disabled={!name.trim()}
          >
            Join Chat
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

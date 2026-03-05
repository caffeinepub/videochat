import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Clock,
  Plus,
  Shield,
  Users,
  Video,
  Wifi,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateRoom, useListRooms } from "../hooks/useQueries";

function formatRelativeTime(timestamp: bigint): string {
  const ms = Number(timestamp) / 1_000_000;
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const { data: rooms, isLoading: roomsLoading } = useListRooms();
  const createRoomMutation = useCreateRoom();

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }
    try {
      const roomId = await createRoomMutation.mutateAsync(roomName.trim());
      navigate({ to: "/room/$roomId", params: { roomId } });
    } catch {
      toast.error("Failed to create room. Please try again.");
    }
  }

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!joinRoomId.trim()) {
      toast.error("Please enter a Room ID");
      return;
    }
    navigate({ to: "/room/$roomId", params: { roomId: joinRoomId.trim() } });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 glass">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/generated/videochat-logo-transparent.dim_120x120.png"
              alt="VideoChat Logo"
              className="w-8 h-8 object-contain"
            />
            <span className="font-display text-xl font-bold text-gradient-teal">
              VideoChat
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wifi className="w-4 h-4 text-primary" />
            <span className="hidden sm:block">Peer-to-peer encrypted</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        {/* Hero */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-6">
            <Shield className="w-3.5 h-3.5" />
            No sign-up required · Free to use
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold leading-tight mb-4">
            <span className="text-foreground">Crystal clear</span>
            <br />
            <span className="text-gradient-teal">video conversations</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Create a room, share the link, and start talking. No apps, no
            accounts — just open your browser and connect.
          </p>
        </motion.div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Create Room */}
          <motion.div
            className="video-gradient-border rounded-2xl p-6 shadow-card-dark"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-teal-sm">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Start a New Room
                </h2>
                <p className="text-muted-foreground text-sm">
                  Create and get a shareable link
                </p>
              </div>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <Input
                data-ocid="home.create_room_input"
                placeholder="Enter room name…"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="bg-input/50 border-border/60 focus:border-primary/60 focus:ring-1 focus:ring-primary/40 h-11"
                maxLength={50}
              />
              <Button
                data-ocid="home.create_room_button"
                type="submit"
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-teal-sm transition-all duration-200"
                disabled={createRoomMutation.isPending}
              >
                {createRoomMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create &amp; Join
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </motion.div>

          {/* Join Room */}
          <motion.div
            className="video-gradient-border rounded-2xl p-6 shadow-card-dark"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Video className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Join a Room
                </h2>
                <p className="text-muted-foreground text-sm">
                  Enter a room ID or paste a link
                </p>
              </div>
            </div>
            <form onSubmit={handleJoinRoom} className="space-y-3">
              <Input
                data-ocid="home.join_room_input"
                placeholder="Enter Room ID…"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="bg-input/50 border-border/60 focus:border-primary/60 focus:ring-1 focus:ring-primary/40 h-11"
              />
              <Button
                data-ocid="home.join_room_button"
                type="submit"
                variant="secondary"
                className="w-full h-11 font-semibold transition-all duration-200 hover:bg-secondary/80"
              >
                Join Room
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </motion.div>
        </div>

        {/* Features Strip */}
        <motion.div
          className="grid grid-cols-3 gap-4 mb-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          {[
            { icon: Video, label: "HD Video", desc: "Crystal clear quality" },
            {
              icon: Shield,
              label: "Encrypted",
              desc: "P2P — no servers store your call",
            },
            {
              icon: Users,
              label: "Instant Share",
              desc: "Link works on WhatsApp",
            },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="glass rounded-xl p-4 text-center hover:border-primary/30 transition-colors duration-200"
            >
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="font-semibold text-sm text-foreground">
                {label}
              </div>
              <div className="text-muted-foreground text-xs mt-0.5">{desc}</div>
            </div>
          ))}
        </motion.div>

        {/* Recent Rooms */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold text-muted-foreground uppercase tracking-wide">
              Active Rooms
            </h2>
          </div>

          {roomsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : !rooms || rooms.length === 0 ? (
            <div
              data-ocid="home.rooms_list.empty_state"
              className="glass rounded-xl p-8 text-center"
            >
              <Video className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No rooms yet. Create the first one!
              </p>
            </div>
          ) : (
            <div
              data-ocid="home.rooms_list"
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {rooms.map((room, index) => (
                <motion.button
                  key={room.id}
                  data-ocid={`home.rooms_list.item.${index + 1}`}
                  className="glass rounded-xl p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 group w-full"
                  onClick={() =>
                    navigate({
                      to: "/room/$roomId",
                      params: { roomId: room.id },
                    })
                  }
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                        <Video className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate text-foreground">
                          {room.name}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formatRelativeTime(room.createdAt)}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 ml-2 transition-colors" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-muted-foreground text-sm">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Built with ♥ using caffeine.ai
          </a>
        </div>
      </footer>
    </div>
  );
}

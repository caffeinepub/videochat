import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  ChevronLeft,
  Circle,
  FlipHorizontal,
  Mic,
  MicOff,
  PhoneOff,
  Share2,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatPanel } from "../components/ChatPanel";
import { ShareDialog } from "../components/ShareDialog";
import { useActor } from "../hooks/useActor";
import { useGetRoom } from "../hooks/useQueries";

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function generatePeerId(): string {
  return `peer-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function getPeerId(): string {
  let id = sessionStorage.getItem("videochat_peer_id");
  if (!id) {
    id = generatePeerId();
    sessionStorage.setItem("videochat_peer_id", id);
  }
  return id;
}

type FacingMode = "user" | "environment";

function applyTrackEnabled(tracks: MediaStreamTrack[], enabled: boolean) {
  for (const t of tracks) {
    t.enabled = enabled;
  }
}

function stopTracks(stream: MediaStream | null) {
  if (!stream) return;
  for (const t of stream.getTracks()) {
    t.stop();
  }
}

export default function RoomPage() {
  const { roomId } = useParams({ from: "/room/$roomId" });
  const navigate = useNavigate();
  const { actor, isFetching } = useActor();

  // Media refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [isRecording, setIsRecording] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const localPeerId = useRef(getPeerId());
  const signalingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const offerSentRef = useRef(false);
  const processedSignalsRef = useRef<Set<string>>(new Set());

  const { data: room } = useGetRoom(roomId);
  const roomUrl = `${window.location.origin}/room/${roomId}`;

  // ─── Start local stream ───────────────────────────────────────────────────
  const startLocalStream = useCallback(
    async (facing: FacingMode): Promise<MediaStream | null> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });

        applyTrackEnabled(stream.getAudioTracks(), true);
        applyTrackEnabled(stream.getVideoTracks(), true);

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setMediaError(null);
        return stream;
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera/microphone access was denied. Please allow permissions and refresh."
            : "Could not access camera or microphone.";
        setMediaError(msg);
        return null;
      }
    },
    [],
  );

  // ─── Create RTCPeerConnection ─────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (stream: MediaStream) => {
      const pc = new RTCPeerConnection(STUN_SERVERS);

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setHasRemote(true);
        }
      };

      pc.onicecandidate = async (event) => {
        if (!event.candidate || !actor) return;
        try {
          await actor.postSignal(
            roomId,
            "broadcast",
            "ice",
            JSON.stringify(event.candidate),
          );
        } catch {
          // ignore ICE errors
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setIsConnecting(false);
          setHasRemote(true);
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          setHasRemote(false);
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [actor, roomId],
  );

  // ─── Signal polling ───────────────────────────────────────────────────────
  const processSignals = useCallback(async () => {
    if (!actor || !pcRef.current) return;

    try {
      const signals = await actor.getSignals(roomId, localPeerId.current);

      for (const signal of signals) {
        const sigKey = `${signal.signalType}-${signal.timestamp}-${signal.payload.slice(0, 20)}`;
        if (processedSignalsRef.current.has(sigKey)) continue;
        processedSignalsRef.current.add(sigKey);

        const pc = pcRef.current;

        if (signal.signalType === "offer") {
          try {
            const offerSdp = JSON.parse(
              signal.payload,
            ) as RTCSessionDescriptionInit;
            await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await actor.postSignal(
              roomId,
              "broadcast",
              "answer",
              JSON.stringify(answer),
            );
            setIsConnecting(true);
          } catch {
            // ignore malformed signals
          }
        } else if (signal.signalType === "answer") {
          if (pc.signalingState === "have-local-offer") {
            try {
              const answerSdp = JSON.parse(
                signal.payload,
              ) as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(
                new RTCSessionDescription(answerSdp),
              );
              setIsConnecting(true);
            } catch {
              // ignore
            }
          }
        } else if (signal.signalType === "ice") {
          try {
            const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore polling errors
    }
  }, [actor, roomId]);

  // ─── Initialize ──────────────────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time init, functions are stable refs
  useEffect(() => {
    if (isFetching || !actor) return;

    let cancelled = false;
    let offerTimer: ReturnType<typeof setTimeout> | null = null;

    async function init() {
      const stream = await startLocalStream(facingMode);
      if (!stream || cancelled) return;

      const pc = createPeerConnection(stream);

      // Send offer after short delay
      offerTimer = setTimeout(async () => {
        if (cancelled || offerSentRef.current) return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await actor!.postSignal(
            roomId,
            "broadcast",
            "offer",
            JSON.stringify(offer),
          );
          offerSentRef.current = true;
        } catch {
          // ignore offer errors
        }
      }, 2000);

      // Start polling
      signalingIntervalRef.current = setInterval(() => {
        processSignals();
      }, 2000);
    }

    init();

    return () => {
      cancelled = true;
      if (offerTimer) clearTimeout(offerTimer);
      if (signalingIntervalRef.current) {
        clearInterval(signalingIntervalRef.current);
      }
      stopTracks(localStreamRef.current);
      pcRef.current?.close();
    };
  }, [actor, isFetching, roomId]);

  // ─── Controls ────────────────────────────────────────────────────────────
  function toggleMute() {
    setIsMuted((prev) => {
      const next = !prev;
      applyTrackEnabled(localStreamRef.current?.getAudioTracks() ?? [], !next);
      return next;
    });
  }

  function toggleCamera() {
    setIsCameraOff((prev) => {
      const next = !prev;
      applyTrackEnabled(localStreamRef.current?.getVideoTracks() ?? [], !next);
      return next;
    });
  }

  async function flipCamera() {
    const nextFacing: FacingMode =
      facingMode === "user" ? "environment" : "user";

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      applyTrackEnabled(newStream.getAudioTracks(), !isMuted);
      applyTrackEnabled(newStream.getVideoTracks(), !isCameraOff);

      // Replace tracks in peer connection
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const newVideoTrack = newStream.getVideoTracks()[0];
        const newAudioTrack = newStream.getAudioTracks()[0];

        const videoSender = senders.find((s) => s.track?.kind === "video");
        const audioSender = senders.find((s) => s.track?.kind === "audio");

        await Promise.all([
          newVideoTrack && videoSender
            ? videoSender.replaceTrack(newVideoTrack)
            : Promise.resolve(),
          newAudioTrack && audioSender
            ? audioSender.replaceTrack(newAudioTrack)
            : Promise.resolve(),
        ]);
      }

      stopTracks(localStreamRef.current);
      localStreamRef.current = newStream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }

      setFacingMode(nextFacing);
      toast.success(
        `Switched to ${nextFacing === "user" ? "front" : "rear"} camera`,
      );
    } catch {
      toast.error("Could not switch camera");
    }
  }

  function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      toast.success("Recording stopped — downloading…");
    } else {
      if (!localStreamRef.current) {
        toast.error("No stream to record");
        return;
      }
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(localStreamRef.current, {
        mimeType: "video/webm;codecs=vp8,opus",
      });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `videochat-${roomId}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      toast.success("Recording started");
    }
  }

  function handleLeave() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    }
    stopTracks(localStreamRef.current);
    pcRef.current?.close();
    if (signalingIntervalRef.current) {
      clearInterval(signalingIntervalRef.current);
    }
    navigate({ to: "/" });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 h-14 border-b border-border/40 glass flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted/50"
              onClick={handleLeave}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <span className="font-display font-semibold text-sm">
                {room?.name ?? "Video Room"}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono text-xs opacity-60">
                  {roomId.slice(0, 8)}…
                </span>
                {hasRemote && (
                  <>
                    <span>·</span>
                    <Users className="w-3 h-3" />
                    <span className="text-primary">Connected</span>
                  </>
                )}
                {isConnecting && !hasRemote && (
                  <>
                    <span>·</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-yellow-400">Connecting…</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <img
            src="/assets/generated/videochat-logo-transparent.dim_120x120.png"
            alt="VideoChat"
            className="w-7 h-7 object-contain opacity-80"
          />
        </header>

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Video area */}
          <div className="flex-1 min-h-0 flex flex-col relative bg-[oklch(0.08_0.015_240)]">
            {/* Media error */}
            {mediaError && (
              <div
                data-ocid="call.error_state"
                className="absolute inset-0 flex items-center justify-center z-20 bg-background/80 backdrop-blur-sm p-6"
              >
                <div className="glass rounded-2xl p-6 max-w-sm text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                  <p className="font-semibold">Camera/Mic Access Error</p>
                  <p className="text-muted-foreground text-sm">{mediaError}</p>
                  <Button
                    variant="secondary"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Remote video */}
            <div className="flex-1 relative flex items-center justify-center min-h-0">
              {!hasRemote && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4 pointer-events-none">
                  <div className="glass rounded-2xl px-8 py-6 text-center max-w-xs">
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-7 h-7 text-primary" />
                    </div>
                    <p className="font-display font-semibold text-foreground mb-1">
                      {room?.name ?? "Waiting…"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Waiting for someone to join…
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      Share the room link to invite others
                    </p>
                  </div>
                </div>
              )}
              {/* biome-ignore lint/a11y/useMediaCaption: live video stream, captions not applicable */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-500 ${hasRemote ? "opacity-100" : "opacity-0"}`}
              />
            </div>

            {/* Local video PiP */}
            <motion.div
              className="absolute bottom-20 right-4 w-28 sm:w-36 aspect-video rounded-xl overflow-hidden shadow-video video-gradient-border z-20"
              drag
              dragConstraints={{
                top: -200,
                left: -200,
                right: 0,
                bottom: 0,
              }}
              whileDrag={{ scale: 1.05 }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                aria-label="Your camera preview"
                className={`w-full h-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""} ${isCameraOff ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
              >
                <track kind="captions" />
              </video>
              {isCameraOff && (
                <div className="absolute inset-0 bg-muted/80 flex items-center justify-center">
                  <VideoOff className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 right-1 text-center">
                <span className="text-xs text-white/80 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                  You
                </span>
              </div>
            </motion.div>

            {/* Control bar */}
            <div className="absolute bottom-0 left-0 right-0 z-30">
              <div
                className="mx-auto px-4 py-3 flex items-center justify-center gap-2 sm:gap-3"
                style={{
                  background: "oklch(0.14 0.016 240 / 85%)",
                  backdropFilter: "blur(20px)",
                  borderTop: "1px solid oklch(0.28 0.025 240 / 50%)",
                }}
              >
                {/* Mute */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-ocid="call.mute_toggle"
                      className={`control-btn ${
                        isMuted
                          ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                          : "bg-muted/60 text-foreground hover:bg-muted"
                      }`}
                      onClick={toggleMute}
                      aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? (
                        <MicOff className="w-5 h-5" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isMuted ? "Unmute" : "Mute"}</TooltipContent>
                </Tooltip>

                {/* Camera toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-ocid="call.camera_toggle"
                      className={`control-btn ${
                        isCameraOff
                          ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                          : "bg-muted/60 text-foreground hover:bg-muted"
                      }`}
                      onClick={toggleCamera}
                      aria-label={
                        isCameraOff ? "Turn camera on" : "Turn camera off"
                      }
                    >
                      {isCameraOff ? (
                        <VideoOff className="w-5 h-5" />
                      ) : (
                        <Video className="w-5 h-5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isCameraOff ? "Turn camera on" : "Turn camera off"}
                  </TooltipContent>
                </Tooltip>

                {/* Flip camera */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-ocid="call.camera_flip_button"
                      className="control-btn bg-muted/60 text-foreground hover:bg-muted"
                      onClick={flipCamera}
                      aria-label="Flip camera"
                    >
                      <FlipHorizontal className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Flip Camera</TooltipContent>
                </Tooltip>

                {/* Share */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-ocid="call.share_button"
                      className="control-btn bg-primary/20 text-primary hover:bg-primary/30 glow-teal-sm"
                      onClick={() => setShareDialogOpen(true)}
                      aria-label="Share link"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Share Link</TooltipContent>
                </Tooltip>

                {/* Record */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-ocid="call.record_button"
                      className={`control-btn ${
                        isRecording
                          ? "bg-destructive/20 text-destructive animate-pulse-glow"
                          : "bg-muted/60 text-foreground hover:bg-muted"
                      }`}
                      onClick={toggleRecording}
                      aria-label={
                        isRecording ? "Stop recording" : "Start recording"
                      }
                    >
                      <Circle
                        className={`w-5 h-5 ${isRecording ? "fill-destructive" : ""}`}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRecording ? "Stop Recording" : "Start Recording"}
                  </TooltipContent>
                </Tooltip>

                {/* Divider */}
                <div className="w-px h-8 bg-border/50 mx-1" />

                {/* Leave */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-ocid="call.leave_button"
                      className="control-btn bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md"
                      onClick={handleLeave}
                      aria-label="Leave call"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Leave Call</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Chat panel */}
          <aside className="lg:w-80 xl:w-96 flex flex-col h-48 lg:h-full border-t lg:border-t-0 lg:border-l border-border/40 bg-card/50 flex-shrink-0">
            <ChatPanel roomId={roomId} />
          </aside>
        </div>

        {/* Share dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          roomUrl={roomUrl}
        />
      </div>
    </TooltipProvider>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message, Room } from "../backend.d";
import { useActor } from "./useActor";

export function useListRooms() {
  const { actor, isFetching } = useActor();
  return useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      if (!actor) return [];
      const rooms = await actor.listRooms();
      return rooms.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
  });
}

export function useGetRoom(roomId: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Room | null>({
    queryKey: ["room", roomId],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getRoom(roomId);
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!roomId,
  });
}

export function useGetMessages(roomId: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Message[]>({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      if (!actor) return [];
      const msgs = await actor.getMessages(roomId);
      return msgs.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    },
    enabled: !!actor && !isFetching && !!roomId,
    refetchInterval: 2000,
  });
}

export function useCreateRoom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createRoom(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      sender,
      content,
    }: {
      roomId: string;
      sender: string;
      content: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.sendMessage(roomId, sender, content);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", variables.roomId],
      });
    },
  });
}

export function usePostSignal() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      roomId,
      peerId,
      signalType,
      payload,
    }: {
      roomId: string;
      peerId: string;
      signalType: string;
      payload: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.postSignal(roomId, peerId, signalType, payload);
    },
  });
}

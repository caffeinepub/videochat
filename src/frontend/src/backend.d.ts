import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Signal {
    timestamp: bigint;
    roomId: string;
    senderId: string;
    payload: string;
    signalType: string;
}
export interface Room {
    id: string;
    name: string;
    createdAt: bigint;
}
export interface Message {
    id: bigint;
    content: string;
    sender: string;
    timestamp: bigint;
    roomId: string;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createRoom(name: string): Promise<string>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getMessages(roomId: string): Promise<Array<Message>>;
    getRoom(roomId: string): Promise<Room>;
    getSignals(roomId: string, _peerId: string): Promise<Array<Signal>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listRooms(): Promise<Array<Room>>;
    postSignal(roomId: string, senderId: string, signalType: string, payload: string): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendMessage(roomId: string, sender: string, content: string): Promise<bigint>;
}

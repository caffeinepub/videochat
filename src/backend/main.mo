import Array "mo:core/Array";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile System
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Video Chat Application Types
  type Room = {
    id : Text;
    name : Text;
    createdAt : Int;
  };

  type Message = {
    id : Nat;
    roomId : Text;
    sender : Text;
    content : Text;
    timestamp : Int;
  };

  type Signal = {
    roomId : Text;
    peerId : Text;
    signalType : Text;
    payload : Text;
    timestamp : Int;
  };

  // Storage
  let rooms = Map.empty<Text, Room>();
  let messages = Map.empty<Text, [Message]>();
  let signals = Map.empty<Text, [Signal]>();
  var nextMessageId = 0;

  // Room Management
  public shared ({ caller }) func createRoom(name : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create rooms");
    };

    let roomId = name.concat(Time.now().toText());
    let room = {
      id = roomId;
      name;
      createdAt = Time.now();
    };
    rooms.add(roomId, room);
    roomId;
  };

  public query ({ caller }) func getRoom(roomId : Text) : async Room {
    // Accessible to all users including guests
    switch (rooms.get(roomId)) {
      case (null) { Runtime.trap("Room does not exist") };
      case (?room) { room };
    };
  };

  public query ({ caller }) func listRooms() : async [Room] {
    // Accessible to all users including guests
    rooms.values().toArray();
  };

  // Message Management
  public shared ({ caller }) func sendMessage(roomId : Text, sender : Text, content : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can send messages");
    };

    let message : Message = {
      id = nextMessageId;
      roomId;
      sender;
      content;
      timestamp = Time.now();
    };
    nextMessageId += 1;

    switch (messages.get(roomId)) {
      case (null) {
        messages.add(roomId, [message]);
      };
      case (?existingMessages) {
        messages.add(roomId, existingMessages.concat([message]));
      };
    };

    message.id;
  };

  public query ({ caller }) func getMessages(roomId : Text) : async [Message] {
    // Accessible to all users including guests
    switch (messages.get(roomId)) {
      case (null) { [] };
      case (?msgs) { msgs };
    };
  };

  // Signal Management (WebRTC)
  public shared ({ caller }) func postSignal(roomId : Text, peerId : Text, signalType : Text, payload : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can post signals");
    };

    let signal : Signal = {
      roomId;
      peerId;
      signalType;
      payload;
      timestamp = Time.now();
    };

    let signalKey = roomId.concat(peerId);

    switch (signals.get(signalKey)) {
      case (null) {
        signals.add(signalKey, [signal]);
      };
      case (?existingSignals) {
        signals.add(signalKey, existingSignals.concat([signal]));
      };
    };

    true;
  };

  public shared ({ caller }) func getSignals(roomId : Text, peerId : Text) : async [Signal] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can retrieve signals");
    };

    let signalKey = roomId.concat(peerId);
    let result = switch (signals.get(signalKey)) {
      case (null) { [] };
      case (?sigs) { sigs };
    };

    // Clear signals after retrieval
    signals.remove(signalKey);

    result;
  };
};

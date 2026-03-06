import Array "mo:core/Array";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Principal "mo:core/Principal";

import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Runtime "mo:core/Runtime";


// Apply migration on upgrade

actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile System (kept for platform requirements)
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
  public type Room = {
    id : Text;
    name : Text;
    createdAt : Int;
  };

  public type Message = {
    id : Nat;
    roomId : Text;
    sender : Text;
    content : Text;
    timestamp : Int;
  };

  public type Signal = {
    roomId : Text;
    senderId : Text;
    signalType : Text;
    payload : Text;
    timestamp : Int;
  };

  // Storage
  let rooms = Map.empty<Text, Room>();
  let messages = Map.empty<Text, [Message]>();
  let signals = Map.empty<Text, [Signal]>();
  var nextMessageId = 0;

  // Room Management - Open to all including anonymous
  public shared ({ caller }) func createRoom(name : Text) : async Text {
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
    switch (rooms.get(roomId)) {
      case (null) { Runtime.trap("Room does not exist") };
      case (?room) { room };
    };
  };

  public query ({ caller }) func listRooms() : async [Room] {
    rooms.values().toArray();
  };

  // Message Management - Open to all including anonymous
  public shared ({ caller }) func sendMessage(roomId : Text, sender : Text, content : Text) : async Nat {
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
    switch (messages.get(roomId)) {
      case (null) { [] };
      case (?msgs) { msgs };
    };
  };

  // Signal Management (WebRTC) - Open to all including anonymous
  public shared ({ caller }) func postSignal(roomId : Text, senderId : Text, signalType : Text, payload : Text) : async Bool {
    let signal : Signal = {
      roomId;
      senderId;
      signalType;
      payload;
      timestamp = Time.now();
    };

    switch (signals.get(roomId)) {
      case (null) {
        signals.add(roomId, [signal]);
      };
      case (?existingSignals) {
        signals.add(roomId, existingSignals.concat([signal]));
      };
    };
    true;
  };

  public shared ({ caller }) func getSignals(roomId : Text, _peerId : Text) : async [Signal] {
    // Get current signals or empty
    let currentSignals = switch (signals.get(roomId)) {
      case (null) { [] };
      case (?s) { s };
    };

    // Filter signals older than 30 seconds
    let now = Time.now();
    let filteredSignals = currentSignals.filter(
      func(signal) { (now - signal.timestamp) <= 30_000_000_000 },
    );

    // Update signals map with filtered signals
    if (filteredSignals.size() > 0) {
      signals.add(roomId, filteredSignals);
    } else {
      signals.remove(roomId);
    };

    currentSignals;
  };
};

const User = require("../models/user");
const FriendRequest = require("../models/FriendRequest");

const emitFriendRequest = (receiverUid, payload) => {
  try {
    const { io, onlineUsers } = require("../server");
    const receiverSocket = onlineUsers[receiverUid];

    if (receiverSocket) {
      io.to(receiverSocket).emit("friend_request_received", payload);
    }
  } catch (err) {
    console.error("Friend request socket emit failed:", err.message);
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q, currentUid } = req.query;

    if (!q?.trim()) {
      return res.json([]);
    }

    const users = await User.find({
      uid: { $ne: currentUid },
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { uid: { $regex: q, $options: "i" } },
      ],
    }).select("_id uid name email picture");

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendRequest = async (req, res) => {
  try {
    const { senderUid, receiverUid } = req.body;

    if (senderUid === receiverUid) {
      return res.status(400).json({ error: "You cannot send request to yourself" });
    }

    const sender = await User.findOne({ uid: senderUid });
    const receiver = await User.findOne({ uid: receiverUid });

    if (!sender || !receiver) {
      return res.status(404).json({ error: "User not found" });
    }

    const alreadyFriend = sender.friends.some(
      (id) => id.toString() === receiver._id.toString()
    );

    if (alreadyFriend) {
      return res.status(400).json({ error: "Already friends" });
    }

    const existing = await FriendRequest.findOne({
      sender: sender._id,
      receiver: receiver._id,
      status: "pending",
    });

    if (existing) {
      return res.status(400).json({ error: "Request already sent" });
    }

    const reverse = await FriendRequest.findOne({
      sender: receiver._id,
      receiver: sender._id,
      status: "pending",
    });

    if (reverse) {
      return res.status(400).json({ error: "This user already sent you a request" });
    }

    const request = await FriendRequest.create({
      sender: sender._id,
      receiver: receiver._id,
    });

    emitFriendRequest(receiver.uid, {
      id: request._id.toString(),
      senderId: sender._id.toString(),
      uid: sender.uid,
      name: sender.name,
      photoURL: sender.picture,
      league: "Champion's League",
      rank: "Diamond Tier",
    });

    res.json({ message: "Friend request sent", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const { uid } = req.params;

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const requests = await FriendRequest.find({
      receiver: user._id,
      status: "pending",
    }).populate("sender", "uid name email picture");

    const formatted = requests.map((reqDoc) => ({
      id: reqDoc._id,
      senderId: reqDoc.sender._id,
      uid: reqDoc.sender.uid,
      name: reqDoc.sender.name,
      photoURL: reqDoc.sender.picture,
      league: "Champion's League",
      rank: "Diamond Tier",
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.body;

    const request = await FriendRequest.findById(requestId);
    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Pending request not found" });
    }

    request.status = "accepted";
    await request.save();

    const senderUser = await User.findById(request.sender).select("uid name picture");
    const receiverUser = await User.findById(request.receiver).select("uid name picture");

    if (senderUser) {
      await User.findByIdAndUpdate(request.sender, {
        $addToSet: {
          friends: {
            uid: receiverUser.uid,
            name: receiverUser.name,
            picture: receiverUser.picture,
          },
        },
      });
    }

    if (receiverUser) {
      await User.findByIdAndUpdate(request.receiver, {
        $addToSet: {
          friends: {
            uid: senderUser.uid,
            name: senderUser.name,
            picture: senderUser.picture,
          },
        },
      });
    }

    res.json({ message: "Friend request accepted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.declineRequest = async (req, res) => {
  try {
    const { requestId } = req.body;

    const request = await FriendRequest.findById(requestId);
    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Pending request not found" });
    }

    request.status = "declined";
    await request.save();

    res.json({ message: "Friend request declined" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//FIXED BY YASH
exports.getFriendsList = async (req, res) => {
  try {
    const { uid } = req.params;

    const user = await User.findOne({ uid });

    if (!user) {
      return res.json([]); // ✅ always array
    }

    const friendUids = user.friends.map((friend) => friend.uid).filter(Boolean);

    if (friendUids.length === 0) {
      return res.json([]);
    }

    const friends = await User.find({
      uid: { $in: friendUids },
    });

    const formatted = friends.map((friend) => ({
      uid: friend.uid,
      name: friend.name,
      photoURL: friend.picture || friend.photoURL || "",
      status: "Online",
    }));

    return res.json(formatted); // ✅ always array

  } catch (err) {
    console.error(err);
    return res.status(500).json([]); // ✅ still array
  }
};
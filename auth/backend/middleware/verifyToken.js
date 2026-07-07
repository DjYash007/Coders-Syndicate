const admin = require("firebase-admin");

const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || req.headers.Authorization;

    if (!header) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = header.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(token);

    req.user = decoded;

    next();
  } catch (err) {
    const header = req.headers.authorization || req.headers.Authorization;
    const token = header ? header.replace(/^Bearer\s+/i, "").trim() : "";
    console.error("❌ Token Error:", err.code || err.message, err.message);
    console.error("❌ Auth header:", header ? `${header.slice(0, 30)}...` : "<none>");
    console.error("❌ Token length:", token.length);
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = verifyToken;
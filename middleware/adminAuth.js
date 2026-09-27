const jwt = require('jsonwebtoken');

const verifyAdmin = (req, res, next) => {
  // 1. Get the token from the request header
  const token = req.headers.authorization?.split(" ")[1];
  
  // 2. If there is no token, block them
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    // 3. Check if the token is valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_aq_key_2026');
    
    // 4. Check if they are an admin
    if (!decoded.adminId) return res.status(403).json({ error: "Not authorized as admin." });
    
    req.adminId = decoded.adminId;
    next(); // Let them pass
  } catch (error) {
    res.status(401).json({ error: "Invalid token." });
  }
};

module.exports = verifyAdmin;
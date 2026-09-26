const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'aq_beauty_hub_jwt_secret_key_2026';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==========================================
// 1. REGISTER ENDPOINT
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email: cleanEmail,
      password: hashedPassword,
      authProvider: 'local'
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        image: user.profileImage
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.', details: error.message });
  }
});

// ==========================================
// 2. LOGIN ENDPOINT
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({ 
        error: 'This account uses Google Login. Please click "Continue with Google".' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        image: user.profileImage
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login.', details: error.message });
  }
});

// ==========================================
// 3. GOOGLE OAUTH ENDPOINT
// ==========================================
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    // Verify Google ID Token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const { email, name, sub, picture } = ticket.getPayload();
    const cleanEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });

    if (user) {
      // Account Linking Protocol
      if (!user.googleId) {
        user.googleId = sub;
        if (!user.profileImage && picture) {
          user.profileImage = picture;
        }
        await user.save();
      }
    } else {
      // Create new account
      user = new User({
        name,
        email: cleanEmail,
        googleId: sub,
        authProvider: 'google',
        profileImage: picture || ''
      });
      await user.save();
    }

    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Google login successful',
      token: jwtToken,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        image: user.profileImage
      }
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(400).json({ error: 'Invalid Google token or authentication failed.' });
  }
});

// ==========================================
// 4. UPDATE PROFILE PICTURE
// ==========================================
router.put('/update/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { profileImage: req.body.image },
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      userId: updatedUser._id, 
      name: updatedUser.name, 
      email: updatedUser.email, 
      image: updatedUser.profileImage 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

module.exports = router;
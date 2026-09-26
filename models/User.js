const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String,
    // Not required because users signing up via Google won't have a password
  },
  googleId: { 
    type: String 
  },
  authProvider: { 
    type: String, 
    enum: ['local', 'google'], 
    default: 'local' 
  },
  role: { 
    type: String, 
    enum: ['customer', 'admin'], 
    default: 'customer' 
  },
  profileImage: { 
    type: String, 
    default: '' 
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
const mongoose = require('mongoose');

// 1. Define the Blueprint (Schema)
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  price: { 
    type: Number, 
    required: true,
    min: [0, 'Price cannot be negative'] 
  },
  category: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    required: true 
  },
  image: { 
    type: String, 
    required: true 
  },
  stock: { 
    type: Number, 
    required: true,
    min: [0, 'Stock cannot be negative'], 
    default: 0
  },
  isSale: { 
    type: Boolean, 
    default: false 
  },
  rating: { 
    type: Number, 
    default: 5.0,
    min: 1,
    max: 5
  }
}, { 
  timestamps: true 
});

// 2. Create and Export the Model
module.exports = mongoose.model('Product', productSchema);
const mongoose = require('mongoose');

// 1. Define the Blueprint (Schema)
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  price: { 
    // This will now represent the PKR price
    type: Number, 
    required: true,
    min: [0, 'Price cannot be negative'] 
  },
  salePrice: {
    // NEW: Optional field for discounted PKR price
    type: Number,
    min: [0, 'Sale price cannot be negative'],
    default: null
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

// Add a pre-save hook to ensure salePrice isn't higher than regular price
productSchema.pre('save', function(next) {
  try {
    if (this.salePrice && this.salePrice >= this.price) {
      this.salePrice = undefined; // Use undefined instead of null to prevent MongoDB cast errors
      this.isSale = false;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// 2. Create and Export the Model
module.exports = mongoose.model('Product', productSchema);
const Product = require('../models/Product');

// 1. Fetch all products from the database
const getProducts = async (req, res) => {
  try {
    // .find({}) tells Mongoose to get everything in the Products collection
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
};

// Fetch a SINGLE product by its ID
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching single product:', error);
    res.status(500).json({ message: 'Server error while fetching product' });
  }
};

// 2. Create a new product and save it to the database
const createProduct = async (req, res) => {
  try {
    // Extract the data sent by the client in the request body
    const { name, price, category, description, image, stock } = req.body;

    // Basic Validation: Ensure no fields are missing before trying to save
    if (!name || price === undefined || !category || !description || !image || stock === undefined) {
      return res.status(400).json({ message: 'Please provide all required product fields' });
    }

    // Create a new Product using the blueprint (Schema) we made earlier
    const product = new Product({
      name,
      price,
      category,
      description,
      image,
      stock
    });

    // Save it to MongoDB Atlas
    const savedProduct = await product.save();
    
    // 201 means "Created Successfully"
    res.status(201).json(savedProduct);

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error while creating product', error: error.message });
  }
};

// 3. Update an existing product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // findByIdAndUpdate takes the ID, the new data (req.body), and { new: true } tells it to return the updated version
    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error while updating product' });
  }
};

// 4. Delete a product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedProduct = await Product.findByIdAndDelete(id);
    
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error while deleting product' });
  }
};

// Update your exports at the very bottom to include the new functions!
module.exports = {
  getProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct
};


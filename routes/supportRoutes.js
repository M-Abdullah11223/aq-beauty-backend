const express = require('express');
const router = express.Router();
const Support = require('../models/Support');

// POST /api/support - Receive support inquiry
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields: name, email, subject, and message.' 
      });
    }

    // Save to MongoDB
    const newSupportEntry = new Support({
      name,
      email,
      subject,
      message
    });

    await newSupportEntry.save();

    console.log(`[SUPPORT INQUIRY] New message from ${name} (${email}): "${subject}"`);

    return res.status(201).json({
      success: true,
      message: 'Support request submitted successfully.',
      data: newSupportEntry
    });
  } catch (error) {
    console.error('Error handling support request:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing your request. Please try again later.'
    });
  }
});

// GET /api/support - Fetch all support messages (For Admin Dashboard)
router.get('/', async (req, res) => {
  try {
    const messages = await Support.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching support messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving support messages.'
    });
  }
});

module.exports = router;
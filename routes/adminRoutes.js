const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const admin = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// Dashboard
router.get('/dashboard', admin.getDashboard);

// Users
router.get('/users', admin.getUsers);
router.get('/users/:id', admin.getUserDetail);
router.put('/users/:id', admin.updateUser);
router.delete('/users/:id', admin.deleteUser);

// Sessions
router.get('/sessions', admin.getSessions);
router.get('/sessions/:id', admin.getSessionDetail);
router.delete('/sessions/:id', admin.deleteSession);

// Rooms
router.get('/rooms', admin.getRooms);
router.get('/rooms/:id', admin.getRoomDetail);
router.delete('/rooms/:id', admin.deleteRoom);

// Messages
router.get('/messages', admin.getMessages);
router.delete('/messages/:id', admin.deleteMessage);

// Calls
router.get('/calls', admin.getCalls);

// Notifications
router.post('/notifications/send', admin.sendSystemNotification);

// Chatbot training
router.get('/chatbot/queries', admin.getChatbotQueries);

// Reports
router.get('/reports', admin.getReports);

module.exports = router;

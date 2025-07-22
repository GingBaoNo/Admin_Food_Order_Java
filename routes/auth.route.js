
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/login', authController.getLogin);
router.post('/auth/login', authController.postLogin);

router.get('/register', authController.getRegister);
router.post('/auth/register', authController.postRegister);

router.get('/logout', authController.logout);

module.exports = router;
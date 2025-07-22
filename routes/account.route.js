const express = require('express');
const router = express.Router();
const controller = require('../controllers/account.controller'); 

router.get('/', controller.getAccounts);
router.delete('/delete/:id', controller.deleteAccount);

module.exports = router;
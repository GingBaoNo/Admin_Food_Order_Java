// routes/admin/order.route.js

const express = require('express');
const router = express.Router();
const controller = require('../controllers/order.contronller'); // Đường dẫn tới controller

// [GET] /admin/orders
router.get('/', controller.index);

router.get('/detail/:id', controller.detail);

// [PATCH] /admin/orders/change-status/:id
router.patch('/change-status/:id', controller.changeStatus);

module.exports = router;
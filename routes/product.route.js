// routes/product.route.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', productController.product);

router.get('/create', productController.createView);
router.post('/create', upload.single('ImagePath'), productController.createFood);

router.get('/detail/:id', productController.detail);

router.get('/edit/:id', productController.edit);

router.post('/edit/:id', upload.single('ImagePath'), productController.editPatch);
router.patch('/update-position/:id', productController.updatePosition);

// Thay đổi từ router.post sang router.delete
router.delete('/delete/:id', productController.deleteFood); // Đã đổi đường dẫn thành /delete/:id cho chuẩn RESTful


module.exports = router;
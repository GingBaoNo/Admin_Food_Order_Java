// routes/admin/category.route.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Cấu hình Multer cho việc xử lý file

const categoryController = require('../controllers/category.controller');

// Tuyến đường cho Danh mục
router.get('/', categoryController.index);
router.get('/create', categoryController.createView);
router.post('/create', upload.single('ImagePath'), categoryController.createCategory);
router.get('/edit/:key', categoryController.editView);
router.patch('/edit/:key', upload.single('ImagePath'), categoryController.editPatch); 
router.delete('/delete/:key', categoryController.deleteCategory); 

module.exports = router;
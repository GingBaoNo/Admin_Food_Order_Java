// controllers/category.controller.js
const fs = require('fs');
const path = require('path');
const admin = require('../config/firebase');
const bucket = admin.storage().bucket();
const PATCH_ADMIN = "/admin";

module.exports = {
    prefixAdmin: PATCH_ADMIN,

    index: async (req, res) => {
        try {
            const snapshot = await admin.database().ref('Category').once('value');
            let data = snapshot.val();

            let categories = data ? Object.entries(data).map(([key, category]) => ({ key, ...category })) : [];

            categories.sort((a, b) => (a.Id || 0) - (b.Id || 0));

            res.render('pages/category/index', {
                pageTitle: "Quản lý Danh mục",
                categories: categories
            });
        } catch (error) {
            console.error("Error fetching categories:", error);
            req.flash("error", "Lỗi khi lấy danh sách danh mục!");
            res.redirect("back");
        }
    },

    createView: (req, res) => {
        res.render('pages/category/create', {
            pageTitle: "Thêm Danh mục mới"
        });
    },


    createCategory: async (req, res) => {
        try {
            const newCategoryData = { ...req.body };

            // Xử lý upload ảnh
            if (req.file) {
                const filename = `${Date.now()}-${req.file.originalname}`;
                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                const tempFilePath = path.join(tempDir, filename);
                fs.writeFileSync(tempFilePath, req.file.buffer);

                await bucket.upload(tempFilePath, {
                    destination: `category_images/${filename}`, 
                    public: true,
                    metadata: { contentType: req.file.mimetype }
                });

                newCategoryData.ImagePath = `https://storage.googleapis.com/${bucket.name}/category_images/${filename}`;
                fs.unlinkSync(tempFilePath); 
            } else {
                newCategoryData.ImagePath = ""; 
            }


            const snapshot = await admin.database().ref('Category').once('value');
            const categoriesData = snapshot.val();
            let nextId = 0;
            if (categoriesData) {
                const existingIds = Object.values(categoriesData).map(cat => cat.Id || 0);
                nextId = Math.max(...existingIds) + 1;
            }
            newCategoryData.Id = nextId; 

            newCategoryData.CreatedAt = admin.database.ServerValue.TIMESTAMP;
            newCategoryData.UpdatedAt = admin.database.ServerValue.TIMESTAMP;


            const newCategoryRef = admin.database().ref('Category').push();
            await newCategoryRef.set(newCategoryData);

            req.flash("success", "Thêm danh mục mới thành công!");
            res.redirect(`${PATCH_ADMIN}/categories`);
        } catch (error) {
            console.error("Error creating new category:", error);
            req.flash("error", `Lỗi khi thêm danh mục mới: ${error.message}`);
            res.redirect("back");
        }
    },

    // [GET] /admin/categories/edit/:key
    editView: async (req, res) => {
        try {
            const { key } = req.params; 
            const snapshot = await admin.database().ref(`Category/${key}`).once('value');
            const category = snapshot.val();
            if (!category) {
                req.flash("error", "Không tìm thấy danh mục để chỉnh sửa!");
                return res.redirect(`${PATCH_ADMIN}/categories`);
            }
            category.key = key; 

            res.render('pages/category/edit', {
                pageTitle: `Chỉnh sửa danh mục: ${category.Name || 'N/A'}`,
                category: category
            });
        } catch (error) {
            console.error("Error fetching category for edit:", error);
            req.flash("error", "Lỗi khi lấy thông tin danh mục để chỉnh sửa!");
            res.redirect(`${PATCH_ADMIN}/categories`);
        }
    },


    editPatch: async (req, res) => {
        try {
            const { key } = req.params;
            const updates = { ...req.body };


            if (req.file) {
                const filename = `${Date.now()}-${req.file.originalname}`;
                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                const tempFilePath = path.join(tempDir, filename);
                fs.writeFileSync(tempFilePath, req.file.buffer);

                await bucket.upload(tempFilePath, {
                    destination: `category_images/${filename}`,
                    public: true,
                    metadata: { contentType: req.file.mimetype }
                });

                const imageUrl = `https://storage.googleapis.com/${bucket.name}/category_images/${filename}`;
                updates.ImagePath = imageUrl;
                fs.unlinkSync(tempFilePath);

                // Xóa ảnh cũ nếu có
                const oldCategorySnapshot = await admin.database().ref(`Category/${key}`).once('value');
                const oldImagePath = oldCategorySnapshot.val()?.ImagePath;
                if (oldImagePath && oldImagePath.includes('storage.googleapis.com')) {
                    const match = oldImagePath.match(/\/([^/]+\/[^/]+)$/);
                    if (match?.[1]) {
                        const oldImageRef = bucket.file(match[1]);
                        await oldImageRef.delete().catch(err =>
                            console.warn("Không thể xóa ảnh cũ trên Firebase Storage:", err.message)
                        );
                    }
                }
            }

            updates.UpdatedAt = admin.database.ServerValue.TIMESTAMP;

            await admin.database().ref(`Category/${key}`).update(updates);

            req.flash("success", "Cập nhật danh mục thành công!");
            res.redirect(`${PATCH_ADMIN}/categories`);
        } catch (error) {
            console.error("Error updating category:", error);
            req.flash("error", `Lỗi khi cập nhật danh mục: ${error.message}`);
            res.redirect("back");
        }
    },

    // [DELETE] /admin/categories/delete/:key
    deleteCategory: async (req, res) => {
        try {
            const { key } = req.params;
            const snapshot = await admin.database().ref(`Category/${key}`).once('value');
            const category = snapshot.val();

            if (!category) {
                return res.status(404).json({ error: "Không tìm thấy danh mục để xóa!" });
            }

            const imagePath = category.ImagePath;
            if (imagePath && imagePath.includes('storage.googleapis.com')) {
                const match = imagePath.match(/\/([^/]+\/[^/]+)$/);
                if (match?.[1]) {
                    const fileRef = bucket.file(match[1]);
                    await fileRef.delete().catch(err => {
                        console.warn("Không thể xóa ảnh cũ trên Firebase Storage:", err.message);
                    });
                }
            }

            await admin.database().ref(`Category/${key}`).remove();
            res.status(200).json({ message: "Xóa danh mục thành công!" });
        } catch (error) {
            console.error("Lỗi khi xóa danh mục:", error);
            res.status(500).json({ error: `Lỗi khi xóa danh mục: ${error.message}` });
        }
    }
};
// controllers/product.controller.js
const fs = require('fs');
const path = require('path');
const admin = require('../config/firebase');
const bucket = admin.storage().bucket();
const PATCH_ADMIN = "/admin";

function removeVietnameseDiacritics(str) {
    if (typeof str !== 'string') return str;
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    str = str.replace(/ + /g, " ");
    return str.trim();
}

module.exports = {
    prefixAdmin: PATCH_ADMIN,

    // [GET] /admin/products
    product: async (req, res) => {
        try {
            const snapshot = await admin.database().ref('Foods').once('value');
            let data = snapshot.val();
            let foods = data ? Object.entries(data).map(([id, food]) => ({ id, ...food })) : [];

            const keyword = req.query.keyword;
            if (keyword) {
                const normalizedKeyword = removeVietnameseDiacritics(keyword);
                foods = foods.filter(food =>
                    food.Title && removeVietnameseDiacritics(food.Title).includes(normalizedKeyword)
                );
            }

            const status = req.query.status;
            if (status && status !== "") {
                foods = foods.filter(food => food.Status === status);
            }

            const sort = req.query.sort;
            if (sort) {
                const [field, order] = sort.split('-');
                foods.sort((a, b) => {
                    let valueA = a[field], valueB = b[field];

                    if (field === 'Price' || field === 'Position') {
                        valueA = parseFloat(String(valueA || '0').replace(/[^0-9.]/g, ''));
                        valueB = parseFloat(String(valueB || '0').replace(/[^0-9.]/g, ''));
                        return order === 'asc' ? valueA - valueB : valueB - valueA;
                    } else if (typeof valueA === 'string' && typeof valueB === 'string') {
                        valueA = removeVietnameseDiacritics(valueA);
                        valueB = removeVietnameseDiacritics(valueB);
                        return order === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                    }
                    return 0;
                });
            } else {
                foods.sort((a, b) => parseFloat(a.Position || 0) - parseFloat(b.Position || 0));
            }

            const productsPerPage = 8;
            const totalProducts = foods.length;
            const totalPages = Math.ceil(totalProducts / productsPerPage);
            let currentPage = parseInt(req.query.page) || 1;
            if (currentPage < 1) currentPage = 1;
            if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages;

            const startIndex = (currentPage - 1) * productsPerPage;
            const paginatedFoods = foods.slice(startIndex, startIndex + productsPerPage);

            res.render('pages/product/index', {
                pageTitle: "Trang sản phẩm",
                foods: paginatedFoods,
                keyword: keyword || '',
                status: status || '',
                sort: sort || '',
                pagination: { currentPage, totalPages, productsPerPage, totalProducts }
            });
        } catch (error) {
            console.error("Error fetching foods:", error);
            req.flash("error", "Lỗi khi lấy danh sách món ăn!");
            res.redirect("back");
        }
    },

    // [GET] /admin/products/create
    createView: async (req, res) => {
        try {
            const categorySnapshot = await admin.database().ref('Category').once('value');
            const categories = categorySnapshot.val() ? Object.values(categorySnapshot.val()) : [];

            const times = [
                { Id: 0, Name: "Buổi sáng" },
                { Id: 1, Name: "Buổi trưa" },
                { Id: 2, Name: "Buổi tối" },
            ];

            res.render('pages/product/create', {
                pageTitle: "Thêm sản phẩm mới",
                categories: categories,
                times: times 
            });
        } catch (error) {
            console.error("Error fetching data for create view:", error);
            req.flash("error", "Lỗi khi tải trang thêm sản phẩm mới!");
            res.redirect("back");
        }
    },

    // [POST] /admin/products/create
    createFood: async (req, res) => {
        try {
            const newFoodData = { ...req.body };

            if (req.file) {
                const filename = `${Date.now()}-${req.file.originalname}`;
                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                const tempFilePath = path.join(tempDir, filename);
                fs.writeFileSync(tempFilePath, req.file.buffer);

                await bucket.upload(tempFilePath, {
                    destination: `images/${filename}`,
                    public: true,
                    metadata: { contentType: req.file.mimetype }
                });

                newFoodData.ImagePath = `https://storage.googleapis.com/${bucket.name}/images/${filename}`;
                fs.unlinkSync(tempFilePath);
            }

            if (typeof newFoodData.Price === 'undefined' || newFoodData.Price === null) {
                newFoodData.Price = ""; 
            } else {
                newFoodData.Price = String(newFoodData.Price); 
            }

            newFoodData.Position = parseInt(newFoodData.Position) || 0;
            newFoodData.CategoryId = parseInt(newFoodData.CategoryId) || 0;
            newFoodData.TimeId = parseInt(newFoodData.TimeId) || 0;
            newFoodData.TimeValue = parseInt(newFoodData.TimeValue) || 0;
            newFoodData.Star = parseFloat(newFoodData.Star) || 0;
            newFoodData.BestFood = newFoodData.BestFood === 'true';

            newFoodData.CreatedAt = admin.database.ServerValue.TIMESTAMP;
            newFoodData.UpdatedAt = admin.database.ServerValue.TIMESTAMP;
            newFoodData.Status = newFoodData.Status || 'active';

            const snapshot = await admin.database().ref('Foods').once('value');
            const foodsData = snapshot.val();
            let nextId = 0;
            if (foodsData) {
                const existingIds = Object.values(foodsData).map(food => food.Id || 0);
                nextId = Math.max(...existingIds) + 1;
            }
            newFoodData.Id = nextId;

            await admin.database().ref(`Foods/${nextId}`).set(newFoodData);

            req.flash("success", "Thêm sản phẩm mới thành công!");
            res.redirect(`${PATCH_ADMIN}/products`);
        } catch (error) {
            console.error("Error creating new food:", error);
            req.flash("error", `Lỗi khi thêm sản phẩm mới: ${error.message}`);
            res.redirect("back");
        }
    },

    // [GET] /admin/products/detail/:id
    detail: async (req, res) => {
        try {
            const { id } = req.params;
            const snapshot = await admin.database().ref(`Foods/${id}`).once('value');
            const food = snapshot.val();
            if (!food) {
                req.flash("error", "Không tìm thấy sản phẩm!");
                return res.redirect(`${PATCH_ADMIN}/products`);
            }
            food.id = id;
            res.render('pages/product/detail', {
                pageTitle: `Chi tiết sản phẩm: ${food.Title || 'N/A'}`,
                food
            });
        } catch (error) {
            console.error("Error fetching food detail:", error);
            req.flash("error", "Lỗi khi lấy chi tiết sản phẩm!");
            res.redirect(`${PATCH_ADMIN}/products`);
        }
    },

    // [GET] /admin/products/edit/:id
    edit: async (req, res) => {
        try {
            const { id } = req.params;
            const snapshot = await admin.database().ref(`Foods/${id}`).once('value');
            const food = snapshot.val();
            if (!food) {
                req.flash("error", "Không tìm thấy sản phẩm cần chỉnh sửa!");
                return res.redirect(`${PATCH_ADMIN}/products`);
            }
            food.id = id;
            res.render('pages/product/edit', {
                pageTitle: `Chỉnh sửa sản phẩm: ${food.Title || 'N/A'}`,
                food
            });
        } catch (error) {
            console.error("Error fetching food for edit:", error);
            req.flash("error", "Lỗi khi lấy thông tin sản phẩm để chỉnh sửa!");
            res.redirect(`${PATCH_ADMIN}/products`);
        }
    },


    editPatch: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = { ...req.body };


            if (req.file) {
                const filename = `${Date.now()}-${req.file.originalname}`;
                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                const tempFilePath = path.join(tempDir, filename);
                fs.writeFileSync(tempFilePath, req.file.buffer);

                await bucket.upload(tempFilePath, {
                    destination: `images/${filename}`,
                    public: true,
                    metadata: { contentType: req.file.mimetype }
                });

                const imageUrl = `https://storage.googleapis.com/${bucket.name}/images/${filename}`;
                updates.ImagePath = imageUrl;
                fs.unlinkSync(tempFilePath);

                // Xóa ảnh cũ nếu có
                const oldFoodSnapshot = await admin.database().ref(`Foods/${id}`).once('value');
                const oldImagePath = oldFoodSnapshot.val()?.ImagePath;
                if (oldImagePath && oldImagePath.includes('storage.googleapis.com')) {
                    const match = oldImagePath.match(/\/([^/]+\/[^/]+)$/);
                    if (match?.[1]) {
                        const oldImageRef = bucket.file(match[1]);
                        await oldImageRef.delete().catch(err =>
                            console.warn("Không thể xóa ảnh cũ:", err.message)
                        );
                    }
                }
            }


            if (updates.Price) {
                updates.Price = String(updates.Price); // Đảm bảo là string
            }

            if (updates.Position) updates.Position = parseInt(updates.Position);
            if (updates.CategoryId) updates.CategoryId = parseInt(updates.CategoryId);
            if (updates.TimeId) updates.TimeId = parseInt(updates.TimeId);
            if (updates.TimeValue) updates.TimeValue = parseInt(updates.TimeValue);
            if (updates.Star) updates.Star = parseFloat(updates.Star);
            if (typeof updates.BestFood !== 'undefined') {
                updates.BestFood = updates.BestFood === 'true'; 
            }
            updates.UpdatedAt = admin.database.ServerValue.TIMESTAMP;
            await admin.database().ref(`Foods/${id}`).update(updates);

            req.flash("success", "Cập nhật sản phẩm thành công!");
            res.redirect(`${PATCH_ADMIN}/products/detail/${id}`);
        } catch (error) {
            console.error("Error updating food:", error);
            req.flash("error", `Lỗi khi cập nhật sản phẩm: ${error.message}`);
            res.redirect("back");
        }
    },

    // [PATCH] /admin/products/position/:id
    updatePosition: async (req, res) => {
        try {
            const { id } = req.params;
            const { position } = req.body;
            if (typeof position === 'undefined' || isNaN(position)) {
                return res.status(400).json({ error: 'Vị trí không hợp lệ.' });
            }
            await admin.database().ref(`Foods/${id}`).update({ Position: parseInt(position) });
            res.status(200).json({ message: 'Cập nhật vị trí thành công.' });
        } catch (error) {
            console.error("Error updating position:", error);
            res.status(500).json({ error: 'Lỗi khi cập nhật vị trí!', message: error.message });
        }
    },

    // [DELETE] /admin/products/delete/:id
    deleteFood: async (req, res) => {
        try {
            const { id } = req.params;
            const snapshot = await admin.database().ref(`Foods/${id}`).once('value');
            const food = snapshot.val();

            if (!food) {
                return res.status(404).json({ error: "Không tìm thấy sản phẩm để xóa!" });
            }

            const imagePath = food.ImagePath;
            if (imagePath && imagePath.includes('storage.googleapis.com')) {
                const match = imagePath.match(/\/([^/]+\/[^/]+)$/);
                if (match?.[1]) {
                    const fileRef = bucket.file(match[1]);
                    await fileRef.delete().catch(err => {
                        console.warn("Không thể xóa ảnh cũ trên Firebase Storage:", err.message);
                    });
                }
            }

            await admin.database().ref(`Foods/${id}`).remove();
            res.status(200).json({ message: "Xóa sản phẩm thành công!" });
        } catch (error) {
            console.error("Lỗi khi xóa sản phẩm:", error);
            res.status(500).json({ error: `Lỗi khi xóa sản phẩm: ${error.message}` });
        }
    }
};
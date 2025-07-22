// controllers/admin/order.controller.js

const admin = require('firebase-admin');

const ORDER_STATUS_MAP = {
    "Chờ xác nhận": "Chờ xác nhận",
    "Xác nhận": "Xác nhận",
    "Đang giao hàng": "Đang giao hàng",
    "Giao hàng thành công": "Giao hàng thành công",
    "Đã hủy": "Đã hủy" // Thêm trạng thái hủy nếu bạn muốn sử dụng
};

// Hàm chuyển đổi tiếng Việt có dấu thành không dấu
function removeVietnameseDiacritics(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.toLowerCase()
        .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
        .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
        .replace(/ì|í|ị|ỉ|ĩ/g, "i")
        .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
        .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
        .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
        .replace(/đ/g, "d")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Loại bỏ các dấu diacritics còn lại
        .replace(/ + /g, " ").trim();
}


// [GET] /admin/orders
module.exports.index = async (req, res) => {
    try {
        const snapshot = await admin.database().ref('orders').once('value');
        const data = snapshot.val();
        let orders = data ? Object.entries(data).map(([id, order]) => ({ id, ...order })) : [];

        let find = { ...req.query };

        // 1. Lọc theo trạng thái
        if (find.status && find.status !== '') {
            orders = orders.filter(order => order.status === find.status);
        }

        // 2. Tìm kiếm theo từ khóa (mã đơn hàng hoặc tên khách hàng)
        if (find.keyword) {
            const keywordNorm = removeVietnameseDiacritics(find.keyword);
            orders = orders.filter(order =>
                (order.orderCode && removeVietnameseDiacritics(order.orderCode).includes(keywordNorm)) ||
                (order.fullName && removeVietnameseDiacritics(order.fullName).includes(keywordNorm))
            );
        }

        // 3. Sắp xếp (theo orderDate mới nhất)
        orders.sort((a, b) => {
            const parseDate = (dateStr) => {
                if (!dateStr) return 0;
                // Định dạng "DD-MM-YYYY HH:MM"
                const [datePart, timePart] = dateStr.split(' ');
                const [day, month, year] = datePart.split('-').map(Number);
                const [hour, minute] = timePart.split(':').map(Number);
                return new Date(year, month - 1, day, hour, minute).getTime();
            };
            return parseDate(b.orderDate) - parseDate(a.orderDate); // Mới nhất lên đầu
        });

        // --- PHÂN TRANG ---
        const itemsPerPage = 6;
        const totalItems = orders.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        let currentPage = parseInt(find.page) || 1;
        if (currentPage < 1) currentPage = 1;
        if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages; // Đảm bảo không vượt quá tổng số trang

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedOrders = orders.slice(startIndex, startIndex + itemsPerPage); // slice đến startIndex + itemsPerPage

        res.render('pages/orders/index', {
            pageTitle: "Danh sách đơn hàng",
            orders: paginatedOrders,
            status: find.status || '',
            keyword: find.keyword || '',
            pagination: {
                currentPage: currentPage,
                itemsPerPage: itemsPerPage,
                totalItems: totalItems,
                totalPages: totalPages
            },
            messages: req.flash(),
            ORDER_STATUS_MAP: ORDER_STATUS_MAP // Truyền map trạng thái xuống view
        });

    } catch (error) {
        console.error("LỖI KHI LẤY DANH SÁCH ĐƠN HÀNG TỪ FIREBASE:", error);
        req.flash("error", "Lỗi khi lấy danh sách đơn hàng! Vui lòng thử lại.");
        res.redirect("back");
    }
};

// [PATCH] /admin/orders/change-status/:id
module.exports.changeStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        req.flash('error', 'Trạng thái không được cung cấp.');
        return res.status(400).json({ error: 'Trạng thái không được cung cấp.' });
    }

    try {
        // Cập nhật trạng thái của đơn hàng trong Firebase Realtime Database
        await admin.database().ref(`orders/${id}`).update({ status: status });

        req.flash('success', 'Cập nhật trạng thái đơn hàng thành công.');
        return res.status(200).json({ message: 'Cập nhật trạng thái đơn hàng thành công.' });

    } catch (error) {
        console.error("LỖI KHI CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG FIREBASE:", error);
        req.flash('error', `Lỗi khi cập nhật trạng thái đơn hàng: ${error.message}`);
        return res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái đơn hàng!', message: error.message });
    }
};

// [GET] /admin/orders/detail/:id (Hàm mới cho trang chi tiết)
module.exports.detail = async (req, res) => {
    try {
        const { id } = req.params;

        // Lấy dữ liệu của đơn hàng cụ thể từ Firebase
        const orderRef = admin.database().ref(`orders/${id}`);
        const snapshot = await orderRef.once('value');
        const order = snapshot.val();

        if (!order) {
            req.flash("error", "Không tìm thấy đơn hàng.");
            return res.redirect(`${process.env.PREFIX_ADMIN}/orders`);
        }

        // Xử lý trường `items` để hiển thị đẹp hơn
        // `items` đang là một chuỗi như "Phở (49.999 VNĐ) - Số lượng: 2\nBánh Cuốn (29.999 VNĐ) - Số lượng: 1"
        // Chúng ta muốn phân tích nó thành một mảng các đối tượng để dễ hiển thị trong Pug
        let parsedItems = [];
        if (order.items && typeof order.items === 'string') {
            const itemLines = order.items.split('\n');
            itemLines.forEach(line => {
                // Regex để bắt tên sản phẩm, giá (có dấu chấm phân cách), và số lượng
                const match = line.match(/(.+)\s\((\d+\.?\d*)\sVNĐ\)\s-\sSố lượng:\s(\d+)/);
                if (match) {
                    const itemName = match[1].trim();
                    const itemPrice = parseFloat(match[2].replace(/\./g, '')); // Loại bỏ dấu chấm và chuyển sang số
                    const itemQuantity = parseInt(match[3]);
                    parsedItems.push({
                        name: itemName,
                        price: itemPrice,
                        quantity: itemQuantity,
                        subtotal: itemPrice * itemQuantity // Tính tổng phụ cho mỗi món
                    });
                }
            });
        }

        res.render('pages/orders/detail', {
            pageTitle: `Chi tiết đơn hàng - ${order.orderCode}`,
            order: { id, ...order }, // Truyền order kèm theo id
            parsedItems: parsedItems, // Truyền danh sách sản phẩm đã phân tích
            messages: req.flash(),
            ORDER_STATUS_MAP: ORDER_STATUS_MAP // Truyền map trạng thái để hiển thị tên tiếng Việt
        });

    } catch (error) {
        console.error("LỖI KHI LẤY CHI TIẾT ĐƠN HÀNG TỪ FIREBASE:", error);
        req.flash("error", "Lỗi khi lấy chi tiết đơn hàng! Vui lòng thử lại.");
        res.redirect("back");
    }
};
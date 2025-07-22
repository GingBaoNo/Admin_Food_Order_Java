// controllers/admin/dashboard.controller.js
const admin = require('firebase-admin');

// Đảm bảo ORDER_STATUS_MAP được định nghĩa ở đây
const ORDER_STATUS_MAP = {
    "Chờ xác nhận": "Chờ xác nhận",
    "Xác nhận": "Xác nhận",
    "Đang giao hàng": "Đang giao hàng",
    "Giao hàng thành công": "Giao hàng thành công",
    "Đã hủy": "Đã hủy"
};

module.exports.dashboard = async (req, res) => { // Đã đổi tên hàm từ index thành dashboard
    try {
        // 1. Lấy tổng số đơn hàng
        const ordersSnapshot = await admin.database().ref('orders').once('value');
        const ordersData = ordersSnapshot.val();
        const allOrders = ordersData ? Object.values(ordersData) : [];
        const totalOrders = allOrders.length;

        // 2. Lấy tổng số món ăn/sản phẩm
        const foodsSnapshot = await admin.database().ref('Foods').once('value');
        const foodsData = foodsSnapshot.val();
        const totalFoods = foodsData ? Object.values(foodsData).length : 0;

        // 3. Tính tổng doanh thu (từ các đơn hàng "delivered")
        let totalRevenue = 0;
        let pendingOrdersCount = 0;
        let deliveredOrdersCount = 0;
        let totalItemsSold = 0;

        const bestSellingFoods = {};

        allOrders.forEach(order => {
            const orderTotal = order.total ? parseFloat(order.total.toString().replace(/\./g, '')) : 0;

            if (order.status === 'Giao hàng thành công') {
                totalRevenue += orderTotal;
                deliveredOrdersCount++;
            }
            if (order.status === 'Chờ xác nhận') {
                pendingOrdersCount++;
            }

            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    totalItemsSold += (item.quantity || 0);
                    const foodId = item.productId;
                    if (foodId !== undefined && foodId !== null) {
                        bestSellingFoods[foodId] = (bestSellingFoods[foodId] || 0) + (item.quantity || 0);
                    }
                });
            }
        });

        const sortedBestSellingFoods = Object.entries(bestSellingFoods)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const foodsMap = new Map(Object.values(foodsData || {}).map(food => [food.Id, food]));
        const topSellingProducts = sortedBestSellingFoods.map(([foodId, quantitySold]) => {
            const foodInfo = foodsMap.get(parseInt(foodId));
            return {
                id: foodId,
                name: foodInfo ? foodInfo.Title : `Sản phẩm ID: ${foodId}`,
                image: (foodInfo && foodInfo.ImagePath) ? foodInfo.ImagePath : "/admin/images/no-image.png",
                quantitySold: quantitySold
            };
        });

        // 4. Lấy 5 đơn hàng gần đây nhất
        allOrders.sort((a, b) => {
            const parseDate = (dateStr) => {
                if (!dateStr) return 0;
                const [datePart, timePart] = dateStr.split(' ');
                const [day, month, year] = datePart.split('-').map(Number);
                const [hour, minute] = timePart.split(':').map(Number);
                return new Date(year, month - 1, day, hour, minute).getTime();
            };
            return parseDate(b.orderDate) - parseDate(a.orderDate);
        });
        const recentOrders = allOrders.slice(0, 5);

        res.render('pages/dashboard/index', {
            pageTitle: "Trang Tổng quan",
            totalOrders: totalOrders,
            totalFoods: totalFoods,
            totalRevenue: totalRevenue.toLocaleString('vi-VN'),
            pendingOrdersCount: pendingOrdersCount,
            deliveredOrdersCount: deliveredOrdersCount,
            totalItemsSold: totalItemsSold,
            topSellingProducts: topSellingProducts,
            recentOrders: recentOrders,
            messages: req.flash(),
            ORDER_STATUS_MAP: ORDER_STATUS_MAP // <--- THÊM DÒNG NÀY VÀO ĐÂY
        });

    } catch (error) {
        console.error("LỖI KHI LẤY DỮ LIỆU TRANG TỔNG QUAN TỪ FIREBASE:", error);
        req.flash("error", "Lỗi khi tải dữ liệu tổng quan! Vui lòng thử lại.");
        res.redirect("back");
    }
};
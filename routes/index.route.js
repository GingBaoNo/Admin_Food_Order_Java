// routes/index.route.js

const systemConfig = require("../config/system");
const authRoutes = require("./auth.route");
const dashBoardRouters = require("./dashboard.route");
const productRouters = require("./product.route");
const accountRouters = require("./account.route");
const orderRouters = require("./order.route");
const categoryRouters = require("./category.route");

const requireAuth = require('../middlewares/auth.middleware');

module.exports = (app) => {
    // Lấy đường dẫn admin từ config, ví dụ: '/admin'
    const PATH_ADMIN = systemConfig.prefixAdmin;

    // Các route cho admin
    app.use(PATH_ADMIN, authRoutes);
    app.use(`${PATH_ADMIN}/dashboard`, requireAuth, dashBoardRouters);
    app.use(`${PATH_ADMIN}/products`, requireAuth, productRouters);
    app.use(`${PATH_ADMIN}/accounts`, requireAuth, accountRouters);
    app.use(`${PATH_ADMIN}/orders`, requireAuth, orderRouters);
    app.use(`${PATH_ADMIN}/categories`, requireAuth, categoryRouters);

    // Route mặc định khi vào /admin
    app.get(PATH_ADMIN, (req, res) => {
        if (req.session.isLoggedIn && req.session.isAdmin) {
            res.redirect(`${PATH_ADMIN}/dashboard`);
        } else {
            res.redirect(`${PATH_ADMIN}/login`);
        }
    });

    // Route xử lý 404 cho mọi đường dẫn không khớp
    app.use(`${PATH_ADMIN}/`, (req, res) => {
        res.status(404).render('pages/404', {
            pageTitle: '404 Not Found'
        });
    });
};

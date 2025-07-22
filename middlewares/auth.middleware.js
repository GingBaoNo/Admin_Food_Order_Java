
module.exports = (req, res, next) => {
    console.log(req.session); // Kiểm tra giá trị session

    if (!req.session.isLoggedIn) {
        req.flash('error', 'Bạn cần đăng nhập để truy cập trang này.');
        return res.redirect('/admin/login');
    }

    if (!req.session.isAdmin) {
        req.flash('error', 'Bạn không có quyền truy cập trang quản trị.');
        return res.redirect('/admin/login');
    }

    next();
};
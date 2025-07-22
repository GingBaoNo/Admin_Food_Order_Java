const admin = require('firebase-admin');

// Hàm helper để lấy instance của database và auth sau khi app được khởi tạo
const getFirebaseServices = () => {
    try {
        const app = admin.app();
        return {
            db: app.database(),
            auth: app.auth()
        };
    } catch (e) {
        console.error("Firebase app not initialized when trying to get services.", e);
        throw new Error("Firebase services not available.");
    }
};

exports.getLogin = (req, res) => {
    if (req.session.isLoggedIn && req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    res.render('pages/auth/login', {
        pageTitle: 'Đăng nhập Admin',
        path: '/admin/login'
    });
};

exports.postLogin = async (req, res) => {
    const { db, auth } = getFirebaseServices();
    const { email, password } = req.body;

    console.log('Login attempt with email:', email); // Debugging

    if (!email || !password) {
        req.flash('error', 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
        return res.redirect('/admin/login');
    }

    try {
        const userRecord = await auth.getUserByEmail(email);
        const uid = userRecord.uid;
        const roleRef = db.ref(`roles/${uid}`);
        const roleSnapshot = await roleRef.once('value');
        const roleData = roleSnapshot.val();

        console.log('Role data:', roleData); // Debugging

        if (roleData && roleData.role === 'admin') {
            req.session.userId = uid;
            req.session.userEmail = email;
            req.session.isLoggedIn = true;
            req.session.isAdmin = true;

            req.flash('success', 'Đăng nhập thành công!');
            return res.redirect('/admin/dashboard');
        } else {
            req.flash('error', 'Tài khoản không có quyền truy cập quản trị hoặc không tồn tại.');
            return res.redirect('/admin/login');
        }

    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            req.flash('error', 'Email hoặc mật khẩu không đúng.');
        } else {
            req.flash('error', 'Đã có lỗi xảy ra. Vui lòng thử lại.');
        }
        return res.redirect('/admin/login');
    }
};

exports.getRegister = (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/admin/dashboard');
    }
    res.render('pages/auth/register', {
        pageTitle: 'Đăng ký Admin',
        path: '/admin/register'
    });
};

exports.postRegister = async (req, res) => {
    const { db, auth } = getFirebaseServices();
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
        req.flash('error', 'Vui lòng nhập đầy đủ thông tin.');
        return res.redirect('/admin/register');
    }
    if (password !== confirmPassword) {
        req.flash('error', 'Mật khẩu và xác nhận mật khẩu không khớp.');
        return res.redirect('/admin/register');
    }
    if (password.length < 6) {
        req.flash('error', 'Mật khẩu phải có ít nhất 6 ký tự.');
        return res.redirect('/admin/register');
    }

    try {
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: name,
            emailVerified: false,
            disabled: false
        });

        const uid = userRecord.uid;

        await db.ref(`roles/${uid}`).set({
            createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            email: email,
            id: uid,
            role: 'admin'
        });

        req.flash('success', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
        res.redirect('/admin/login');

    } catch (error) {
        console.error('Lỗi khi đăng ký:', error.message);
        if (error.code === 'auth/email-already-in-use') {
            req.flash('error', 'Email này đã được sử dụng. Vui lòng chọn email khác.');
        } else {
            req.flash('error', 'Đã có lỗi xảy ra khi đăng ký. Vui lòng thử lại.');
        }
        res.redirect('/admin/register');
    }
};

exports.getDashboard = (req, res) => {
    res.render('admin/dashboard', {
        pageTitle: 'Trang quản trị Admin',
        message: `Chào mừng, ${req.session.userEmail}!`
    });
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log(err);
        }
        res.redirect('/admin/login');
    });
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Không thể đăng xuất.');
        }
        res.redirect('/admin/login');
    });
};
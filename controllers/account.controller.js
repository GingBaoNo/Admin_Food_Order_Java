const admin = require('firebase-admin');

module.exports.getAccounts = async (req, res) => {
    try {
        const accountsRef = admin.database().ref('roles'); 
        const snapshot = await accountsRef.once('value');
        let allAccounts = [];
        
        snapshot.forEach(childSnapshot => {
            const accountData = childSnapshot.val();
            allAccounts.push({ 
                id: childSnapshot.key, 
                createdAt: accountData.createdAt,
                email: accountData.email,
                role: accountData.role,
                status: accountData.status || 'active'
            });
        });

        const keyword = req.query.keyword || '';
        const roleFilter = req.query.role || '';
        const sort = req.query.sort || '';

        let filteredAccounts = allAccounts.filter(account => {
            const matchesKeyword = (account.email && account.email.toLowerCase().includes(keyword.toLowerCase()));
            const matchesRole = roleFilter === '' || (account.role && account.role.toLowerCase() === roleFilter.toLowerCase());
            return matchesKeyword && matchesRole;
        });

        if (sort) {
            const [sortBy, sortOrder] = sort.split('-'); 
            filteredAccounts.sort((a, b) => {
                let valA, valB;
                switch (sortBy) {
                    case 'email':
                        valA = (a.email || '').toLowerCase();
                        valB = (b.email || '').toLowerCase();
                        break;
                    case 'createdAt':
                        valA = new Date(a.createdAt || 0).getTime(); 
                        valB = new Date(b.createdAt || 0).getTime();
                        break;
                    default:
                        return 0;
                }
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            });
        }

        const accountsPerPage = 5;
        const totalAccounts = filteredAccounts.length;
        const totalPages = Math.ceil(totalAccounts / accountsPerPage);
        let currentPage = parseInt(req.query.page) || 1;

        if (currentPage < 1) currentPage = 1;
        if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * accountsPerPage;
        const endIndex = startIndex + accountsPerPage;
        const paginatedAccounts = filteredAccounts.slice(startIndex, endIndex);

        const pagination = {
            currentPage,
            totalPages,
            accountsPerPage,
            totalAccounts
        };

        res.render('pages/account/index', {
            pageTitle: "Danh sách tài khoản",
            accounts: paginatedAccounts,
            keyword: keyword,
            role: roleFilter,
            sort: sort,
            pagination: pagination,
            messages: req.flash()
        });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách tài khoản:", error);
        req.flash("error", "Lỗi khi lấy danh sách tài khoản!");
        res.redirect("back");
    }
};

module.exports.deleteAccount = async (req, res) => {
    const accountId = req.params.id;

    try {
        // Xóa tài khoản từ Firebase Authentication
        await admin.auth().deleteUser(accountId);
        // Xóa dữ liệu người dùng từ Realtime Database
        await admin.database().ref(`roles/${accountId}`).remove();

        req.flash("success", "Xóa tài khoản thành công!");
        res.status(200).json({ message: "Xóa tài khoản thành công!" });
    } catch (error) {
        console.error("Lỗi khi xóa tài khoản:", error);
        req.flash("error", "Lỗi khi xóa tài khoản: " + error.message);
        res.status(500).json({ error: "Lỗi khi xóa tài khoản." });
    }
};
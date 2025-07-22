const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const systemConfig = require('./config/system');
const routeAdmin = require("./routes/index.route");

const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) { 
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://project-foodapp-bf73b-default-rtdb.firebaseio.com"
  });
}

const app = express();
const db = admin.database();

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use(session({
  secret: 'a_very_secret_key_for_your_app_and_for_session',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } 
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  next();
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
console.log('Static files for /admin served from:', path.join(__dirname, 'public', 'admin'));

app.locals.prefixAdmin = systemConfig.prefixAdmin;

routeAdmin(app);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Admin Dashboard: http://localhost:${PORT}${systemConfig.prefixAdmin}/dashboard`);
});
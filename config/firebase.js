const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://project-foodapp-bf73b.appspot.com',
  databaseURL: "https://project-foodapp-bf73b-default-rtdb.firebaseio.com"
});

const bucket = admin.storage().bucket();

module.exports = admin;

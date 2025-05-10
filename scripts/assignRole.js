const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(), // or use a service account
});

// Replace with the UID of the user you want to assign the role to
const uid = 'USER_UID_HERE';

// Set custom user claims
admin.auth().setCustomUserClaims(uid, { role: 'admin' })
  .then(() => {
    console.log(`Custom claims set for user ${uid}`);
  })
  .catch(error => {
    console.error('Error setting custom claims:', error);
  });

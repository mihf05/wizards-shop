const jwt = require('jsonwebtoken');

// Define the payload for the JWT token
const payload = {
  userId: 'user_01',
  role: 'admin',
};

// Define the secret key for signing the token
const secretKey = 'something';

// Generate the JWT token
const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });

console.log('Generated JWT Token:', token);

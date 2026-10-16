import jwt from 'jsonwebtoken';

/**
 * Generate a signed JSON Web Token for an authenticated user
 * @param {string} userId - Mongoose User ObjectId string
 * @returns {string} Signed JWT string
 */
export const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'dev_secret_jwt_key_scheduler_min_32_characters_long_for_security';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ id: userId }, secret, {
    expiresIn,
  });
};

/**
 * Verify a JSON Web Token
 * @param {string} token - Bearer JWT string
 * @returns {object} Decoded JWT payload
 */
export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'dev_secret_jwt_key_scheduler_min_32_characters_long_for_security';
  return jwt.verify(token, secret);
};

export default { generateToken, verifyToken };

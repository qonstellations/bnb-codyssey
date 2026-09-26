import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, maxlength: 255 },
    password: { type: String, required: true },
    passwordHash: { type: String },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Pre-save hook to hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
    this.passwordHash = this.password;
  }
  next();
});

// Compare candidate password with stored hash
userSchema.methods.isPasswordCorrect = async function (password) {
  const hash = this.password || this.passwordHash;
  if (!hash) return false;
  return await bcrypt.compare(password, hash);
};

// Generate JWT access token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      userId: this._id.toString(),
      email: this.email,
      name: this.name,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    }
  );
};

// Generate JWT refresh token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      userId: this._id.toString(),
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    }
  );
};

// Strip sensitive fields when sending user data in responses
userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);

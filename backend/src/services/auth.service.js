import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import prisma from '../config/database.js';
import { signToken } from '../utils/token.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';

class AuthService {
  /**
   * Register a new customer account.
   * Public registration ALWAYS sets role = CUSTOMER.
   */
  async register({ name, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError(
        'An account with this email address already exists',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // 2. Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create user in database (enforce CUSTOMER role)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: Role.CUSTOMER, // Ignore client-supplied roles completely
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 4. Generate signed JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }

  /**
   * Authenticate a user by email and password.
   * Returns generic error to prevent user enumeration.
   */
  async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Generic error constant
    const invalidCredentialsError = new UnauthorizedError(
      'Invalid email or password',
      'INVALID_CREDENTIALS'
    );

    if (!user) {
      // Fake hash comparison or throw generic error to prevent timing attacks
      throw invalidCredentialsError;
    }

    // 2. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw invalidCredentialsError;
    }

    // 3. Generate signed JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // 4. Return sanitized user and token
    const sanitizedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return { user: sanitizedUser, token };
  }

  /**
   * Retrieve current user profile by user ID.
   * Excludes password hash.
   */
  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found', 'USER_NOT_FOUND');
    }

    return user;
  }
}

export default new AuthService();


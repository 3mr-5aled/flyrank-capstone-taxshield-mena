import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma.js";
import { RegisterInput, LoginInput } from "./auth.schema.js";

const JWT_SECRET = process.env.JWT_SECRET || "taxshield_mena_jwt_secret_key";
const JWT_EXPIRES_IN = "7d";

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export class AuthService {
  public static async register(input: RegisterInput) {
    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error(`User with email '${input.email}' already exists`);
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(input.password, 10);

    // 3. Upsert Tenant and Create User
    const tenant = await prisma.tenant.upsert({
      where: { taxId: input.taxId },
      update: {},
      create: {
        name: input.tenantName,
        taxId: input.taxId,
        country: input.country,
      },
    });

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: input.role,
        tenantId: tenant.id,
      },
      include: {
        tenant: true,
      },
    });

    // 4. Generate JWT Token
    const payload: TokenPayload = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          taxId: tenant.taxId,
          country: tenant.country,
        },
      },
    };
  }

  public static async login(input: LoginInput) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      throw new Error("Invalid email or password");
    }

    // 3. Generate JWT Token
    const payload: TokenPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          taxId: user.tenant.taxId,
          country: user.tenant.country,
        },
      },
    };
  }

  public static async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenant: true,
        createdAt: true,
      },
    });
  }
}

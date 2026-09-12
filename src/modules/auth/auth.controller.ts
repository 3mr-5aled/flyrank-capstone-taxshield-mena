import { Request, Response } from "express";
import { RegisterSchema, LoginSchema } from "./auth.schema.js";
import { AuthService } from "./auth.service.js";
import { AuthenticatedRequest } from "./auth.middleware.js";

export class AuthController {
  public static async register(req: Request, res: Response): Promise<void> {
    const parseResult = RegisterSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed at boundary",
        details: parseResult.error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    try {
      const result = await AuthService.register(parseResult.data);
      res.status(201).json({
        success: true,
        message: "User and tenant registered successfully",
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: "Registration failed",
        message: err.message,
      });
    }
  }

  public static async login(req: Request, res: Response): Promise<void> {
    const parseResult = LoginSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed at boundary",
        details: parseResult.error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    try {
      const result = await AuthService.login(parseResult.data);
      res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: err.message,
      });
    }
  }

  public static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
      return;
    }

    try {
      const profile = await AuthService.getUserById(req.user.userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch profile",
        message: err.message,
      });
    }
  }
}

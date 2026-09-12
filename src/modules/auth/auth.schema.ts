import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  tenantName: z.string().min(2, "Company/Tenant name is required"),
  taxId: z.string().min(5, "Company Tax ID is required"),
  country: z.enum(["KSA", "EGY"]).default("KSA"),
  role: z.enum(["ADMIN", "ACCOUNTANT", "AUDITOR"]).default("ACCOUNTANT"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
});

export const MagicLinkConsumeSchema = z.object({
  token: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  companyName: z.string().trim().min(1),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type MagicLinkRequestDto = z.infer<typeof MagicLinkRequestSchema>;
export type MagicLinkConsumeDto = z.infer<typeof MagicLinkConsumeSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;

export type LoginResponseDto = {
  tokenType: 'Bearer';
  accessToken: string;
  expiresAt: string;
};

import { z } from 'zod';

export const jsonParser = z
    .string()
    .transform<Record<string, unknown>>((val, ctx) => {
        try {
            return JSON.parse(val);
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Could not parse JSON.',
            });
            return z.NEVER;
        }
    });

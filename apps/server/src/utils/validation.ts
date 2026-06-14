import { z } from 'zod';

/* Donation validation schema */
export const DonationSchema = z.object({
  amount: z.number().positive('Amount must be a positive number'),
  donorName: z.string().min(2, 'Name must be at least 2 characters'),
  donorEmail: z.string().email('Invalid email address'),
  message: z.string().optional(),
});

export type DonationInput = z.infer<typeof DonationSchema>;

/* Contact form validation schema */
export const ContactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone must be at least 7 digits').optional(),
  subject: z.string().min(2, 'Subject must be at least 2 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type ContactInput = z.infer<typeof ContactSchema>;

/* Helper function to validate data */
export const validateData = <T>(
  schema: z.ZodSchema,
  data: unknown
): { valid: boolean; data?: T; error?: string } => {
  try {
    const validatedData = schema.parse(data) as T;
    return { valid: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { valid: false, error: message };
    }
    return { valid: false, error: 'Validation failed' };
  }
};

import { z } from "zod";

export const playerSchema = z.object({
  surname: z.string().min(1, "Le nom est obligatoire"),
  first_name: z.string().min(1, "Le prénom est obligatoire"),

  whs: z
    .number()
    .min(-10, "WHS invalide")
    .max(54, "WHS invalide")
    .nullable()
    .optional(),

  email: z.string().email("Email invalide").nullable().optional(),

  phone: z.string().nullable().optional(),

  home_club: z.string().nullable().optional(),

  street: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),

  federal_no: z.string().nullable().optional(),
});
import { Resend } from "resend";
import {
  RESEND_API_KEY,
  ADMIN_EMAIL,
  EMAIL_ENABLED,
} from "../config/constants";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function notifyAdmin(subject: string, body: string): Promise<void> {
  if (!EMAIL_ENABLED || !resend || !ADMIN_EMAIL) return;

  try {
    await resend.emails.send({
      from: "Picologs <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject: `[Picologs] ${subject}`,
      text: body,
    });
  } catch (error) {
    console.error("[Email] Failed to send:", error);
  }
}

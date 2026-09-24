/** The HTTP request as controllers see it after the authentication guard (plan item 5.0). */
export interface RequestWithUser {
  user?: { id: string };
}

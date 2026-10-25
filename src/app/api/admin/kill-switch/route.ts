/**
 * POST /api/admin/kill-switch
 * Emergency failover route (alias for /api/admin/quiz/killswitch)
 * Disables quiz, publishes emergency broadcast banner with Google Form fallback, requires typed confirmation.
 */
export { POST } from "../quiz/killswitch/route";

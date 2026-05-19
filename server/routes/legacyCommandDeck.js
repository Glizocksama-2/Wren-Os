export function createLegacyCommandDeckRouter({ express, db }) {
  const router = express.Router();

  router.get("/", async (request, response) => {
    const email = typeof request.user?.email === "string" ? request.user.email.trim().toLowerCase() : "";
    if (!email) {
      response.status(204).end();
      return;
    }

    const legacyDeck = await db.findLegacyCommandDeckByEmail(email);
    if (!legacyDeck?.deck) {
      response.status(204).end();
      return;
    }

    response.json({
      deck: legacyDeck.deck,
      updatedAt: legacyDeck.updated_at
    });
  });

  return router;
}

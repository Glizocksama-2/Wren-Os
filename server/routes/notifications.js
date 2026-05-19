export function createNotificationsRouter({ express, db }) {
  const router = express.Router();

  router.get("/", async (request, response) => {
    const notifications = await db.listNotifications(request.userId);
    const unreadCount = notifications.filter((notification) => !notification.isRead && !notification.is_read).length;
    response.json({ notifications, unreadCount });
  });

  router.post("/read-all", async (request, response) => {
    const updated = await db.markAllNotificationsRead(request.userId);
    response.json({ updated });
  });

  return router;
}

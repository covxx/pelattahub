# How to View QBO OAuth Logs

## View Logs in Real-Time (Recommended)

```bash
# Follow logs in real-time (press Ctrl+C to stop)
docker-compose logs -f app

# Or filter for QBO-related logs only
docker-compose logs -f app | grep -i "qbo\|callback\|createToken\|redirectUri\|OAuth"
```

## View Recent Logs

```bash
# Last 100 lines
docker-compose logs --tail=100 app

# Last 200 lines, filtered for QBO
docker-compose logs --tail=200 app | grep -i "qbo\|callback\|createToken"
```

## View All Logs Since Container Start

```bash
docker-compose logs app
```

## Common Log Locations

- **Docker logs**: `docker-compose logs app` (what we're using)
- **OAuth library logs**: If `logging: true` is set, check `/logs/oAuthClient-log.log` inside the container
- **Browser console**: Check browser DevTools for client-side errors

## When Testing QBO Connection

1. Open a terminal and run: `docker-compose logs -f app`
2. Click "Connect to QuickBooks" in the UI
3. Watch the logs in real-time to see the OAuth flow




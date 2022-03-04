# WebRTC SFU

## How to start

### 1. Docker version
```sh
docker-compose up -d
```

### 2. Settings
- all clients and server were in same devices
- a video conference style

### SFU Server (Media Server)
- The SFU server has lost its real-time performance since it had 6 clients.
- Some images were stopped when there were more than 7 clients.
- SFU Server had significantly higher CPU usage than Signaling Server.
- Client-side CPU usage decreased by approximately half when using SFU Server.

### Signaling Server (P2P/Mesh)
- There was a slight delay as the client increased, but the video did not stop.
- The CPU usage of the Signaling Server was kept at 0.1%.
- As the number of clients increased, the CPU usage of the client increased significantly.

---


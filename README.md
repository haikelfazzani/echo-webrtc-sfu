# WebRTC SFU

## How to start

### 1. Docker version
```sh
docker-compose up -d
```

### 2. Settings
- all clients and server were in same devices
- a video conference style

### Client side performance(Chrome browser CPU usage)
|the number of users|P2P/Mesh(Signaling Server)|SFU(Media Server)| 
|:--:|:--:|:--:|
|2|4%|5%|
|3|10%|8%|
|4|22%|9.5%|
|5|34%|18%|
|6|47%|25%|
|7|64%|30%|
|8|80%|30%|

### Server side performance(CPU usage)
|the number of users|P2P/Mesh(Signaling Server)|SFU(Media Server)| 
|:--:|:--:|:--:|
|2|0.1%|2%|
|3|0.1%|13%|
|4|0.1%|24%|
|5|0.1%|32%|
|6|0.1%|41%|
|7|0.1%|48%|
|8|0.1%|50%|

### 3. Results
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


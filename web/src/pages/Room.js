import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AudioPlayer from "../Components/AudioPlayer";

function setBandwidth(sdp) {
  const audioBandwidth = 50;
  const videoBandwidth = 256;
  return sdp
    .replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:' + audioBandwidth + '\r\n')
    .replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + videoBandwidth + '\r\n')
}

const mediaConfig = { audio: true, video: false };

const pc_config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const SOCKET_SERVER_URL = "http://localhost:8080";
const io = window.io;

export default function Room() {

  const [searchParams] = useSearchParams();
  const roomID = searchParams.get("roomID");

  const socketRef = useRef();
  const StreamRef = useRef();
  const sendPCRef = useRef();
  const receivePCsRef = useRef({});

  const [users, setUsers] = useState([]);
  const [mediaStatus, setmediaStatus] = useState({ audio: false, video: false, });

  const closeReceivePC = useCallback((id) => {
    if (!receivePCsRef.current[id]) return;
    receivePCsRef.current[id].close();
    delete receivePCsRef.current[id];
  }, []);

  const createReceiverOffer = useCallback( async (pc, senderSocketID) => {
      try {
        let sdp = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false, });
        await pc.setLocalDescription(new RTCSessionDescription(sdp));

        if (!socketRef.current) return;
        socketRef.current.emit("receiverOffer", {
          sdp,
          receiverSocketID: socketRef.current.id,
          senderSocketID,
          roomID,
        });
      } catch (error) {
        console.log(error);
      }
    }, []);

  const createReceiverPeerConnection = useCallback((socketID) => {
    try {
      const pc = new RTCPeerConnection(pc_config);
      receivePCsRef.current = { ...receivePCsRef.current, [socketID]: pc };

      pc.onicecandidate = (e) => {
        if (!(e.candidate && socketRef.current)) return;
        socketRef.current.emit("receiverCandidate", {
          candidate: e.candidate,
          receiverSocketID: socketRef.current.id,
          senderSocketID: socketID,
        });
      };

      pc.oniceconnectionstatechange = (e) => { };

      pc.ontrack = (e) => {
        setUsers((oldUsers) =>
          oldUsers
            .filter((user) => user.id !== socketID)
            .concat({ id: socketID, stream: e.streams[0], })
        );
      };

      // return pc
      return pc;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, []);

  const createReceivePC = useCallback((id) => {
    try {
      const pc = createReceiverPeerConnection(id);
      if (!(socketRef.current && pc)) return;
      createReceiverOffer(pc, id);
    } catch (error) {
      console.log(error);
    }
  },
    [createReceiverOffer, createReceiverPeerConnection]
  );

  const createSenderOffer = useCallback(async () => {
    try {
      if (!sendPCRef.current) return;
      let sdp = await sendPCRef.current.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false, });
      await sendPCRef.current.setLocalDescription(new RTCSessionDescription(sdp));

      if (!socketRef.current) return;
      socketRef.current.emit("senderOffer", { sdp, senderSocketID: socketRef.current.id, roomID, });
    } catch (error) {
      console.log(error);
    }
  }, []);

  const createSenderPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(pc_config);

    pc.onicecandidate = (e) => {
      if (!(e.candidate && socketRef.current)) return;

      socketRef.current.emit("senderCandidate", {
        candidate: e.candidate,
        senderSocketID: socketRef.current.id,
      });
    };

    pc.oniceconnectionstatechange = (e) => { };

    if (StreamRef.current) {
      StreamRef.current.getTracks().forEach((track) => {
        if (!StreamRef.current) return;
        pc.addTrack(track, StreamRef.current);
      });
    } else {
      console.log("no local stream");
    }

    sendPCRef.current = pc;
  }, []);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConfig);
      stream.getAudioTracks()[0].enabled = false;

      StreamRef.current = stream;

      if (!socketRef.current) return;

      createSenderPeerConnection();
      await createSenderOffer();

      socketRef.current.emit("joinRoom", { id: socketRef.current.id, roomID, });
    } catch (e) {
      console.log(`getUserMedia error: ${e}`);
    }
  }, [createSenderOffer, createSenderPeerConnection]);

  useEffect(() => {
    socketRef.current = io.connect(SOCKET_SERVER_URL);
    getLocalStream();

    socketRef.current.on("userEnter", (data) => {
      createReceivePC(data.id);
    });

    socketRef.current.on("allUsers", (data) => {
      data.users.forEach((user) => createReceivePC(user.id));
    });

    socketRef.current.on("userExit", (data) => {
      closeReceivePC(data.id);
      setUsers((users) => users.filter((user) => user.id !== data.id));
    });

    socketRef.current.on("getSenderAnswer", async (data) => {
      try {
        if (!sendPCRef.current) return;
        await sendPCRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (error) {
        console.log(error);
      }
    });

    socketRef.current.on("getSenderCandidate", async (data) => {
      try {
        if (!(data.candidate && sendPCRef.current)) return;
        await sendPCRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.log(error);
      }
    });

    socketRef.current.on("getReceiverAnswer", async (data) => {
      try {
        const pc = receivePCsRef.current[data.id];
        if (!pc) return;
        await pc.setRemoteDescription(data.sdp);
      } catch (error) {
        console.log(error);
      }
    });

    socketRef.current.on("getReceiverCandidate", async (data) => {
      try {
        const pc = receivePCsRef.current[data.id];
        if (!(pc && data.candidate)) return;
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.log(error);
      }
    });

    socketRef.current.on('message', ({ id, message }) => {
      //messages.push({ id, message })
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (sendPCRef.current) {
        sendPCRef.current.close();
      }
      users.forEach((user) => closeReceivePC(user.id));
    };
    // eslint-disable-next-line
  }, [closeReceivePC, createReceivePC, createSenderOffer, createSenderPeerConnection, getLocalStream]);

  const onMedia = (mediaType, stream) => {
    if (stream) {
      switch (mediaType) {
        case 'audio':
          const audioStatus = !mediaStatus.audio;
          stream.getAudioTracks()[0].enabled = audioStatus;
          setmediaStatus({ ...mediaStatus, audio: audioStatus })
          break;

        default:
          break;
      }
    }
  }

  return (<main className="grid-3">

    {/* <AudioPlayer stream={StreamRef.current} /> */}

    {users.map((user, index) => (
      <div key={index}><AudioPlayer stream={user.stream} /><div><span>{user.id}</span></div></div>
    ))}

    <div className="w-100 control">
      <div className="br7">
        <button onClick={() => { onMedia('audio', StreamRef.current) }}>
          <i className={mediaStatus.audio ? "fa fa-microphone" : "fa fa-microphone-slash"}></i>
        </button>

        <button onClick={() => { onMedia('audio', StreamRef.current) }}>
          <i className={mediaStatus.audio ? "fa fa-microphone" : "fa fa-microphone-slash"}></i>
        </button>

        <button onClick={() => { onMedia('audio', StreamRef.current) }}>
          <i className={mediaStatus.audio ? "fa fa-microphone" : "fa fa-microphone-slash"}></i>
        </button>
      </div>
    </div>
  </main>);
};

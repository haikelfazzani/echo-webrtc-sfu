import React, { useState, useRef, useEffect, useCallback } from "react";
import io from "socket.io-client";
import Video from "./../Components/Video";
import { WebRTCUser } from "../types";
import { useParams } from "react-router-dom";

const pc_config = {
  iceServers: [
    // {
    //   urls: 'stun:[STUN_IP]:[PORT]',
    //   'credentials': '[YOR CREDENTIALS]',
    //   'username': '[USERNAME]'
    // },
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
const SOCKET_SERVER_URL = "http://localhost:8080";

export default function Room() {
  const { roomID, videodisbaled, muted }: any = useParams();

  const socketRef = useRef<SocketIOClient.Socket>();
  const localStreamRef = useRef<MediaStream>();
  const sendPCRef = useRef<RTCPeerConnection>();
  const receivePCsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const [users, setUsers] = useState<Array<WebRTCUser>>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  const closeReceivePC = useCallback((id: string) => {
    if (!receivePCsRef.current[id]) return;
    receivePCsRef.current[id].close();
    delete receivePCsRef.current[id];
  }, []);

  const createReceiverOffer = useCallback(
    async (pc: RTCPeerConnection, senderSocketID: string) => {
      try {
        const sdp = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true, });

        console.log("create receiver offer success");
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
    },
    []
  );

  const createReceiverPeerConnection = useCallback((socketID: string) => {
    try {
      const pc = new RTCPeerConnection(pc_config);

      // add pc to peerConnections object
      receivePCsRef.current = { ...receivePCsRef.current, [socketID]: pc };

      pc.onicecandidate = (e) => {
        if (!(e.candidate && socketRef.current)) return;
        console.log("receiver PC onicecandidate");
        socketRef.current.emit("receiverCandidate", {
          candidate: e.candidate,
          receiverSocketID: socketRef.current.id,
          senderSocketID: socketID,
        });
      };

      pc.oniceconnectionstatechange = (e) => {
        console.log(e);
      };

      pc.ontrack = (e) => {
        console.log("ontrack success");
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

  const createReceivePC = useCallback(
    (id: string) => {
      try {
        console.log(`socketID(${id}) user entered`);
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
      const sdp = await sendPCRef.current.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false, });
      console.log("create sender offer success");
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
      console.log("sender PC onicecandidate");
      socketRef.current.emit("senderCandidate", {
        candidate: e.candidate,
        senderSocketID: socketRef.current.id,
      });
    };

    pc.oniceconnectionstatechange = (e) => {
      console.log(e);
    };

    if (localStreamRef.current) {
      console.log("add local stream");
      localStreamRef.current.getTracks().forEach((track) => {
        if (!localStreamRef.current) return;
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.log("no local stream");
    }

    sendPCRef.current = pc;
  }, []);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      stream.getAudioTracks()[0].enabled = false;
      //stream.getVideoTracks()[0].enabled = false;

      // stream.getAudioTracks().forEach(track => {
      //   // track.enabled = muted || false;
      //   // stream.removeTrack(track);
      //   console.log('Audio track ---------> ', track, track.muted);
      // });

      stream.getVideoTracks().forEach(track => {
        console.log('Video track ---------> ', track);
        //track.enabled = videodisbaled || false;
      });


      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
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

    socketRef.current.on("userEnter", (data: { id: string }) => {
      createReceivePC(data.id);
    });

    socketRef.current.on("allUsers", (data: { users: Array<{ id: string }> }) => {
      data.users.forEach((user) => createReceivePC(user.id));
    });

    socketRef.current.on("userExit", (data: { id: string }) => {
      closeReceivePC(data.id);
      setUsers((users) => users.filter((user) => user.id !== data.id));
    });

    socketRef.current.on("getSenderAnswer", async (data: { sdp: RTCSessionDescription }) => {
      try {
        if (!sendPCRef.current) return;
        console.log("get sender answer");
        console.log(data.sdp);
        await sendPCRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (error) {
        console.log(error);
      }
    }
    );

    socketRef.current.on("getSenderCandidate", async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        if (!(data.candidate && sendPCRef.current)) return;
        console.log("get sender candidate");
        await sendPCRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log("candidate add success");
      } catch (error) {
        console.log(error);
      }
    }
    );

    socketRef.current.on("getReceiverAnswer", async (data: { id: string; sdp: RTCSessionDescription }) => {
      try {
        console.log(`get socketID(${data.id})'s answer`);
        const pc: RTCPeerConnection = receivePCsRef.current[data.id];
        if (!pc) return;
        await pc.setRemoteDescription(data.sdp);
        console.log(`socketID(${data.id})'s set remote sdp success`);
      } catch (error) {
        console.log(error);
      }
    }
    );

    socketRef.current.on("getReceiverCandidate", async (data: { id: string; candidate: RTCIceCandidateInit }) => {
      try {
        console.log(data);
        console.log(`get socketID(${data.id})'s candidate`);
        const pc: RTCPeerConnection = receivePCsRef.current[data.id];
        if (!(pc && data.candidate)) return;
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log(`socketID(${data.id})'s candidate add success`);
      } catch (error) {
        console.log(error);
      }
    }
    );

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
  }, [
    closeReceivePC,
    createReceivePC,
    createSenderOffer,
    createSenderPeerConnection,
    getLocalStream,
  ]);

  const onShareScreen = async (user: any) => {
    const constraints: any = { cursor: true };
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    const screenTrack = stream.getTracks()[0];

    if (sendPCRef && sendPCRef.current && sendPCRef.current.getSenders()) {

      const res = sendPCRef.current.getSenders()
        .find((sender: any) => sender.track.kind === 'video');

      if (res && localVideoRef && localVideoRef.current) {
        const oldTrack = res.track;

        res.replaceTrack(screenTrack);
        localVideoRef.current.srcObject = stream;

        screenTrack.onended = function () {
          if (sendPCRef && sendPCRef.current && sendPCRef.current.getSenders()) {
            const result = sendPCRef.current?.getSenders()
              .find((sender: any) => sender.track.kind === 'video');

              console.log(oldTrack);
              

            if (result) {
              result.replaceTrack(res.track);
              
            }
            // console.log(stream, user);
          }
        }
      }
    }
  }

  return (
    <div className="grid-4">
      <div>
        <video muted ref={localVideoRef} autoPlay />
        <button onClick={() => { onShareScreen({ id: socketRef, stream: localStreamRef }) }}>share screen</button>
      </div>

      {users.map((user, index) => (
        <div key={index}>
          <Video stream={user.stream} />
          <div>
            <span>{user.id}</span>
            <button onClick={() => { onShareScreen(user) }}>share screen</button>
          </div>
        </div>
      ))}
    </div>
  );
};
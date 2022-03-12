import React, { useEffect } from "react";

const AudioPlayer = ({ stream }) => {
  const audio = new Audio();

  useEffect(() => {
    if (stream) {
      audio.srcObject = stream;
      audio.play()
    }
  }, []);

  return (<>
    <img className="w-100" src="https://picsum.photos/seed/picsum/180/180" alt="clubhouse" />
  </>);
};

export default AudioPlayer;

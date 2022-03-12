import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <Link to={"/room?roomID=" + Date.now() + "&audio=" + true + "&video=" + true}>Create a room</Link>
    </div>
  );
};

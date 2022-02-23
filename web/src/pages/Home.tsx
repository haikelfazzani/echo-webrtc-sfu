import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <Link to={"/room/" + Date.now() + "/" + true + "/" + true}>Create a room</Link>
    </div>
  );
};

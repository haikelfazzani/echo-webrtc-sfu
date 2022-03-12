import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";

import Home from './pages/Home';
import Room from './pages/Room';

export default function App() {

  return (<>
    <Router>

      <main className='bg-dark'>
        <h1>Echo</h1>

        <p>Echo is a social audio app for web where users can communicate in audio chat rooms that accommodate groups of thousands of people.</p>

        <ul>
          <Link to="/">home</Link>
        </ul>
      </main>

      <Routes>
        <Route index path="/" element={<Home />} />
        <Route path="/room" element={<Room />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

    </Router>
  </>);
}
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/Home";
import RoomPage from "./pages/Room";
import JoinPage from "./pages/Join";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/join/:sessionId" element={<JoinPage />} />
    </Routes>
  );
}

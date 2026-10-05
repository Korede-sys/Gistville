import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Market from "./pages/Market";
import VendorProfile from "./pages/VendorProfile";
import Chat from "./pages/Chat";
import Requests from "./pages/Requests";
import PostRequest from "./pages/PostRequest";

import SignUp from "./pages/auth/SignUp";
import Login from "./pages/auth/Login";
import ProtectedRoute from "./components/ProtectedRoute";

import VendorLayout from "./pages/vendor/VendorLayout";
import VendorOverview from "./pages/vendor/VendorOverview";
import VendorListings from "./pages/vendor/VendorListings";
import VendorOrders from "./pages/vendor/VendorOrders";
import VendorAds from "./pages/vendor/VendorAds";
import VendorVerification from "./pages/vendor/VendorVerification";
import VendorGifts from "./pages/vendor/VendorGifts";
import VendorChat from "./pages/vendor/VendorChat";

import BuyerLayout from "./pages/buyer/BuyerLayout";
import BuyerFeed from "./pages/buyer/BuyerFeed";
import BuyerOrders from "./pages/buyer/BuyerOrders";
import BuyerSaved from "./pages/buyer/BuyerSaved";
import Coins from "./pages/buyer/Coins";
import GamesHome from "./pages/buyer/games/GamesHome";
import GameLobby from "./pages/buyer/games/GameLobby";
import OneLetterDuel from "./pages/buyer/games/OneLetterDuel";
import AdminDisputes from "./pages/admin/AdminDisputes";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />

      <Route path="/app" element={<Market />} />
      <Route path="/app/vendor/:id" element={<VendorProfile />} />
      <Route path="/app/vendor/:id/chat" element={<Chat />} />
      <Route path="/app/requests" element={<Requests />} />
      <Route path="/app/requests/new" element={<PostRequest />} />

      <Route
        path="/vendor"
        element={
          <ProtectedRoute role="vendor">
            <VendorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<VendorOverview />} />
        <Route path="listings" element={<VendorListings />} />
        <Route path="orders" element={<VendorOrders />} />
        <Route path="orders/:orderId/chat" element={<VendorChat />} />
        <Route path="ads" element={<VendorAds />} />
        <Route path="gifts" element={<VendorGifts />} />
        <Route path="verification" element={<VendorVerification />} />
      </Route>

      <Route
        path="/buyer"
        element={
          <ProtectedRoute role="buyer">
            <BuyerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<BuyerFeed />} />
        <Route path="orders" element={<BuyerOrders />} />
        <Route path="saved" element={<BuyerSaved />} />
        <Route path="coins" element={<Coins />} />
        <Route path="games" element={<GamesHome />} />
        <Route path="games/one-letter" element={<GameLobby />} />
        <Route path="games/one-letter/:roomCode" element={<OneLetterDuel />} />
      </Route>

      <Route path="/admin/disputes" element={<AdminDisputes />} />
    </Routes>
  );
}

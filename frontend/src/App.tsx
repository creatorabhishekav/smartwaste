import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { RedirectIfAuthed, RequireRole } from "./routes/guards";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import PublicAwareness from "./pages/citizen/Awareness";

import CitizenDashboard from "./pages/citizen/Dashboard";
import ReportWaste from "./pages/citizen/ReportWaste";
import PickupRequest from "./pages/citizen/PickupRequest";
import MyComplaints from "./pages/citizen/MyComplaints";
import ComplaintDetail from "./pages/citizen/ComplaintDetail";
import NotificationsPage from "./pages/citizen/NotificationsPage";
import EcoPoints from "./pages/citizen/EcoPoints";
import Profile from "./pages/citizen/Profile";

import WorkerDashboard from "./pages/worker/WorkerDashboard";
import TaskList from "./pages/worker/TaskList";
import TaskDetail from "./pages/worker/TaskDetail";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminComplaints from "./pages/admin/AdminComplaints";
import AdminComplaintReview from "./pages/admin/AdminComplaintReview";
import PriorityQueue from "./pages/admin/PriorityQueue";
import HotspotMap from "./pages/admin/HotspotMap";
import AdminWorkers from "./pages/admin/AdminWorkers";
import AdminPickups from "./pages/admin/AdminPickups";
import Analytics from "./pages/admin/Analytics";
import AdminAwareness from "./pages/admin/AdminAwareness";
import Settings from "./pages/admin/Settings";

import TaskLanding from "./pages/worker/TaskLanding";

const CITIZEN = ["CITIZEN"] as const;
const WORKER = ["WORKER"] as const;
const ADMIN = ["ADMIN"] as const;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* ------------------------------------------------ public */}
            <Route
              path="/"
              element={
                <RedirectIfAuthed>
                  <Landing />
                </RedirectIfAuthed>
              }
            />
            <Route path="/awareness" element={<PublicAwareness />} />
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthed>
                  <Register />
                </RedirectIfAuthed>
              }
            />

            {/* ---------------------------------------------- citizen */}
            <Route
              path="/app"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <Navigate to="/app/dashboard" replace />
                </RequireRole>
              }
            />
            <Route
              path="/app/dashboard"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <CitizenDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/app/report"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <ReportWaste />
                </RequireRole>
              }
            />
            <Route
              path="/app/pickup"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <PickupRequest />
                </RequireRole>
              }
            />
            <Route
              path="/app/complaints"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <MyComplaints />
                </RequireRole>
              }
            />
            <Route
              path="/app/complaints/:id"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <ComplaintDetail />
                </RequireRole>
              }
            />
            <Route
              path="/app/notifications"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <NotificationsPage />
                </RequireRole>
              }
            />
            <Route
              path="/app/awareness"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <PublicAwareness />
                </RequireRole>
              }
            />
            <Route
              path="/app/eco-points"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <EcoPoints />
                </RequireRole>
              }
            />
            <Route
              path="/app/profile"
              element={
                <RequireRole roles={[...CITIZEN]}>
                  <Profile />
                </RequireRole>
              }
            />

            {/* ----------------------------------------------- worker */}
            <Route
              path="/worker"
              element={
                <RequireRole roles={[...WORKER]}>
                  <WorkerDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/worker/tasks"
              element={
                <RequireRole roles={[...WORKER]}>
                  <TaskList />
                </RequireRole>
              }
            />
            <Route
              path="/worker/task"
              element={
                <RequireRole roles={[...WORKER]}>
                  <TaskLanding mode="active" />
                </RequireRole>
              }
            />
            <Route
              path="/worker/task/:id"
              element={
                <RequireRole roles={[...WORKER]}>
                  <TaskDetail />
                </RequireRole>
              }
            />
            <Route
              path="/worker/completed"
              element={
                <RequireRole roles={[...WORKER]}>
                  <TaskLanding mode="completed" />
                </RequireRole>
              }
            />
            <Route
              path="/worker/profile"
              element={
                <RequireRole roles={[...WORKER]}>
                  <Profile />
                </RequireRole>
              }
            />

            {/* ------------------------------------------------- admin */}
            <Route
              path="/admin"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <AdminComplaints />
                </RequireRole>
              }
            />
            <Route
              path="/admin/complaints/:id"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <AdminComplaintReview />
                </RequireRole>
              }
            />
            <Route
              path="/admin/queue"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <PriorityQueue />
                </RequireRole>
              }
            />
            <Route
              path="/admin/hotspots"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <HotspotMap />
                </RequireRole>
              }
            />
            <Route
              path="/admin/pickups"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <AdminPickups />
                </RequireRole>
              }
            />
            <Route
              path="/admin/workers"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <AdminWorkers />
                </RequireRole>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <Analytics />
                </RequireRole>
              }
            />
            <Route
              path="/admin/awareness"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <AdminAwareness />
                </RequireRole>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RequireRole roles={[...ADMIN]}>
                  <Settings />
                </RequireRole>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

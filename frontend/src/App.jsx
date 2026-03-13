import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import UserManagement from './components/UserManagement'
import MasterData from './components/MasterData'
import ExamManagement from './components/ExamManagement'
import ExamScoring from './components/ExamScoring'
import StudentExams from './components/StudentExams'
import SecurityToken from './components/SecurityToken'
import Settings from './components/Settings'
import DashboardLayout from './components/DashboardLayout'

function App() {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Authenticated Routes with Sidebar Layout */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/master-data" element={<MasterData />} />
          <Route path="/exams" element={<ExamManagement />} />
          <Route path="/exam-scoring" element={<ExamScoring />} />
          <Route path="/student-exams" element={<StudentExams />} />
          <Route path="/security" element={<SecurityToken />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App

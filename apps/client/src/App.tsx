import { motion } from 'framer-motion';
import { Routes, Route } from 'react-router-dom';
import Hero from './components/Hero';
import About from './components/About';
import Operations from './components/Operations';
import Statistics from './components/Statistics';
import Stories from './components/Stories';
import Gallery from './components/Gallery';
import Donors from './components/Donors';
import DonationSection from './components/DonationSection';
import Contact from './components/Contact';
import Footer from './components/Footer';
import AdminPanel from './pages/AdminPanel';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';
import './styles/globals.css';

const HomePage = () => (
  <motion.main
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
  >
    <Hero />
    <About />
    <Operations />
    <Statistics />
    <Stories />
    <Gallery />
    <Donors />
    <DonationSection />
    <Contact />
    <Footer />
  </motion.main>
);

const ProtectedAdminRoute = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>טוען...</div>;
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  if (!user.isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>גישה נדחתה</h2>
        <p>אתה לא מורשה לגשת לפאנל ניהול</p>
      </div>
    );
  }

  return <AdminPanel />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<ProtectedAdminRoute />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

export default App;

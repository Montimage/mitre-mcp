/**
 * Main App Component
 *
 * Landing page with integrated chatbox for MITRE ATT&CK Intelligence Assistant
 */
import Navbar from './components/landing/Navbar';
import Hero from './components/landing/Hero';
import Features from './components/landing/Features';
import Playbooks from './components/landing/Playbooks';
import Footer from './components/landing/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <Navbar />

      {/* Hero Section with Integrated ChatBox */}
      <Hero />

      {/* Features Section */}
      <div id="features">
        <Features />
      </div>

      {/* Playbooks Section */}
      <div id="playbooks">
        <Playbooks />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

/**
 * Main App Component
 *
 * Landing page with integrated chatbox for MITRE ATT&CK Intelligence Assistant
 */
import Hero from './components/landing/Hero';
import Features from './components/landing/Features';
import Playbooks from './components/landing/Playbooks';
import Footer from './components/landing/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Integrated ChatBox */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* Playbooks Section */}
      <Playbooks />

      {/* Footer */}
      <Footer />
    </div>
  );
}

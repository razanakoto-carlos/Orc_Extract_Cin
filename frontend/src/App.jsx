import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import OrcPage from "./pages/OrcPage";
import ListePage from "./pages/ListePage";

// Custom NavLink component to handle active state
const NavLink = ({ to, icon, label, sidebarOpen, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300
        ${isActive 
          ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg' 
          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }
        ${sidebarOpen ? 'justify-start' : 'justify-center'}
      `}
    >
      <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform duration-300`}>{icon}</span>
      {sidebarOpen && (
        <span className="font-medium transition-opacity duration-300 truncate max-w-[160px]">{label}</span>
      )}
      {!sidebarOpen && (
        <div className="absolute left-full ml-4 px-3 py-2 bg-white text-gray-900 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto whitespace-nowrap transition-all duration-300 z-50 font-medium">
          {label}
        </div>
      )}
    </Link>
  );
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuActive, setMenuActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMenuActive(!menuActive);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  const closeMobileMenu = () => {
    if (isMobile) {
      setMenuActive(false);
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 font-['Poppins']">
        {/* Sidebar */}
        <div className={`
          fixed top-4 left-4 bottom-4 rounded-2xl bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 shadow-2xl transition-all duration-400
          ${sidebarOpen ? 'w-64' : 'w-20'}
          ${isMobile ? 'w-full top-0 left-0 bottom-0 rounded-none h-14' : ''}
          ${isMobile && menuActive ? 'h-screen overflow-y-auto' : 'overflow-hidden'}
          ${isMobile ? 'max-h-screen' : 'h-[calc(100vh-2rem)]'}
          border border-gray-700/50
        `}>
          {/* Sidebar Header */}
          <div className="p-5 flex items-center justify-between sticky top-0 bg-gradient-to-r from-gray-900 to-gray-800 z-10 rounded-t-2xl border-b border-gray-700/50">
            <div className="flex items-center gap-3">
               {sidebarOpen && (
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold text-white truncate max-w-[160px]">OCR CIN Tool</h1>
                  <p className="text-xs text-cyan-300 font-medium">Document Scanner</p>
                </div>
              )}
            </div>
            
            <button
              onClick={toggleSidebar}
              className={`
                w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300
                shadow-md
                ${isMobile ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white' : 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:from-blue-600 hover:to-cyan-500'}
              `}
            >
              <span className="text-lg transition-transform duration-300 font-bold">
                {isMobile ? (menuActive ? '✕' : '☰') : (sidebarOpen ? '‹' : '›')}
              </span>
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="px-3 py-6 space-y-1">
            <div className={`relative group ${!sidebarOpen ? 'px-2' : ''}`}>
              <NavLink
                to="/"
                icon="📄"
                label="OCR Extraction"
                sidebarOpen={sidebarOpen}
                onClick={closeMobileMenu}
              />
            </div>
            
            <div className={`relative group ${!sidebarOpen ? 'px-2' : ''}`}>
              <NavLink
                to="/documents"
                icon="📊"
                label="Liste des CIN"
                sidebarOpen={sidebarOpen}
                onClick={closeMobileMenu}
              />
            </div>
          </nav>

          {/* Sidebar Footer with Version Info */}
          {sidebarOpen && !isMobile && (
            <div className="absolute bottom-4 left-4 right-4 p-3 border-t border-gray-700/50">
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  v1.0.0
                </div>
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse"></div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className={`
          transition-all duration-400
          ${sidebarOpen && !isMobile ? 'ml-64' : 'ml-20'}
          ${isMobile ? 'ml-0 pt-16' : ''}
        `}>

          {/* Main Content Area */}
          <main className="p-8">
            <Routes>
              <Route path="/" element={<OrcPage />} />
              <Route path="/documents" element={<ListePage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
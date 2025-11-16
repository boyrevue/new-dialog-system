import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { MessageSquare, UserCog, Menu, X, Settings, Edit3, FolderTree } from 'lucide-react'
import MultimodalDialog from './components/MultimodalDialog'
import OperatorPanel from './components/OperatorPanel'
import ConfigPanel from './components/ConfigPanel'
import DialogEditor from './components/DialogEditor'
import SectionManager from './components/SectionManager'

function AppContent() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <MessageSquare className="h-8 w-8 text-blue-500" />
                <span className="ml-3 text-xl font-semibold text-white">
                  Multimodal Dialog System
                </span>
              </Link>
            </div>

            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  Dialog
                </Link>
                <Link
                  to="/operator"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/operator'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <UserCog className="h-4 w-4" />
                  Operator Panel
                </Link>
                <Link
                  to="/config"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/config'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Configuration
                </Link>
                <Link
                  to="/editor"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/editor'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  Dialog Editor
                </Link>
                <Link
                  to="/sections"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/sections'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <FolderTree className="h-4 w-4" />
                  Section Manager
                </Link>
              </div>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                  location.pathname === '/'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <MessageSquare className="h-5 w-5" />
                Dialog
              </Link>
              <Link
                to="/operator"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                  location.pathname === '/operator'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <UserCog className="h-5 w-5" />
                Operator Panel
              </Link>
              <Link
                to="/config"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                  location.pathname === '/config'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Settings className="h-5 w-5" />
                Configuration
              </Link>
              <Link
                to="/editor"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                  location.pathname === '/editor'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Edit3 className="h-5 w-5" />
                Dialog Editor
              </Link>
              <Link
                to="/sections"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                  location.pathname === '/sections'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <FolderTree className="h-5 w-5" />
                Section Manager
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<MultimodalDialog />} />
          <Route path="/operator" element={<OperatorPanel />} />
          <Route path="/config" element={<ConfigPanel />} />
          <Route path="/editor" element={<DialogEditor />} />
          <Route path="/sections" element={<SectionManager />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AppContent />
    </Router>
  )
}

export default App

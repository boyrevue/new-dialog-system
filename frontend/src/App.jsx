import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { MessageSquare, UserCog, Menu, X, Settings, Edit3, FolderTree, GitBranch, TrendingUp, CreditCard } from 'lucide-react'
import MultimodalDialog from './components/MultimodalDialog'
import ChatMultimodalDialog from './components/ChatMultimodalDialog'
import OperatorPanel from './components/OperatorPanel'
import ConfigPanel from './components/ConfigPanel'
import DialogEditor from './components/DialogEditor'
import SectionManager from './components/SectionManager'
import DialogFlowEditor from './components/DialogFlowEditor'
import DialogFlowView from './components/DialogFlowView'
import { LicenceTemplateEditor } from './components/LicenceTemplateEditor'

function AppContent() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <span className="ml-3 text-lg font-semibold text-gray-900">
                  MultiModal Dialog
                </span>
              </Link>
            </div>

            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  User UX
                </Link>
                <Link
                  to="/operator"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/operator'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <UserCog className="h-4 w-4" />
                  Operator UX
                </Link>
                <Link
                  to="/config"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/config'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <Settings className="h-4 w-4" />
                  Configuration
                </Link>
                <Link
                  to="/editor"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/editor'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <Edit3 className="h-4 w-4" />
                  Dialog Editor
                </Link>
                <Link
                  to="/sections"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/sections'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <FolderTree className="h-4 w-4" />
                  Section Manager
                </Link>
                <Link
                  to="/flow"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/flow'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <GitBranch className="h-4 w-4" />
                  Flow Diagram
                </Link>
                <Link
                  to="/licence-template"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/licence-template'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Document Templates
                </Link>
              </div>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
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
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <MessageSquare className="h-5 w-5" />
                User UX
              </Link>
              <Link
                to="/operator"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/operator'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <UserCog className="h-5 w-5" />
                Operator UX
              </Link>
              <Link
                to="/config"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/config'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <Settings className="h-5 w-5" />
                Configuration
              </Link>
              <Link
                to="/editor"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/editor'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <Edit3 className="h-5 w-5" />
                Dialog Editor
              </Link>
              <Link
                to="/sections"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/sections'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <FolderTree className="h-5 w-5" />
                Section Manager
              </Link>
              <Link
                to="/flow"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/flow'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <GitBranch className="h-5 w-5" />
                Flow Diagram
              </Link>
              <Link
                to="/licence-template"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === '/licence-template'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <CreditCard className="h-5 w-5" />
                Document Templates
              </Link>
            </div>
          </div>
        )}
      </nav>

      <Routes>
        <Route path="/flow" element={<DialogFlowEditor />} />
        <Route path="/sessions" element={<DialogFlowView />} />
        <Route path="/licence-template" element={<LicenceTemplateEditor />} />
        <Route path="*" element={
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<ChatMultimodalDialog />} />
              <Route path="/classic" element={<MultimodalDialog />} />
              <Route path="/operator" element={<OperatorPanel />} />
              <Route path="/config" element={<ConfigPanel />} />
              <Route path="/editor" element={<DialogEditor />} />
              <Route path="/sections" element={<SectionManager />} />
            </Routes>
          </main>
        } />
      </Routes>
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

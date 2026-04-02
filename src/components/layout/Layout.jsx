import Sidebar from './Sidebar';
import Notification from '../ui/Notification';

// ===================================================================
// LAYOUT PRINCIPAL
// Sidebar fijo + área de contenido scrollable
// ===================================================================

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>

      {/* Notificaciones toast globales */}
      <Notification />
    </div>
  );
}

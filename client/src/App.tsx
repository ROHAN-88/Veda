import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RegisterPage } from './pages/RegisterPage';
import { SharedWhiteboardPage } from './pages/SharedWhiteboardPage';
import { WhiteboardPage } from './pages/WhiteboardPage';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  // Public, unauthenticated: a read-only shared board (outside ProtectedRoute).
  { path: '/share/:token', element: <SharedWhiteboardPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <ProjectsPage /> },
      { path: '/projects/:id', element: <WhiteboardPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

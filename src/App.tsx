import { HashRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { HomePage } from './pages/HomePage';
import { tools } from './tools/registry';

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-full flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            {tools.map((tool) => (
              <Route key={tool.id} path={tool.path} element={tool.element} />
            ))}
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

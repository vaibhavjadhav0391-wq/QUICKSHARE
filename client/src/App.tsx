import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UnifiedApp } from '@/pages/UnifiedApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UnifiedApp />} />
        <Route path="/join/:token" element={<UnifiedApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

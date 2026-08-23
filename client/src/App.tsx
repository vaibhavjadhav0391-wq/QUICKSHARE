import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UnifiedApp } from '@/pages/UnifiedApp';
import { HowItWorksPage } from '@/pages/HowItWorksPage';
import { ThemeProvider } from '@/context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UnifiedApp />} />
          <Route path="/join/:token" element={<UnifiedApp />} />
          <Route path="/flow" element={<HowItWorksPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { PageTransition } from "@/components/PageTransition";
import { LiquidBackground } from "@/components/LiquidBackground";
import { Navbar } from "@/components/Navbar";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import Flashcards from "./pages/Flashcards";
import SearchPage from "./pages/Search";
import Starred from "./pages/Starred";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: { retry: 1 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <LiquidBackground />
          <Navbar />
          <main className="relative z-10 min-h-screen pb-12">
            <AnimatedRoutes>
              <Route path="/" data-genie-title="概览" data-genie-key="Home" element={<PageTransition transition="fade"><Index /></PageTransition>} />
              <Route path="/browse" data-genie-title="浏览" data-genie-key="Browse" element={<PageTransition transition="fade"><Browse /></PageTransition>} />
              <Route path="/browse/:part" data-genie-title="Part 列表" data-genie-key="BrowsePart" element={<PageTransition transition="fade"><Browse /></PageTransition>} />
              <Route path="/browse/:part/:list" data-genie-title="单词列表" data-genie-key="BrowseList" element={<PageTransition transition="fade"><Browse /></PageTransition>} />
              <Route path="/flashcards/:part/:list" data-genie-title="翻卡学习" data-genie-key="Flashcards" element={<PageTransition transition="fade"><Flashcards /></PageTransition>} />
              <Route path="/search" data-genie-title="搜索" data-genie-key="Search" element={<PageTransition transition="fade"><SearchPage /></PageTransition>} />
              <Route path="/starred" data-genie-title="生词本" data-genie-key="Starred" element={<PageTransition transition="fade"><Starred /></PageTransition>} />
              <Route path="*" data-genie-key="NotFound" data-genie-title="Not Found" element={<PageTransition transition="fade"><NotFound /></PageTransition>} />
            </AnimatedRoutes>
          </main>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

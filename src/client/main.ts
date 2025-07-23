// Main client entry point
import { Game } from './components/Game';
import './styles/main.css';

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  (window as any).game = game; // Make globally available for debugging
});

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

export {}; // Make this a module
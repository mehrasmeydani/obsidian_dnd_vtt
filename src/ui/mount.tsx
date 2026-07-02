import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Helper for hosting React inside Obsidian. Obsidian views hand us a plain
 * container element; we mount a React root into it and return a disposer the
 * view calls on close so we never leak roots.
 */
export function mountReact(container: HTMLElement, node: React.ReactNode): Root {
  const root = createRoot(container);
  renderReact(root, node);
  return root;
}

/** Re-render an existing root, keeping the StrictMode wrapper. */
export function renderReact(root: Root, node: React.ReactNode): void {
  root.render(<StrictMode>{node}</StrictMode>);
}

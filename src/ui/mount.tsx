import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Helper for hosting React inside Obsidian. Obsidian views hand us a plain
 * container element; we mount a React root into it and return a disposer the
 * view calls on close so we never leak roots.
 */
export function mountReact(container: HTMLElement, node: React.ReactNode): Root {
  const root = createRoot(container);
  root.render(<StrictMode>{node}</StrictMode>);
  return root;
}

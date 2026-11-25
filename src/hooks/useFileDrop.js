import { useEffect, useRef, useState } from 'react';

/** Accepts files dropped anywhere on the page. Returns true while files are dragged over it. */
export function useFileDrop(onFiles) {
  const [dragging, setDragging] = useState(false);
  const handler = useRef(onFiles);
  handler.current = onFiles;

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const enter = (e) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer.files.length) handler.current(e.dataTransfer.files);
    };
    document.addEventListener('dragenter', enter);
    document.addEventListener('dragleave', leave);
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragenter', enter);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, []);

  return dragging;
}

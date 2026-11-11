import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const STAGE_WIDTH = 1280;

/** The display's 1280×720 stage inside the page, scaled to its box's width: what the TV shows, at any size. */
export function MiniStage({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const fit = () => setScale(node.clientWidth / STAGE_WIDTH);
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);
  return (
    <div ref={box} className="mini-stage" aria-hidden="true">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import './GridMotion.css';

interface GridMotionProps {
  items?: React.ReactNode[];
  gradientColor?: string;
}

const totalItems = 28;
const defaultItems = Array.from({ length: totalItems }, (_, index) => `MJ ${index + 1}`);

export default function GridMotion({ items = [], gradientColor = '#111827' }: GridMotionProps) {
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const mouseXRef = useRef(
    typeof window === 'undefined' ? 0 : window.innerWidth / 2,
  );
  const combinedItems = items.length > 0 ? items.slice(0, totalItems) : defaultItems;

  useEffect(() => {
    let isActive = true;
    let cleanupTicker: (() => void) | undefined;

    const handleMouseMove = (event: MouseEvent) => {
      mouseXRef.current = event.clientX;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    import('gsap').then(({ gsap }) => {
      if (!isActive) return;

      gsap.ticker.lagSmoothing(0);

      const updateMotion = () => {
        const maxMoveAmount = 220;
        const baseDuration = 0.8;
        const inertiaFactors = [0.6, 0.4, 0.3, 0.2];
        const viewportWidth = window.innerWidth || 1;

        rowRefs.current.forEach((row, index) => {
          if (!row) return;

          const direction = index % 2 === 0 ? 1 : -1;
          const moveAmount =
            ((mouseXRef.current / viewportWidth) * maxMoveAmount - maxMoveAmount / 2) *
            direction;

          gsap.to(row, {
            x: moveAmount,
            duration: baseDuration + inertiaFactors[index % inertiaFactors.length],
            ease: 'power3.out',
            overwrite: 'auto',
          });
        });
      };

      gsap.ticker.add(updateMotion);
      cleanupTicker = () => gsap.ticker.remove(updateMotion);
    });

    return () => {
      isActive = false;
      window.removeEventListener('mousemove', handleMouseMove);
      cleanupTicker?.();
    };
  }, []);

  return (
    <div className="grid-motion" aria-hidden="true">
      <section
        className="grid-motion__intro"
        style={{
          background: `radial-gradient(circle, ${gradientColor} 0%, transparent 72%)`,
        }}
      >
        <div className="grid-motion__container">
          {[...Array(4)].map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid-motion__row"
              ref={(element) => {
                rowRefs.current[rowIndex] = element;
              }}
            >
              {[...Array(7)].map((_, itemIndex) => {
                const content = combinedItems[rowIndex * 7 + itemIndex];
                const isImage =
                  typeof content === 'string' &&
                  (content.startsWith('http') || content.startsWith('/'));

                return (
                  <div key={itemIndex} className="grid-motion__item">
                    <div className="grid-motion__item-inner">
                      {isImage ? (
                        <div
                          className="grid-motion__item-img"
                          style={{
                            backgroundImage: `url(${content})`,
                          }}
                        />
                      ) : (
                        <div className="grid-motion__item-content">{content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

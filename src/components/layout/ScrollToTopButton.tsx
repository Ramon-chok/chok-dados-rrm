import React, { useEffect, useState, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ScrollToTopButton: React.FC = () => {
	const { t } = useTheme();
	const [visible, setVisible] = useState(false);

	const checkReducedMotion = typeof window !== 'undefined' && window.matchMedia
		? window.matchMedia('(prefers-reduced-motion: reduce)').matches
		: false;

	const onScroll = useCallback(() => {
		try {
			setVisible(window.scrollY > 200);
		} catch {
			setVisible(false);
		}
	}, []);

	useEffect(() => {
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, [onScroll]);

	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: checkReducedMotion ? 'auto' : 'smooth' });
	}, [checkReducedMotion]);

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			scrollToTop();
		}
	};

	if (!visible) return null;

	return (
		<button
			aria-label="Voltar ao topo"
			title="Voltar ao topo"
			onClick={scrollToTop}
			onKeyDown={onKeyDown}
			className="scroll-to-top-btn"
			style={{
				position: 'fixed',
				right: 20,
				bottom: 20,
				zIndex: 9999,
				width: 48,
				height: 48,
				borderRadius: 12,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: '#c00000',
				color: '#ffffff',
				border: `1px solid ${t.border}`,
				boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
				cursor: 'pointer',
				transition: 'transform 0.18s ease, opacity 0.18s ease',
				backdropFilter: 'blur(6px)',
			}}
		>
			<ArrowUp size={18} />
		</button>
	);
};

export default ScrollToTopButton;


import { State } from './state.js';
import { RADIAL_MENU_CONFIG } from './config.js';

export function initRadialMenu() {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        let existing = document.getElementById('radial-menu-overlay');
        if (existing) existing.remove();

        let context = State.currentNavContext || 'root';
        let menuItems = RADIAL_MENU_CONFIG[context] || RADIAL_MENU_CONFIG['root'];

        let overlay = document.createElement('div');
        overlay.id = 'radial-menu-overlay';
        
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) {
                overlay.remove();
            }
        });

        const centerX = e.clientX;
        const centerY = e.clientY;
        const radius = menuItems.length > 5 ? 120 : 100;
        const numItems = menuItems.length;
        const angleStep = (2 * Math.PI) / numItems;

        menuItems.forEach((item, index) => {
            let angle = index * angleStep - (Math.PI / 2);
            let x = centerX + radius * Math.cos(angle);
            let y = centerY + radius * Math.sin(angle);

            let btn = document.createElement('button');
            btn.className = 'radial-menu-item';
            if (item.label === 'Return to Dashboard' || item.label === 'Dashboard') {
                btn.classList.add('radial-return');
            }

            btn.style.left = `${x}px`;
            btn.style.top = `${y}px`;
            
            btn.innerHTML = `<span class="radial-icon">${item.icon}</span><span class="radial-label">${item.label}</span>`;
            
            btn.addEventListener('click', () => {
                overlay.remove();
                try {
                    eval(item.action);
                } catch (err) {
                    console.error('Action failed:', err);
                }
            });

            overlay.appendChild(btn);
        });

        document.body.appendChild(overlay);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.radial-menu-item')) {
            let existing = document.getElementById('radial-menu-overlay');
            if (existing) existing.remove();
        }
    });

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
        const fab = document.createElement('div');
        fab.id = 'mobile-radial-trigger';
        fab.innerHTML = '🎡';
        fab.style.position = 'fixed';
        fab.style.bottom = '25px';
        fab.style.right = '25px';
        fab.style.zIndex = '9998';
        fab.style.width = '60px';
        fab.style.height = '60px';
        fab.style.borderRadius = '50%';
        fab.style.backgroundColor = 'var(--accent-color)';
        fab.style.display = 'flex';
        fab.style.alignItems = 'center';
        fab.style.justifyContent = 'center';
        fab.style.fontSize = '24px';
        fab.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)';
        fab.style.cursor = 'pointer';
        fab.style.userSelect = 'none';
        fab.style.transform = 'translateZ(0)'; // Force hardware acceleration
        fab.style.touchAction = 'none';
        
        document.body.appendChild(fab);

        fab.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            
            const syntheticEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: Math.round(window.innerWidth / 2),
                clientY: Math.round(window.innerHeight / 2)
            });
            
            document.dispatchEvent(syntheticEvent);
        }, { passive: false });
    }

    document.addEventListener('touchmove', (e) => {
        if (document.getElementById('radial-menu-overlay')) {
            e.preventDefault();
        }
    }, { passive: false });
}
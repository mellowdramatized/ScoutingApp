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
}

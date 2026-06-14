import { APP_CONFIG } from './config.js';
import { State } from './state.js';
import { updateTelemetryView } from './api.js';
import { renderCompareSidebar, updateRadarChart } from './draft.js';
import { renderMasterRoster } from './roster.js';
import { loadTeamSchedule } from './schedule.js';
import { loadUserAdminTable } from './admin.js';

export function applyTeamBranding() {
            document.getElementById('app-window-title').innerText = `${APP_CONFIG.teamName} ${APP_CONFIG.teamNumber} - ${APP_CONFIG.appTitle}`;
            document.getElementById('auth-team-title').innerText = `${APP_CONFIG.teamName} ${APP_CONFIG.teamNumber}`;
            document.getElementById('email').placeholder = `email@${APP_CONFIG.teamName}${APP_CONFIG.teamNumber}.com`;

            document.querySelectorAll('.dynamic-year-form-title').forEach(el => {
                el.innerText = `${APP_CONFIG.defaultEventYear} Pit Scouting Form`;
            });

            const predictorInput = document.getElementById('predictor-team-input');
            if (predictorInput) predictorInput.value = APP_CONFIG.teamNumber;
        }

export function showToast(message) {
            try {
                if ("vibrate" in navigator && navigator.userActivation.hasBeenActive) {
                    navigator.vibrate([50, 50, 50]);
                }
            } catch (e) { }

            const container = document.getElementById('toast-container');
            const currentToasts = container.getElementsByClassName('toast');

            if (currentToasts.length >= 2) {
                currentToasts[0].classList.add('fade-out');
                setTimeout(() => { if (currentToasts[0] && currentToasts[0].parentNode) currentToasts[0].remove(); }, 300);
            }
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerText = message;
            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
            }, 3000);
        }

export function toggleTheme() {
            const body = document.body;
            const isLight = body.classList.toggle('light-mode');
            localStorage.setItem('wobot_theme', isLight ? 'light' : 'dark');
            document.getElementById('theme-btn').innerText = isLight ? '🌙' : '☀️';

            const themeLink = document.getElementById('tabulator-theme');
            if (isLight) {
                themeLink.href = "https://unpkg.com/tabulator-tables@6.2.1/dist/css/tabulator.min.css";
            } else {
                themeLink.href = "https://unpkg.com/tabulator-tables@6.2.1/dist/css/tabulator_midnight.min.css";
            }
            try {
                if (State.radarChartInstance) updateRadarChart();
            } catch (e) { }
        }

export function togglePasswordVisibility() {
            const passField = document.getElementById('password');
            const icon = document.getElementById('toggle-pass');
            if (passField.type === 'password') {
                passField.type = 'text';
                icon.innerText = 'HIDE';
            } else {
                passField.type = 'password';
                icon.innerText = 'SHOW';
            }
        }

export function switchView(targetId) {
            State.currentNavContext = targetId;
            document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

            updateTelemetryView(targetId);

            const activeView = document.getElementById(targetId);
            if (activeView) activeView.classList.remove('hidden');

            let activeBtnId = 'btn-' + targetId.split('-')[1];
            if (targetId === 'view-match-eval') activeBtnId = 'btn-match-eval';
            if (document.getElementById(activeBtnId)) document.getElementById(activeBtnId).classList.add('active');

            if (targetId === 'view-roster') setTimeout(() => { renderMasterRoster(); }, 50);
            if (targetId === 'view-compare') setTimeout(() => { renderCompareSidebar(); }, 50);
            if (targetId === 'view-pitmap' && window.renderPitMap) setTimeout(() => { window.renderPitMap(); }, 50);

            if (targetId === 'view-schedule') {
                const container = document.getElementById('schedule-container');
                if (container.innerHTML.trim() === '') loadTeamSchedule();
            }
            if (targetId === 'view-admin' && State.currentUserRole === 'owner') loadUserAdminTable();
        }

export function switchDetailTab(tabName) {
            document.getElementById('detail-overview-tab').classList.add('hidden');
            document.getElementById('detail-matches-tab').classList.add('hidden');
            document.getElementById('tab-overview-btn').classList.remove('active');
            document.getElementById('tab-matches-btn').classList.remove('active');

            if (tabName === 'overview') {
                document.getElementById('detail-overview-tab').classList.remove('hidden');
                document.getElementById('tab-overview-btn').classList.add('active');
            } else if (tabName === 'matches') {
                document.getElementById('detail-matches-tab').classList.remove('hidden');
                document.getElementById('tab-matches-btn').classList.add('active');
                setTimeout(() => { if (State.matchTableInstance) State.matchTableInstance.redraw(true); }, 50);
            }
        }
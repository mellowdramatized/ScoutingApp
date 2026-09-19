import { APP_CONFIG } from './config.js';
import { State } from './state.js';
import { sbClient, apiFetchTBA, startTelemetrySession } from './api.js';
import { showToast } from './ui.js';
import { refreshApplicationData, performBackgroundSync, fetchGlobalEventKey, initPermissionsUI } from './app.js';

export function setSyncState(isStarting) {
            if (isStarting) State.syncProcesses++;
            else State.syncProcesses = Math.max(0, State.syncProcesses - 1);
            updateConnectionUI();
        }

export function updateConnectionUI() {
            if (!State.currentUser) return;
            const pill = document.getElementById('conn-pill');
            const syncArea = document.getElementById('sync-area');
            const queue = JSON.parse(localStorage.getItem('wobot_offline_queue') || '[]');

            let isSyncing = State.syncProcesses > 0;

            if (isSyncing) {
                pill.innerText = "SYNCING...";
                pill.className = "status-pill syncing";
            } else if (State.isOnline) {
                pill.innerText = "ONLINE";
                pill.className = "status-pill online";
                if (queue.length > 0) syncArea.classList.remove('hidden');
                else syncArea.classList.add('hidden');
            } else {
                pill.innerText = "OFFLINE";
                pill.className = "status-pill offline";
                syncArea.classList.remove('hidden');
            }

            const queueCountEl = document.getElementById('queue-count');
            if (queueCountEl) queueCountEl.innerText = queue.length;
        }

export async function checkConnection() {
            if (!State.currentUser) return;
            try {
                const { error } = await sbClient.from('pit_scouting').select('id').limit(1);
                State.isOnline = !error;

                if (State.isOnline && State.activeEventKey !== "Pending...") {
                    const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').single();
                    if (tbaKey) {
                        const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/event/${State.activeEventKey}/matches/simple`, tbaKey.key_value);
                        if (res.ok) {
                            const matches = await res.json();
                            const played = matches.filter(m => m.alliances.red.score > -1).sort((a, b) => b.actual_time - a.actual_time);
                            if (played.length > 0) {
                                document.getElementById('live-match-banner').style.display = 'block';
                                document.getElementById('live-match-number').innerText = played[0].comp_level.toUpperCase() + played[0].match_number;
                            }
                        }
                    }
                }
            } catch {
                State.isOnline = false;
            }
            updateConnectionUI();
        }

export async function handleAuth() {
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value.trim();
            const teamCode = document.getElementById('team-code').value.trim();

            if (!email || !password) return showToast("Missing credentials.");

            const btn = document.getElementById('login-trigger-btn');
            const errDiv = document.getElementById('auth-error');
            btn.innerText = "AUTHENTICATING...";
            errDiv.innerText = "";

            if (teamCode.toLowerCase() === "") {
                const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
                if (error) {
                    errDiv.innerText = "Login failed: Account not found or invalid password.";
                    btn.innerText = "ENTER DASHBOARD";
                    showToast("Login failed.");
                } else {
                    await bootApplication();
                }
            } else {
                if (teamCode.toLowerCase() !== APP_CONFIG.teamSignupCode) {
                    errDiv.innerText = "Signup failed: Invalid Team Code.";
                    btn.innerText = "ENTER DASHBOARD";
                    return showToast("Invalid Team Code.");
                }

                const { data, error } = await sbClient.auth.signUp({ email, password });

                if (error) {
                    if (error.message.toLowerCase().includes("already registered")) {
                        const loginAttempt = await sbClient.auth.signInWithPassword({ email, password });
                        if (!loginAttempt.error) return await bootApplication();
                    }
                    errDiv.innerText = `Signup Error: ${error.message}`;
                    btn.innerText = "ENTER DASHBOARD";
                    showToast("Signup failed.");
                } else {
                    showToast("Account created successfully!");
                    await bootApplication();
                }
            }
        }

export async function handleLogout() {
            showToast("Logging out and clearing local cache...");
            try {
                await sbClient.auth.signOut();
            } catch (e) {
                console.error(e);
            } finally {
                const hasVisited = localStorage.getItem('wobot_has_visited');
                const savedTheme = localStorage.getItem('wobot_theme');

                localStorage.clear();
                sessionStorage.clear();

                if (hasVisited) localStorage.setItem('wobot_has_visited', hasVisited);
                if (savedTheme) localStorage.setItem('wobot_theme', savedTheme);

                window.location.href = 'index.html';
            }
        }

export async function bootApplication() {
            try {
                const { data: { session }, error } = await sbClient.auth.getSession();
                if (error) throw error;

                if (session) {
                    await launchSecureSession(session);
                } else {
                    showAuthScreen();
                }
            } catch (err) {
                localStorage.removeItem('wobot_clean_session');
                showAuthScreen();
            }
        }

export function showAuthScreen() {
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
            State.currentUser = null;
        }

export async function launchSecureSession(session) {
            State.currentUser = session.user.email;
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('user-display').innerText = State.currentUser.toUpperCase();

            if (State.currentUser.toLowerCase() === APP_CONFIG.ownerEmailLock) {
                State.currentUserRole = 'owner';
            } else {
                try {
                    const { data: profile } = await sbClient.from('profiles').select('role').eq('id', session.user.id).single();
                    State.currentUserRole = profile ? profile.role : 'scouter';
                } catch (e) {
                    State.currentUserRole = 'scouter';
                }
            }

            initPermissionsUI();
            await fetchGlobalEventKey();

            if (['strategist', 'drive_coach', 'admin', 'owner'].includes(State.currentUserRole)) {
                await performBackgroundSync();
            } else {
                await refreshApplicationData();
            }
            checkConnection();
        }
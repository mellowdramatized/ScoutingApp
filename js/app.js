import { APP_CONFIG } from './config.js';
import { State } from './state.js';
import { sbClient, apiFetchStatbotics, apiFetchTBA, getNexusPitLayout, startTelemetrySession } from './api.js';
import { applyTeamBranding, showToast, toggleTheme, togglePasswordVisibility, switchView, switchDetailTab } from './ui.js';
import { setSyncState, updateConnectionUI, checkConnection, handleAuth, handleLogout, bootApplication, showAuthScreen, launchSecureSession } from './auth.js';
import { getPitFormData, saveDraft, handleScoutSubmit, getMatchFormData, resetMatchForm, handleMatchScoutSubmit, compressImage, previewRobotImage, saveToOfflineQueue, dataURItoBlob, processPayloadUpload, uploadOfflineData, startDictation, resetDictationBtn } from './forms.js';
import * as DraftModule from './draft.js';
import { renderMasterRoster, launchDrillDownProfile, triggerScheduleDrillDown, handleProfileReturn, exportMergedStatboticsData } from './roster.js';
import { predictAllianceScore, loadTeamSchedule, jumpToNextMatch, openMatchVideo, closeMatchVideo, loadLiveStream } from './schedule.js';
import { loadAdminTelemetry, wipeAssignments, autoAssign, manualAssign, populateManualDispatchDropdowns, loadUserAdminTable, assignAllToScouter, setGlobalEvent, runAutoDNP, subscribeToLiveTelemetry, generatePartnerLink } from './admin.js';
import { renderPitMap } from './pitmap.js';
import { initRadialMenu } from './radial.js';

// Safely bind exports from draft.js so a naming mismatch never aborts module execution
const {
    toggleCompareFilter,
    renderCompareSidebar,
    setCompareSlot,
    renderCompareSlot,
    checkAutonSynergy,
    getNormalizeValue,
    updateRadarChart,
    allowDrop,
    dragLeave,
    drag,
    drop,
    addToPickList,
    removeFromPickList,
    savePickListsToStorage,
    clearPicklists,
    renderPickLists,
    exportPicklists
} = DraftModule;

const loadPickListsFromStorage =
    DraftModule.loadPickListsFromStorage ||
    DraftModule.loadPickListsToStorage ||
    (() => {});

const TEMP_SCOUTER_STORAGE_KEY = 'wobot_temp_scouter_pass';

export async function refreshApplicationData() {
    setSyncState(true);
    try {
        State.currentPitMap = await getNexusPitLayout(State.activeEventKey);

        const [pitRes, matchRes] = await Promise.all([
            sbClient.from('pit_scouting').select('*').eq('event_key', State.activeEventKey),
            sbClient.from('match_scouting').select('*').eq('event_key', State.activeEventKey)
        ]);

        const pitData = pitRes.data || [];
        State.wobotMatchData = matchRes.data || [];

        const pitDict = {};
        pitData.forEach(p => {
            const num = parseInt(p.team_number, 10);
            if (!isNaN(num)) pitDict[num] = p;
        });

        const tbaMap = JSON.parse(localStorage.getItem('tbaCache') || '{}');
        const seasonEpaCache = JSON.parse(localStorage.getItem('statbotics_season_cache') || '{}');

        State.globalDataCache = [];

        // Combine all known team numbers from Statbotics/TBA cache, pit scouting, and match scouting
        const allTeamNumbers = new Set();
        Object.keys(State.statboticsCache || {}).forEach(k => {
            const num = parseInt(k, 10);
            if (!isNaN(num)) allTeamNumbers.add(num);
        });
        Object.keys(pitDict).forEach(k => {
            const num = parseInt(k, 10);
            if (!isNaN(num)) allTeamNumbers.add(num);
        });
        State.wobotMatchData.forEach(m => {
            const num = parseInt(m.team_number, 10);
            if (!isNaN(num)) allTeamNumbers.add(num);
        });

        const sortedTeams = [...allTeamNumbers].sort((a, b) => a - b);

        sortedTeams.forEach(teamNum => {
            const stData = State.statboticsCache?.[teamNum] || seasonEpaCache?.[teamNum] || {};
            const pit = pitDict[teamNum] || {};

            let officialName = tbaMap[teamNum] || stData.team_name || pit.team_name || `Team ${teamNum}`;
            let botName = pit.team_nickname ? pit.team_nickname.trim() : "";
            let combinedName = botName ? `${officialName} / ${botName}` : officialName;

            let pitClimbStr = "Unknown";
            if (pit.max_climb) {
                if (pit.max_climb.includes("Level 3")) pitClimbStr = "L3";
                else if (pit.max_climb.includes("Level 2")) pitClimbStr = "L2";
                else if (pit.max_climb.includes("Level 1")) pitClimbStr = "L1";
                else if (pit.max_climb.includes("Cannot")) pitClimbStr = "None";
                else pitClimbStr = pit.max_climb.split(" ")[0];
            }

            let teamMatches = State.wobotMatchData.filter(m => parseInt(m.team_number, 10) === teamNum);
            let avgSkill = 0;
            if (teamMatches.length > 0) {
                let total = 0;
                teamMatches.forEach(m => total += (Number(m.driver_skill) || 0));
                avgSkill = total / teamMatches.length;
            }

            State.globalDataCache.push({
                team_number: teamNum,
                team_nickname: combinedName,
                statbotics_total_epa: Number(stData.epa_total || 0).toFixed(1),
                statbotics_auto_epa: Number(stData.epa_auto || 0).toFixed(1),
                pit_climb: pitClimbStr,
                rank: stData.rank || "-",
                driver_skill: avgSkill,
                ...pit
            });
        });

        renderActiveAssignments();
        if (['admin', 'owner'].includes(State.currentUserRole)) {
            populateManualDispatchDropdowns();
            loadAdminTelemetry(pitData);
        }

        if (!document.getElementById('view-roster').classList.contains('hidden')) {
            renderMasterRoster();
        }
        if (!document.getElementById('view-compare').classList.contains('hidden')) {
            renderCompareSidebar();
            if (State.compareSlotData.left) setCompareSlot('left', State.compareSlotData.left.team_number);
            if (State.compareSlotData.right) setCompareSlot('right', State.compareSlotData.right.team_number);
        }
        if (!document.getElementById('view-pitmap').classList.contains('hidden')) {
            renderPitMap();
        }

    } catch (err) {
        console.warn(err);
    } finally {
        setSyncState(false);
    }
}

export async function renderActiveAssignments() {
    const list = document.getElementById('tasks-list');
    const { data: assignments } = await sbClient.from('scout_assignments').select('*').eq('event_key', State.activeEventKey);

    if (assignments) {
        const compCounts = {};
        assignments.filter(a => a.completed).forEach(a => {
            const name = a.scouter_email.split('@')[0].toUpperCase();
            compCounts[name] = (compCounts[name] || 0) + 1;
        });
        const top3 = Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

        document.getElementById('mini-leaderboard').innerHTML = top3.length > 0 ? top3.map((entry, idx) => `
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-grey); padding-bottom:5px;">
                        <span style="color:var(--text-muted); font-weight:bold;">#${idx + 1} ${entry[0]}</span>
                        <span style="color:var(--accent-color); font-weight:900;">${entry[1]}</span>
                    </div>`).join('') : '<div style="color:var(--text-muted); font-style:italic;">No data yet.</div>';
    }

    const myAssignments = assignments ? assignments.filter(a => a.scouter_email === State.currentUser) : [];
    const myCompleted = myAssignments.filter(a => a.completed).length;
    const myTotal = myAssignments.length;
    const perc = myTotal === 0 ? 100 : Math.round((myCompleted / myTotal) * 100);

    const userDisplay = document.getElementById('user-display');
    if (userDisplay && State.currentUser) {
        const displayTitle = State.userRole || State.userTitle || "SCOUTER";
        userDisplay.innerHTML = State.currentUser.split('@')[0].toUpperCase() + " <span style='color:var(--accent-color);'>[" + displayTitle + "]</span>";
    }

    document.getElementById('scout-progress-text').innerText = `${myCompleted} / ${myTotal} Scouted`;
    document.getElementById('scout-progress-perc').innerText = `${perc}%`;
    document.getElementById('scout-progress-bar').style.width = `${perc}%`;

    const scoutedNumbers = State.globalDataCache.filter(s => s.id).map(s => parseInt(s.team_number, 10));
    const pendingTasks = myAssignments.filter(a => !a.completed && !scoutedNumbers.includes(parseInt(a.team_number, 10)));

    if (pendingTasks.length > State.previousAssignmentCount && State.previousAssignmentCount !== 0) {
        if (Notification.permission === "granted") {
            new Notification("New Scouting Assignment", {
                body: `You have ${pendingTasks.length} teams waiting.`,
                icon: `https://www.thebluealliance.com/avatar/${APP_CONFIG.defaultEventYear}/frc${APP_CONFIG.teamNumber}.png`
            });
        }
    }
    State.previousAssignmentCount = pendingTasks.length;

    if (pendingTasks.length > 0) {
        list.innerHTML = pendingTasks.map(task => `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left: 10px solid var(--primary-color);">
                        <div><span style="font-weight:950; font-size: 1.6rem; color: var(--primary-color);">TEAM ${task.team_number}</span>
                        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform:uppercase; letter-spacing: 1px;">Awaiting Pit Inspection</div></div>
                        <button onclick="launchScoutingSession(${task.team_number})" class="submit-btn" style="padding:12px 30px; font-size: 0.9rem;">INSPECT</button>
                    </div>
                `).join('');
    } else {
        list.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; color: var(--text-muted); font-weight:900; border-style: dashed;">SCANNING COMPLETED... NO PENDING ASSIGNMENTS DETECTED.</div>`;
    }
}

export async function fetchStatboticsRoster() {
    if (!State.activeEventKey || State.activeEventKey === "Pending...") return;

    const eventKey = State.activeEventKey.trim().toLowerCase();
    const yearMatch = eventKey.match(/^(\d{4})/);
    const eventYear = yearMatch ? parseInt(yearMatch[1], 10) : (APP_CONFIG.defaultEventYear || 2026);

    try {
        const res = await apiFetchStatbotics(`https://api.statbotics.io/v3/team_events?event=${encodeURIComponent(eventKey)}`);
        if (!res.ok) throw new Error(`Statbotics fetch failed (${res.status})`);

        const statboticsData = await res.json();
        if (!Array.isArray(statboticsData) || statboticsData.length === 0) {
            throw new Error("Statbotics returned empty event roster");
        }

        let fastEpaDict = {};

        statboticsData.forEach(team => {
            fastEpaDict[team.team] = {
                team_name: team.team_name,
                epa_total: team.epa?.breakdown?.total_points ?? team.epa?.total_points?.mean ?? 0,
                epa_auto: team.epa?.breakdown?.auto_points ?? team.epa?.auto_points?.mean ?? 0,
                rank: team.record?.qual?.rank || '-'
            };
        });

        localStorage.setItem('statbotics_event_cache', JSON.stringify(fastEpaDict));
        State.statboticsCache = fastEpaDict;

    } catch (err) {
        console.warn(`Statbotics API unreachable for ${eventKey} (${err.message}). Attempting TBA + Season EPA fallback...`);

        try {
            const seasonEpaMap = {};
            const seasonRes = await apiFetchStatbotics(`https://api.statbotics.io/v3/team_years?year=${eventYear}&district=fim&limit=1000`);
            if (seasonRes.ok) {
                const seasonTeams = await seasonRes.json();
                if (Array.isArray(seasonTeams)) {
                    seasonTeams.forEach(t => {
                        seasonEpaMap[t.team] = {
                            team_name: t.name || t.team_name || `Team ${t.team}`,
                            epa_total: t.epa?.breakdown?.total_points ?? t.epa?.total_points?.mean ?? 0,
                            epa_auto: t.epa?.breakdown?.auto_points ?? t.epa?.auto_points?.mean ?? 0
                        };
                    });
                }
            }
            localStorage.setItem('statbotics_season_cache', JSON.stringify(seasonEpaMap));

            const { data: keyData, error: keyError } = await sbClient
                .from('api_keys')
                .select('key_value')
                .eq('name', 'tba')
                .maybeSingle();

            if (keyError || !keyData || !keyData.key_value) {
                throw new Error("Could not retrieve TBA API key from database.");
            }

            const tbaUrl = `https://www.thebluealliance.com/api/v3/event/${encodeURIComponent(eventKey)}/teams?X-TBA-Auth-Key=${encodeURIComponent(keyData.key_value)}`;
            const tbaRes = await fetch(tbaUrl);

            if (!tbaRes.ok) {
                const tbaErrorText = await tbaRes.text();
                throw new Error(`TBA fetch failed with status ${tbaRes.status}. Response: ${tbaErrorText}`);
            }

            const tbaData = await tbaRes.json();
            let fastEpaDict = {};
            const tbaNameCache = JSON.parse(localStorage.getItem('tbaCache') || '{}');

            tbaData.forEach(team => {
                const tNum = parseInt(team.team_number, 10);
                const seasonStats = seasonEpaMap[tNum] || {};
                tbaNameCache[tNum] = team.nickname || team.name || `Team ${tNum}`;

                fastEpaDict[tNum] = {
                    team_name: team.nickname || seasonStats.team_name || `Team ${tNum}`,
                    epa_total: seasonStats.epa_total || 0,
                    epa_auto: seasonStats.epa_auto || 0,
                    rank: '-'
                };
            });

            localStorage.setItem('tbaCache', JSON.stringify(tbaNameCache));
            localStorage.setItem('statbotics_event_cache', JSON.stringify(fastEpaDict));
            State.statboticsCache = fastEpaDict;

        } catch (tbaErr) {
            console.warn("Both Statbotics and TBA fallback failed. Resorting to local cache.", tbaErr);
        }
    }
}

export async function performBackgroundSync() {
    if (!State.activeEventKey || State.activeEventKey === "Pending...") return;

    setSyncState(true);
    showToast("Syncing data in background...");

    try {
        await fetchStatboticsRoster();

        const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').maybeSingle();
        if (tbaKey && tbaKey.key_value) {
            const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/event/${State.activeEventKey}/teams/simple`, tbaKey.key_value);
            if (res.ok) {
                const teams = await res.json();
                if (Array.isArray(teams)) {
                    const tbaNameCache = JSON.parse(localStorage.getItem('tbaCache') || '{}');
                    teams.forEach(t => {
                        if (t.team_number && t.nickname) tbaNameCache[t.team_number] = t.nickname;
                    });
                    localStorage.setItem('tbaCache', JSON.stringify(tbaNameCache));
                    localStorage.setItem('cachedEventTeams', JSON.stringify(teams.map(t => parseInt(t.team_number, 10))));
                }
            }
        }

        await refreshApplicationData();
        showToast("Background sync complete.");
    } catch (err) {
        console.warn(err);
    } finally {
        setSyncState(false);
    }
}

export async function fetchGlobalEventKey() {
    try {
        const { data } = await sbClient.from('api_keys').select('key_value').eq('name', 'active_event').maybeSingle();
        State.activeEventKey = (data && data.key_value) ? data.key_value : `${APP_CONFIG.defaultEventYear}default`;
        document.getElementById('global-event-display').innerText = `EVENT: ${State.activeEventKey.toUpperCase()}`;

        const adminInput = document.getElementById('admin-event-input');
        if (adminInput) adminInput.value = State.activeEventKey;

        loadPickListsFromStorage();
    } catch (err) { }
}

export function initPermissionsUI() {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();

    if (['strategist', 'drive_coach', 'admin', 'owner'].includes(State.currentUserRole)) {
        document.getElementById('btn-roster')?.classList.remove('hidden');
        document.getElementById('btn-schedule')?.classList.remove('hidden');
        document.getElementById('btn-compare')?.classList.remove('hidden');
        document.getElementById('btn-stream')?.classList.remove('hidden');
    }
    if (['admin', 'owner'].includes(State.currentUserRole)) {
        document.getElementById('btn-admin')?.classList.remove('hidden');
        injectAdminQRGeneratorButton();
    }
    if (State.currentUserRole === 'owner') {
        document.getElementById('owner-only-tools')?.classList.remove('hidden');
    }
}

export function launchScoutingSession(teamNum) {
    showToast(`Loading form for Team ${teamNum}`);
    switchView('view-scout');
    document.getElementById('f-team').value = teamNum;
    window.scrollTo(0, 0);
}

export function loadCachesFromStorage() {
    try {
        State.statboticsCache = JSON.parse(localStorage.getItem('statbotics_event_cache') || '{}');
    } catch (e) {
        console.warn("Cache load failed, starting fresh.");
    }
}

// ============================================================================
// TEMP SCOUTER QR PASS GENERATOR & GUEST SESSION HANDLER
// ============================================================================

/**
 * Injects a "QR SCOUT PASS" button into the navigation bar for Admins & Owners
 */
function injectAdminQRGeneratorButton() {
    if (document.getElementById('btn-qr-scout-pass')) return;

    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs) {
        const qrBtn = document.createElement('button');
        qrBtn.id = 'btn-qr-scout-pass';
        qrBtn.className = 'nav-btn';
        qrBtn.style.cssText = 'border: 1px solid var(--accent-color); color: var(--accent-color); font-weight: 900;';
        qrBtn.innerHTML = 'QR SCOUT PASS';
        qrBtn.onclick = () => openTempScouterQRModal();
        navTabs.appendChild(qrBtn);
    }
}

/**
 * Encodes a self-verifying fallback token so scouters can still join if partner_tokens
 * insert fails or table policies restrict anon reads.
 */
function createEncodedScoutToken(hoursValid = 18, unlockRoster = false) {
    const expiresAt = Date.now() + Math.round(hoursValid * 3600 * 1000);
    const eventKey = (State.activeEventKey || '2026wmri').trim().toLowerCase();
    const modeFlag = unlockRoster ? 'full' : 'scout';
    const rawPayload = `WOBOT|${eventKey}|${expiresAt}|${modeFlag}`;
    return 'WBT_' + btoa(rawPayload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes and validates a `WBT_` fallback token
 */
function parseEncodedScoutToken(token) {
    if (!token || !token.startsWith('WBT_')) return null;
    try {
        const b64 = token.slice(4).replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(b64);
        const [prefix, eventKey, expStr, modeFlag] = decoded.split('|');
        const expiresAt = parseInt(expStr, 10);
        if (prefix !== 'WOBOT' || isNaN(expiresAt)) return null;
        if (Date.now() > expiresAt) return null;
        return {
            eventKey,
            expiresAt: new Date(expiresAt).toISOString(),
            unlockRoster: modeFlag === 'full'
        };
    } catch (e) {
        return null;
    }
}

/**
 * Opens the Admin Modal to generate & display the Temp Scouter QR Code
 */
export async function openTempScouterQRModal() {
    let modal = document.getElementById('wobot-qr-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'wobot-qr-modal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        backdrop-filter: blur(4px);
    `;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = `
        max-width: 460px;
        width: 100%;
        background: var(--bg-dark, #121212);
        border: 2px solid var(--primary-color, #ff4444);
        border-radius: 12px;
        padding: 22px;
        text-align: center;
        color: #fff;
        box-shadow: 0 16px 40px rgba(0,0,0,0.7);
    `;

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-weight:950; font-size:1.2rem; color:var(--primary-color);">TEMP SCOUTER QR PASS</span>
            <button id="qr-modal-close" style="background:transparent; border:1px solid var(--border-grey); color:#fff; border-radius:6px; padding:4px 10px; cursor:pointer; font-weight:bold;">✕</button>
        </div>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:14px;">
            New scouters can scan this QR code with their phone camera to enter their name and start Pit & Match Scouting immediately — no account required.
        </p>

        <div style="display:flex; gap:8px; justify-content:center; margin-bottom:14px; flex-wrap:wrap;">
            <select id="qr-pass-hours" style="padding:8px 10px; border-radius:6px; background:var(--bg-black, #000); color:#fff; border:1px solid var(--border-grey); font-size:0.82rem;">
                <option value="14">Valid for 14 Hours (1-Day Event)</option>
                <option value="24">Valid for 24 Hours</option>
                <option value="72">Valid for 72 Hours (Full Weekend)</option>
            </select>
            <select id="qr-pass-scope" style="padding:8px 10px; border-radius:6px; background:var(--bg-black, #000); color:#fff; border:1px solid var(--border-grey); font-size:0.82rem;">
                <option value="scout">Scouting + Pit Map Only</option>
                <option value="full">Scouting + Roster & Schedule</option>
            </select>
        </div>

        <div id="qr-code-box" style="background:#ffffff; padding:16px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; min-width:260px; min-height:260px; margin-bottom:14px;">
            <span style="color:#000; font-weight:bold; font-size:0.85rem;">Generating QR Pass...</span>
        </div>

        <div id="qr-pass-meta" style="font-size:0.75rem; color:var(--accent-color); font-weight:bold; margin-bottom:12px;"></div>

        <input id="qr-pass-url-input" type="text" readonly style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:6px; border:1px solid var(--border-grey); background:var(--bg-black, #000); color:var(--text-muted); font-size:0.75rem; margin-bottom:12px; text-align:center;" />

        <div style="display:flex; gap:8px; justify-content:center;">
            <button id="qr-copy-btn" class="submit-btn" style="padding:10px 16px; font-size:0.82rem; flex:1;">COPY LINK</button>
            <button id="qr-regen-btn" class="submit-btn" style="padding:10px 16px; font-size:0.82rem; flex:1; background:var(--border-grey);">NEW QR</button>
        </div>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);

    document.getElementById('qr-modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    async function buildAndRenderQR() {
        const hours = parseInt(document.getElementById('qr-pass-hours').value, 10) || 14;
        const unlockRoster = document.getElementById('qr-pass-scope').value === 'full';
        const qrBox = document.getElementById('qr-code-box');
        const urlInput = document.getElementById('qr-pass-url-input');
        const metaEl = document.getElementById('qr-pass-meta');

        qrBox.innerHTML = '<span style="color:#000; font-weight:bold; font-size:0.85rem;">Generating QR Pass...</span>';

        const tokenString = createEncodedScoutToken(hours, unlockRoster);
        const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

        // Save token in partner_tokens table as well (if table exists/permits)
        try {
            await sbClient.from('partner_tokens').insert({
                token_string: tokenString,
                status: 'active',
                expires_at: expiresAt
            });
        } catch (dbErr) {
            console.info('[QR Pass] Using self-verifying token fallback:', dbErr);
        }

        const shareUrl = `${window.location.origin}${window.location.pathname}?view=scouter&token=${encodeURIComponent(tokenString)}`;
        urlInput.value = shareUrl;

        const expFormatted = new Date(expiresAt).toLocaleString([], {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        metaEl.innerText = `EVENT: ${(State.activeEventKey || '2026WMRI').toUpperCase()} • EXPIRES: ${expFormatted}`;

        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=6&data=${encodeURIComponent(shareUrl)}`;
        qrBox.innerHTML = `<img src="${qrImgUrl}" alt="Temp Scouter QR Code" style="width:250px; height:250px; display:block;" />`;
    }

    document.getElementById('qr-pass-hours').onchange = buildAndRenderQR;
    document.getElementById('qr-pass-scope').onchange = buildAndRenderQR;
    document.getElementById('qr-regen-btn').onclick = buildAndRenderQR;
    document.getElementById('qr-copy-btn').onclick = () => {
        const input = document.getElementById('qr-pass-url-input');
        navigator.clipboard.writeText(input.value);
        showToast('Temp Scouter link copied!');
    };

    await buildAndRenderQR();
}

/**
 * Installs a synthetic Supabase Auth user wrapper for Guest Scouters so any call to
 * sbClient.auth.getUser() or sbClient.auth.getSession() in forms.js succeeds seamlessly.
 */
function installGuestAuthShim(guestEmail, guestName, guestUuid) {
    const syntheticUser = {
        id: guestUuid,
        email: guestEmail,
        role: 'authenticated',
        user_metadata: {
            full_name: guestName,
            role: 'scouter',
            is_temp_scouter: true
        }
    };

    const origGetUser = sbClient.auth.getUser.bind(sbClient.auth);
    sbClient.auth.getUser = async (...args) => {
        const res = await origGetUser(...args);
        if (res?.data?.user) return res;
        return { data: { user: syntheticUser }, error: null };
    };

    const origGetSession = sbClient.auth.getSession.bind(sbClient.auth);
    sbClient.auth.getSession = async (...args) => {
        const res = await origGetSession(...args);
        if (res?.data?.session) return res;
        return {
            data: {
                session: {
                    access_token: APP_CONFIG.supabaseAnonKey,
                    user: syntheticUser
                }
            },
            error: null
        };
    };
}

/**
 * Prompts a new QR Scouter for their first name on first scan so their pit/match forms
 * and leaderboard stats are attributed to them.
 */
function promptForGuestScouterName(existingName = '') {
    return new Promise((resolve) => {
        if (existingName && existingName.trim().length > 0) {
            resolve(existingName.trim());
            return;
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.92);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        `;

        const box = document.createElement('div');
        box.className = 'card';
        box.style.cssText = `
            max-width: 380px;
            width: 100%;
            background: var(--bg-dark, #121212);
            border: 2px solid var(--primary-color, #ff4444);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            color: #fff;
        `;

        box.innerHTML = `
            <div style="font-weight:950; font-size:1.3rem; color:var(--primary-color); margin-bottom:8px;">
                WOBOT QUICK SCOUT PASS
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">
                Enter your First Name (or Nickname) to track your scouting progress and leaderboard stats today:
            </p>
            <input id="guest-scouter-name-input" type="text" placeholder="e.g., Alex" maxlength="24"
                style="width:100%; box-sizing:border-box; padding:12px; border-radius:8px; border:1px solid var(--border-grey); background:var(--bg-black, #000); color:#fff; font-size:1rem; font-weight:bold; text-align:center; margin-bottom:14px;" />
            <button id="guest-scouter-start-btn" class="submit-btn" style="width:100%; padding:12px; font-size:0.95rem;">
                START SCOUTING
            </button>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const input = box.querySelector('#guest-scouter-name-input');
        const btn = box.querySelector('#guest-scouter-start-btn');
        input.focus();

        const submitName = () => {
            const clean = input.value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
            if (clean.length < 2) {
                input.style.borderColor = 'var(--danger-color, #ff4444)';
                return;
            }
            overlay.remove();
            resolve(clean);
        };

        btn.onclick = submitName;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') submitName();
        };
    });
}

export async function checkPartnerMode() {
    const urlParams = new URLSearchParams(window.location.search);
    let view = urlParams.get('view');
    let token = urlParams.get('token');

    // Check if there is an active Temp Scouter Pass saved in localStorage (survives page reloads)
    let savedPass = null;
    try {
        savedPass = JSON.parse(localStorage.getItem(TEMP_SCOUTER_STORAGE_KEY) || 'null');
        if (savedPass && new Date(savedPass.expiresAt) <= new Date()) {
            localStorage.removeItem(TEMP_SCOUTER_STORAGE_KEY);
            savedPass = null;
        }
    } catch (e) {
        savedPass = null;
    }

    if (!view && savedPass) {
        view = 'scouter';
        token = savedPass.token;
    }

    // 1. TEMP SCOUTER QR PASS MODE (?view=scouter&token=...)
    if (view === 'scouter' && token) {
        let isValid = false;
        let expiresAtIso = savedPass?.expiresAt || null;
        let unlockRoster = savedPass?.unlockRoster || false;

        // First check self-verifying WBT_ token
        const parsedToken = parseEncodedScoutToken(token);
        if (parsedToken) {
            isValid = true;
            expiresAtIso = parsedToken.expiresAt;
            unlockRoster = parsedToken.unlockRoster;
        }

        // Also check partner_tokens table if not yet verified
        if (!isValid) {
            const { data } = await sbClient.from('partner_tokens')
                .select('*')
                .eq('token_string', token)
                .eq('status', 'active')
                .maybeSingle();

            if (data && new Date(data.expires_at) > new Date()) {
                isValid = true;
                expiresAtIso = data.expires_at;
            }
        }

        if (isValid) {
            const scouterName = await promptForGuestScouterName(savedPass?.scouterName || '');
            const guestEmail = `${scouterName.toLowerCase()}@guest.wobot`;
            const guestUuid = savedPass?.guestUuid || crypto.randomUUID();

            localStorage.setItem(TEMP_SCOUTER_STORAGE_KEY, JSON.stringify({
                token,
                scouterName,
                guestEmail,
                guestUuid,
                expiresAt: expiresAtIso,
                unlockRoster
            }));

            State.isGuestSession = true;
            State.currentUser = guestEmail;
            State.currentUserRole = unlockRoster ? 'strategist' : 'scouter';
            State.userRole = 'TEMP SCOUT';
            State.userTitle = 'TEMP SCOUT';

            installGuestAuthShim(guestEmail, scouterName, guestUuid);

            const authScreen = document.getElementById('auth-screen');
            const appContainer = document.getElementById('app-container');
            const navTabs = document.querySelector('.nav-tabs');
            const userInfoBar = document.querySelector('.user-info-bar');

            if (authScreen) authScreen.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
            if (navTabs) navTabs.classList.remove('hidden');
            if (userInfoBar) userInfoBar.classList.remove('hidden');

            initPermissionsUI();
            startTelemetrySession(guestUuid, `${scouterName} (QR)`);

            await fetchGlobalEventKey();
            await performBackgroundSync();
            showToast(`Welcome, ${scouterName}! Temp Scouter Pass active.`);
            return true;
        } else {
            localStorage.removeItem(TEMP_SCOUTER_STORAGE_KEY);
            alert('This Temp Scouter QR Pass is invalid or has expired.');
            urlParams.delete('view');
            urlParams.delete('token');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
            return false;
        }
    }

    // 2. EXISTING ALLIANCE PARTNER MODE (?view=partner&token=...)
    if (view === 'partner' && token) {
        const { data } = await sbClient.from('partner_tokens')
            .select('*')
            .eq('token_string', token)
            .eq('status', 'active')
            .single();

        if (data && new Date(data.expires_at) > new Date()) {
            const authScreen = document.getElementById('auth-screen');
            const appContainer = document.getElementById('app-container');
            const navTabs = document.querySelector('.nav-tabs');
            const userInfoBar = document.querySelector('.user-info-bar');

            if (authScreen) authScreen.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
            if (navTabs) navTabs.classList.add('hidden');
            if (userInfoBar) userInfoBar.classList.add('hidden');

            State.isGuestSession = true;
            State.currentUserRole = 'strategist';
            State.currentUser = 'Alliance Partner';

            fetchGlobalEventKey().then(() => {
                refreshApplicationData();
                switchView('view-compare');
            });

            return true;
        } else {
            alert('Invalid or expired partner token.');
            urlParams.delete('view');
            urlParams.delete('token');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
            return false;
        }
    }
    return false;
}

// Wrap handleLogout so Temp Scouters can also cleanly exit their guest pass
const wrappedHandleLogout = async (...args) => {
    localStorage.removeItem(TEMP_SCOUTER_STORAGE_KEY);
    State.isGuestSession = false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('view') || urlParams.has('token')) {
        window.history.replaceState({}, '', window.location.pathname);
    }
    return handleLogout(...args);
};

// Register Window Bindings immediately so inline HTML onclick handlers are always defined
window.applyTeamBranding = applyTeamBranding;
window.showToast = showToast;
window.toggleTheme = toggleTheme;
window.togglePasswordVisibility = togglePasswordVisibility;
window.switchView = switchView;
window.switchDetailTab = switchDetailTab;
window.setSyncState = setSyncState;
window.updateConnectionUI = updateConnectionUI;
window.checkConnection = checkConnection;
window.handleAuth = handleAuth;
window.handleLogout = wrappedHandleLogout;
window.bootApplication = bootApplication;
window.showAuthScreen = showAuthScreen;
window.launchSecureSession = launchSecureSession;
window.getPitFormData = getPitFormData;
window.saveDraft = saveDraft;
window.handleScoutSubmit = handleScoutSubmit;
window.getMatchFormData = getMatchFormData;
window.resetMatchForm = resetMatchForm;
window.handleMatchScoutSubmit = handleMatchScoutSubmit;
window.compressImage = compressImage;
window.previewRobotImage = previewRobotImage;
window.saveToOfflineQueue = saveToOfflineQueue;
window.dataURItoBlob = dataURItoBlob;
window.processPayloadUpload = processPayloadUpload;
window.uploadOfflineData = uploadOfflineData;
window.startDictation = startDictation;
window.resetDictationBtn = resetDictationBtn;
window.toggleCompareFilter = toggleCompareFilter;
window.renderCompareSidebar = renderCompareSidebar;
window.setCompareSlot = setCompareSlot;
window.renderCompareSlot = renderCompareSlot;
window.checkAutonSynergy = checkAutonSynergy;
window.getNormalizeValue = getNormalizeValue;
window.updateRadarChart = updateRadarChart;
window.allowDrop = allowDrop;
window.dragLeave = dragLeave;
window.drag = drag;
window.drop = drop;
window.addToPickList = addToPickList;
window.removeFromPickList = removeFromPickList;
window.savePickListsToStorage = savePickListsToStorage;
window.loadPickListsFromStorage = loadPickListsFromStorage;
window.loadPickListsToStorage = loadPickListsFromStorage;
window.clearPicklists = clearPicklists;
window.renderPickLists = renderPickLists;
window.exportPicklists = exportPicklists;
window.renderMasterRoster = renderMasterRoster;
window.launchDrillDownProfile = launchDrillDownProfile;
window.triggerScheduleDrillDown = triggerScheduleDrillDown;
window.handleProfileReturn = handleProfileReturn;
window.exportMergedStatboticsData = exportMergedStatboticsData;
window.predictAllianceScore = predictAllianceScore;
window.loadTeamSchedule = loadTeamSchedule;
window.jumpToNextMatch = jumpToNextMatch;
window.openMatchVideo = openMatchVideo;
window.closeMatchVideo = closeMatchVideo;
window.loadLiveStream = loadLiveStream;
window.loadAdminTelemetry = loadAdminTelemetry;
window.wipeAssignments = wipeAssignments;
window.autoAssign = autoAssign;
window.manualAssign = manualAssign;
window.populateManualDispatchDropdowns = populateManualDispatchDropdowns;
window.loadUserAdminTable = loadUserAdminTable;
window.assignAllToScouter = assignAllToScouter;
window.setGlobalEvent = setGlobalEvent;
window.runAutoDNP = runAutoDNP;
window.subscribeToLiveTelemetry = subscribeToLiveTelemetry;
window.generatePartnerLink = generatePartnerLink;
window.refreshApplicationData = refreshApplicationData;
window.renderActiveAssignments = renderActiveAssignments;
window.fetchStatboticsRoster = fetchStatboticsRoster;
window.performBackgroundSync = performBackgroundSync;
window.fetchGlobalEventKey = fetchGlobalEventKey;
window.initPermissionsUI = initPermissionsUI;
window.launchScoutingSession = launchScoutingSession;
window.loadCachesFromStorage = loadCachesFromStorage;
window.renderPitMap = renderPitMap;
window.initRadialMenu = initRadialMenu;
window.openTempScouterQRModal = openTempScouterQRModal;

applyTeamBranding();
if (localStorage.getItem('wobot_theme') === 'light') toggleTheme();
loadCachesFromStorage();
setInterval(checkConnection, 7000);

checkPartnerMode().then((isPartnerOrTempScout) => {
    if (!isPartnerOrTempScout) {
        bootApplication();
    }
});
sbClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !State.isGuestSession) showAuthScreen();
});

initRadialMenu();
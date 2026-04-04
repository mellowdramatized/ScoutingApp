import { APP_CONFIG } from './config.js';
import { State } from './state.js';
import { sbClient, apiFetchStatbotics, apiFetchTBA } from './api.js';
import { applyTeamBranding, showToast, toggleTheme, togglePasswordVisibility, switchView, switchDetailTab } from './ui.js';
import { setSyncState, updateConnectionUI, checkConnection, handleAuth, handleLogout, bootApplication, showAuthScreen, launchSecureSession } from './auth.js';
import { getPitFormData, saveDraft, handleScoutSubmit, getMatchFormData, resetMatchForm, handleMatchScoutSubmit, compressImage, previewRobotImage, saveToOfflineQueue, dataURItoBlob, processPayloadUpload, uploadOfflineData, startDictation, resetDictationBtn } from './forms.js';
import { toggleCompareFilter, renderCompareSidebar, setCompareSlot, renderCompareSlot, checkAutonSynergy, getNormalizeValue, updateRadarChart, allowDrop, dragLeave, drag, drop, addToPickList, removeFromPickList, savePickListsToStorage, loadPickListsFromStorage, clearPicklists, renderPickLists, exportPicklists } from './draft.js';
import { renderMasterRoster, launchDrillDownProfile, triggerScheduleDrillDown, handleProfileReturn, exportMergedStatboticsData } from './roster.js';
import { predictAllianceScore, loadTeamSchedule, jumpToNextMatch, openMatchVideo, closeMatchVideo, loadLiveStream } from './schedule.js';
import { loadAdminTelemetry, wipeAssignments, autoAssign, manualAssign, populateManualDispatchDropdowns, loadUserAdminTable, assignAllToScouter, setGlobalEvent } from './admin.js';

export async function refreshApplicationData() {
            setSyncState(true);
            try {
                const [pitRes, matchRes] = await Promise.all([
                    sbClient.from('pit_scouting').select('*').eq('event_key', State.activeEventKey),
                    sbClient.from('match_scouting').select('*').eq('event_key', State.activeEventKey)
                ]);

                const pitData = pitRes.data || [];
                State.wobotMatchData = matchRes.data || [];

                const pitDict = {};
                pitData.forEach(p => { pitDict[parseInt(p.team_number)] = p; });

                const tbaMap = JSON.parse(localStorage.getItem('tbaCache') || '{}');

                State.globalDataCache = [];

                const teamKeys = Object.keys(State.statboticsCache);

                if (teamKeys.length > 0) {
                    teamKeys.forEach(tNumStr => {
                        const teamNum = parseInt(tNumStr);
                        const stData = State.statboticsCache[teamNum];
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
                        }

                        let teamMatches = State.wobotMatchData.filter(m => parseInt(m.team_number) === teamNum);
                        let avgSkill = 0;
                        if (teamMatches.length > 0) {
                            let total = 0;
                            teamMatches.forEach(m => total += m.driver_skill);
                            avgSkill = total / teamMatches.length;
                        }

                        State.globalDataCache.push({
                            team_number: teamNum,
                            team_nickname: combinedName,
                            statbotics_total_epa: Number(stData.epa_total).toFixed(1),
                            statbotics_auto_epa: Number(stData.epa_auto).toFixed(1),
                            pit_climb: pitClimbStr,
                            rank: stData.rank,
                            driver_skill: avgSkill,
                            ...pit
                        });
                    });
                } else {
                    pitData.forEach(pit => {

                        let officialName = tbaMap[pit.team_number] || pit.team_name || `Team ${pit.team_number}`;
                        let botName = pit.team_nickname ? pit.team_nickname.trim() : "";
                        let combinedName = botName ? `${officialName} / ${botName}` : officialName;

                        let teamMatches = State.wobotMatchData.filter(m => parseInt(m.team_number) === parseInt(pit.team_number));
                        let avgSkill = 0;
                        if (teamMatches.length > 0) {
                            let total = 0;
                            teamMatches.forEach(m => total += m.driver_skill);
                            avgSkill = total / teamMatches.length;
                        }

                        State.globalDataCache.push({
                            team_number: parseInt(pit.team_number),
                            team_nickname: combinedName,
                            statbotics_total_epa: "0.0",
                            statbotics_auto_epa: "0.0",
                            pit_climb: pit.max_climb ? pit.max_climb.split(" ")[0] : "Unknown",
                            rank: "-",
                            driver_skill: avgSkill,
                            ...pit
                        });
                    });
                }

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

            document.getElementById('scout-progress-text').innerText = `${myCompleted} / ${myTotal} Scouted`;
            document.getElementById('scout-progress-perc').innerText = `${perc}%`;
            document.getElementById('scout-progress-bar').style.width = `${perc}%`;

            const scoutedNumbers = State.globalDataCache.filter(s => s.id).map(s => parseInt(s.team_number));
            const pendingTasks = myAssignments.filter(a => !a.completed && !scoutedNumbers.includes(parseInt(a.team_number)));

            if (pendingTasks.length > State.previousAssignmentCount && State.previousAssignmentCount !== 0) {
                if (Notification.permission === "granted") {
                    new Notification("New Scouting Assignment", { body: `You have ${pendingTasks.length} teams waiting.`, icon: `https://www.thebluealliance.com/avatar/${APP_CONFIG.defaultEventYear}/frc${APP_CONFIG.teamNumber}.png` });
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
            try {
                const res = await apiFetchStatbotics(`https://api.statbotics.io/v3/team_events?event=${State.activeEventKey}`);
                if (!res.ok) throw new Error("Statbotics fetch failed");
                const statboticsData = await res.json();

                let fastEpaDict = {};
                statboticsData.forEach(team => {
                    fastEpaDict[team.team] = {
                        team_name: team.team_name,
                        epa_total: team.epa?.breakdown?.total_points || 0,
                        epa_auto: team.epa?.breakdown?.auto_points || 0,
                        rank: team.record?.qual?.rank || '-'
                    };
                });

                localStorage.setItem('statbotics_event_cache', JSON.stringify(fastEpaDict));
                State.statboticsCache = fastEpaDict;
            } catch (err) {
                console.warn("Could not reach Statbotics API. Using offline cache if available.");
            }
        }

export async function performBackgroundSync() {
            if (!State.activeEventKey || State.activeEventKey === "Pending...") return;

            setSyncState(true);
            showToast("Syncing data in background...");

            try {
                await fetchStatboticsRoster();

                const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').single();
                if (tbaKey) {
                    const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/event/${State.activeEventKey}/teams/simple`, tbaKey.key_value);
                    if (res.ok) {
                        const teams = await res.json();
                        localStorage.setItem('cachedEventTeams', JSON.stringify(teams.map(t => parseInt(t.team_number))));
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
                const { data, error } = await sbClient.from('api_keys').select('key_value').eq('name', 'active_event').single();
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
                document.getElementById('btn-roster').classList.remove('hidden');
                document.getElementById('btn-schedule').classList.remove('hidden');
                document.getElementById('btn-compare').classList.remove('hidden');
                document.getElementById('btn-stream').classList.remove('hidden');
            }
            if (['admin', 'owner'].includes(State.currentUserRole)) {
                document.getElementById('btn-admin').classList.remove('hidden');
            }
            if (State.currentUserRole === 'owner') {
                document.getElementById('owner-only-tools').classList.remove('hidden');
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

applyTeamBranding();
if (localStorage.getItem('wobot_theme') === 'light') toggleTheme();
loadCachesFromStorage();
setInterval(checkConnection, 7000);
bootApplication();
sbClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') showAuthScreen();
        });

// Window Bindings
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
window.handleLogout = handleLogout;
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
window.refreshApplicationData = refreshApplicationData;
window.renderActiveAssignments = renderActiveAssignments;
window.fetchStatboticsRoster = fetchStatboticsRoster;
window.performBackgroundSync = performBackgroundSync;
window.fetchGlobalEventKey = fetchGlobalEventKey;
window.initPermissionsUI = initPermissionsUI;
window.launchScoutingSession = launchScoutingSession;
window.loadCachesFromStorage = loadCachesFromStorage;
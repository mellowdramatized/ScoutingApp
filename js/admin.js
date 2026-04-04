import { APP_CONFIG } from './config.js';
import { State } from './state.js';
import { sbClient, apiFetchTBA } from './api.js';
import { showToast } from './ui.js';
import { setSyncState } from './auth.js';
import { refreshApplicationData, fetchStatboticsRoster, fetchGlobalEventKey } from './app.js';

export async function loadAdminTelemetry(pitData) {
            const scouterCounts = {};
            pitData.forEach(report => {
                const name = report.scouter_name || 'Unknown';
                scouterCounts[name] = (scouterCounts[name] || 0) + 1;
            });
            const sortedLeaderboard = Object.entries(scouterCounts).sort((a, b) => b[1] - a[1]);
            let leaderHTML = sortedLeaderboard.map((entry, index) => `
                <div style="display:flex; justify-content:space-between; padding: 12px; border-bottom: 1px solid var(--border-grey);">
                    <span style="font-weight:bold; color:var(--text-white);"><span style="color:var(--text-muted); margin-right:10px;">#${index + 1}</span>${entry[0].split('@')[0].toUpperCase()}</span>
                    <span style="color:var(--primary-color); font-weight:900;">${entry[1]}</span>
                </div>
            `).join('');

            if (!leaderHTML) leaderHTML = "<p style='color:var(--text-muted); text-align:center; padding: 20px;'>Awaiting data collection for this event.</p>";
            document.getElementById('admin-leaderboard').innerHTML = leaderHTML;

            try {
                const { data: allAssignments } = await sbClient.from('scout_assignments').select('*').eq('event_key', State.activeEventKey).eq('completed', false);
                let pendingHTML = "";

                if (allAssignments && allAssignments.length > 0) {
                    const grouped = {};
                    allAssignments.forEach(a => {
                        const name = a.scouter_email.split('@')[0].toUpperCase();
                        if (!grouped[name]) grouped[name] = [];
                        grouped[name].push(a.team_number);
                    });
                    pendingHTML = Object.entries(grouped).map(entry => `
                        <div style="padding: 12px; border-bottom: 1px solid var(--border-grey);">
                            <strong style="color:var(--accent-color); display:block; margin-bottom:5px;">${entry[0]}</strong>
                            <div style="font-size: 0.9rem; color:var(--text-muted); font-weight: bold;">TEAMS PENDING: ${entry[1].join(', ')}</div>
                        </div>
                    `).join('');
                } else {
                    pendingHTML = "<p style='color:var(--success-color); text-align:center; padding: 20px; font-weight: bold;'>All assigned tasks completed.</p>";
                }
                document.getElementById('admin-pending-assignments').innerHTML = pendingHTML;
            } catch (err) { }
        }

export async function wipeAssignments() {
            if (!State.activeEventKey || State.activeEventKey === "Pending...") return showToast("Error: No active event set.");
            if (!confirm(`Are you absolutely sure you want to wipe ALL scouting assignments for ${State.activeEventKey.toUpperCase()}? This cannot be undone.`)) return;

            const { error } = await sbClient.from('scout_assignments').delete().eq('event_key', State.activeEventKey);

            if (!error) {
                showToast("All assignments deleted.");
                refreshApplicationData();
            } else {
                showToast(`Wipe failed: ${error.message}`);
            }
        }

export async function autoAssign() {
            setSyncState(true);
            try {
                const { data: scouters } = await sbClient.from('profiles').select('email').eq('role', 'scouter');
                const cachedTeams = JSON.parse(localStorage.getItem('cachedEventTeams') || '[]');

                const { data: existingAssignments } = await sbClient.from('scout_assignments').select('team_number').eq('event_key', State.activeEventKey);
                const assignedNumbers = existingAssignments ? existingAssignments.map(a => parseInt(a.team_number)) : [];

                const unscoutedList = cachedTeams.filter(num =>
                    !State.globalDataCache.find(d => d.team_number === num && d.id) &&
                    !assignedNumbers.includes(num)
                ).sort((a, b) => a - b);

                if (unscoutedList.length === 0) {
                    showToast("No unscouted or unassigned teams left!");
                    return;
                }

                if (!scouters || scouters.length === 0) {
                    showToast("Error: No scouter accounts found.");
                    return;
                }

                const uniqueScouters = scouters.filter((value, index, self) =>
                    index === self.findIndex((t) => (
                        t.email.split('@')[0] === value.email.split('@')[0]
                    ))
                );

                let finalAssignments = [];

                unscoutedList.forEach((teamNum, index) => {
                    const scouterIndex = index % uniqueScouters.length;
                    finalAssignments.push({
                        scouter_email: uniqueScouters[scouterIndex].email,
                        team_number: teamNum,
                        event_key: State.activeEventKey
                    });
                });

                const { error } = await sbClient.from('scout_assignments').insert(finalAssignments);
                if (error) throw error;

                showToast(`Auto-assigned ${finalAssignments.length} teams across ${uniqueScouters.length} scouters.`);
                await refreshApplicationData();
            } catch (err) {
                showToast(`Auto-assign error: ${err.message}`);
            } finally {
                setSyncState(false);
            }
        }

export async function manualAssign() {
            const targetScouter = document.getElementById('manual-scout-select').value;
            const targetTeam = document.getElementById('manual-team-select').value;

            if (!targetScouter || !targetTeam) {
                return showToast("Error: Please select both a Scouter and a Team.");
            }

            setSyncState(true);
            try {
                const payload = [{
                    scouter_email: targetScouter,
                    team_number: parseInt(targetTeam),
                    event_key: State.activeEventKey,
                    completed: false
                }];

                const { error } = await sbClient.from('scout_assignments').insert(payload);
                if (error) throw error;

                showToast(`Success: Team ${targetTeam} assigned to ${targetScouter.split('@')[0]}`);

                document.getElementById('manual-scout-select').value = "";
                document.getElementById('manual-team-select').value = "";

                await refreshApplicationData();
            } catch (err) {
                showToast(`Assignment Failed: ${err.message}`);
            } finally {
                setSyncState(false);
            }
        }

export async function populateManualDispatchDropdowns() {
            try {
                const { data: profiles } = await sbClient.from('profiles').select('email').eq('role', 'scouter');
                const scouterSelect = document.getElementById('manual-scout-select');

                if (profiles && profiles.length > 0) {
                    scouterSelect.innerHTML = `<option value="">-- Select Target Scouter --</option>` +
                        profiles.map(p => `<option value="${p.email}">${p.email}</option>`).join('');
                } else {
                    scouterSelect.innerHTML = `<option value="">No Active Scouters Available</option>`;
                }

                const cachedTeams = JSON.parse(localStorage.getItem('cachedEventTeams') || '[]');
                const teamSelect = document.getElementById('manual-team-select');

                if (cachedTeams.length > 0) {
                    const sortedTeams = cachedTeams.sort((a, b) => a - b);
                    teamSelect.innerHTML = `<option value="">-- Select Target Team --</option>` +
                        sortedTeams.map(teamNum => `<option value="${teamNum}">Team ${teamNum}</option>`).join('');
                } else {
                    teamSelect.innerHTML = `<option value="">No Teams Cached (Sync Event first)</option>`;
                }
            } catch (err) {
                console.error("Dropdown population error", err);
            }
        }

export async function loadUserAdminTable() {
            try {
                const { data: users } = await sbClient.from('profiles').select('*').order('email', { ascending: true });
                if (State.adminTableInstance) State.adminTableInstance.setData(users);
                else {
                    State.adminTableInstance = new Tabulator("#user-admin-table", {
                        data: users,
                        layout: "fitColumns",
                        columns: [
                            { title: "USER EMAIL", field: "email", widthGrow: 2 },
                            {
                                title: "ROLE", field: "role", editor: "list", widthGrow: 1, editorParams: { values: ["scouter", "strategist", "drive_coach", "admin"] },
                                cellEdited: async (cell) => {
                                    const record = cell.getData();
                                    if (record.email.toLowerCase() === APP_CONFIG.ownerEmailLock) return loadUserAdminTable();
                                    await sbClient.from('profiles').update({ role: record.role }).eq('id', record.id);
                                }
                            }
                        ],
                    });
                }
            } catch (err) { }
        }

export async function assignAllToScouter() {
            if (!confirm("Reset all user permissions?")) return;
            await sbClient.from('profiles').update({ role: 'scouter' }).neq('email', APP_CONFIG.ownerEmailLock);
            loadUserAdminTable();
        }

export async function setGlobalEvent() {
            setSyncState(true);
            const inputKey = document.getElementById('admin-event-input').value.trim();
            if (!inputKey) {
                setSyncState(false);
                return showToast("Please enter an event key.");
            }

            try {
                await sbClient.from('api_keys').update({ key_value: inputKey }).eq('name', 'active_event');
                await fetchStatboticsRoster();

                const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').single();
                if (tbaKey) {
                    const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/event/${inputKey}/teams/simple`, tbaKey.key_value);
                    if (res.ok) {
                        const teams = await res.json();
                        localStorage.setItem('cachedEventTeams', JSON.stringify(teams.map(t => parseInt(t.team_number))));

                        let tbaMap = {};
                        teams.forEach(t => tbaMap[t.team_number] = t.nickname);
                        localStorage.setItem('tbaCache', JSON.stringify(tbaMap));
                    }

                    const rankRes = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/event/${inputKey}/rankings`, tbaKey.key_value);
                    if (rankRes.ok) {
                        const rankData = await rankRes.json();
                        let rankMap = {};
                        if (rankData && rankData.rankings) {
                            rankData.rankings.forEach(r => rankMap[r.team_key.replace('frc', '')] = r.rank);
                        }
                        localStorage.setItem('tbaRankCache', JSON.stringify(rankMap));
                    }
                }

                showToast(`Event updated to ${inputKey.toUpperCase()}`);
                await fetchGlobalEventKey();
                await refreshApplicationData();

            } catch (err) {
                console.error("Event update failed", err);
                showToast("Sync Error: Check your TBA API Key.");
            } finally {
                setSyncState(false);
            }
        }

export function runAutoDNP() {
    let brokenCounts = {};
    State.wobotMatchData.forEach(match => {
        if (match.broke_down === true) {
            let num = parseInt(match.team_number);
            brokenCounts[num] = (brokenCounts[num] || 0) + 1;
        }
    });
    
    let blacklistedCount = 0;
    for (let teamNum in brokenCounts) {
        if (brokenCounts[teamNum] >= 2) {
            let num = parseInt(teamNum);
            if (!State.dnpList.includes(num)) {
                State.dnpList.push(num);
                blacklistedCount++;
            }
        }
    }
    showToast(`Auto DNP applied: ${blacklistedCount} teams blacklisted.`);
}
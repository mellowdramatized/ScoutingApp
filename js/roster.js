import { STRATEGIC_TAGS } from './config.js';
import { State } from './state.js';
import { sbClient, apiFetchTBA } from './api.js';
import { showToast, switchView, switchDetailTab } from './ui.js';
import { openMatchVideo } from './schedule.js';

export function renderMasterRoster() {
            if (State.mainTableInstance) State.mainTableInstance.destroy();
            State.mainTableInstance = new Tabulator("#main-table", {
                data: State.globalDataCache,
                layout: "fitColumns",
                responsiveLayout: "collapse",
                responsiveLayoutCollapseStartOpen: false,
                pagination: "local",
                paginationSize: 24,
                columns: [
                    { formatter: "responsiveCollapse", width: 30, minWidth: 30, hozAlign: "center", resizable: false, headerSort: false },
                    { title: "AVATAR", field: "team_number", width: 70, hozAlign: "center", responsive: 1, formatter: (cell) => `<img src="https://www.thebluealliance.com/avatar/${State.activeEventKey.substring(0, 4)}/frc${cell.getValue()}.png" alt="Team Avatar" onerror="this.style.display='none'" style="height:30px;">` },
                    { title: "TEAM", field: "team_number", headerFilter: "input", width: 80, sorter: "number", hozAlign: "center", responsive: 0 },
                    {
                        title: "TEAM / ROBOT", field: "team_nickname", headerFilter: "input", widthGrow: 2, responsive: 1,
                        formatter: (cell) => {
                            const data = cell.getData();
                            const nickname = cell.getValue();
                            const matches = State.wobotMatchData.filter(m => parseInt(m.team_number) === parseInt(data.team_number));
                            const hasBrokeDown = matches.some(m => m.broke_down === true);
                            const isGlassCannon = parseFloat(data.statbotics_total_epa) > 30 && (parseFloat(data.driver_skill) < 2.5 || hasBrokeDown);
                            return isGlassCannon ? `${nickname} <span style="color:var(--danger-color); font-weight:bold;">⚠️ GLASS CANNON</span>` : nickname;
                        }
                    },
                    { title: "RANK", field: "rank", width: 70, hozAlign: "center", sorter: "number", responsive: 0 },
                    {
                        title: "TOTAL EPA", field: "statbotics_total_epa", width: 120, hozAlign: "center", sorter: "number", responsive: 2,
                        formatter: (cell) => {
                            const val = cell.getValue();
                            if (val === undefined || val === null || val === "" || val == 0) return "-";
                            const numVal = Number(val);
                            const cls = numVal > 40 ? 'epa-high' : (numVal > 25 ? 'epa-mid' : 'epa-low');
                            return `<span class="status-pill ${cls}">${numVal.toFixed(1)}</span>`;
                        }
                    },
                    { title: "AUTO EPA", field: "statbotics_auto_epa", width: 110, hozAlign: "center", sorter: "number", responsive: 3 },
                    { title: "PIT CLIMB", field: "pit_climb", width: 100, hozAlign: "center", responsive: 4 },
                    { title: "DONE", field: "id", hozAlign: "center", width: 70, responsive: 2, formatter: "tickCross" },
                    { title: "IS KITBOT", field: "isKitbot", hozAlign: "center", width: 100, responsive: 1, formatter: "tickCross" }
                ],
            });
            State.mainTableInstance.on("rowClick", (e, row) => launchDrillDownProfile(row.getData()));
        }

export async function launchDrillDownProfile(teamData) {
            var feulAccuracy = teamData.feulaccuracy;
            if (feulAccuracy == null) {
                feulAccuracy = 0
            }
            State.activeProfileTeam = teamData.team_number;
            switchView('view-detail');
            switchDetailTab('overview');
            document.getElementById('detail-team-name').innerText = `TEAM ${teamData.team_number}: ${teamData.team_nickname ? teamData.team_nickname.toUpperCase() : 'UNKNOWN'}`;

            const mediaBox = document.getElementById('detail-image-box');
            mediaBox.innerHTML = teamData.image_url ? `<img src="${teamData.image_url}" class="robot-photo" alt="Robot Photo">` : `<div id="img-placeholder">NO PHOTO AVAILABLE</div>`;

            let pillsHTML = "";
            STRATEGIC_TAGS.forEach(tag => {
                if (teamData[tag.id] === true || teamData[tag.id] === "true") {
                    pillsHTML += `<span class="stat-badge" style="border:1px solid ${tag.color}; color:${tag.color}; margin-right: 5px; margin-bottom: 5px;">${tag.label}</span>`;
                }
            });
            if (pillsHTML === "") pillsHTML = `<span style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">No strategic tags recorded.</span>`;

            document.getElementById('pit-stats-content').innerHTML = `
                <div style="margin-bottom: 15px;">${pillsHTML}</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">DRIVETRAIN: ${teamData.drivetrain || 'N/A'} (${teamData.drive_motor || 'N/A'})</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">TERRAIN NAV: ${teamData.terrain_nav || 'N/A'}</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">INTAKE: ${teamData.intake_loc || 'N/A'}</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">FUEL CAPACITY: ${teamData.fuel_capacity || '0'}</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">SCORING METHOD: ${teamData.scoring_method || 'N/A'}</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">AUTON FUEL: ${teamData.auton_fuel || '0'}</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">MAX CLIMB: ${teamData.max_climb || 'N/A'} (${teamData.climb_speed || 'N/A'})</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">FUEL ACCURACY: ${teamData.fuelaccuracy || 'N/A'}%</div>
                <div style="border-bottom:1px solid var(--border-grey); padding-bottom:10px; margin-bottom:10px;">FUEL RANGE: ${teamData.fuel_range || 'N/A'}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 10px;">INSPECTED BY: ${teamData.scouter_initials || 'Not Scouted Yet'}</div>
            `;

            const tbaLinkContainer = document.getElementById('TBA-team-link');
            if (tbaLinkContainer) {
                const year = State.activeEventKey ? State.activeEventKey.substring(0, 4) : new Date().getFullYear();
                const tbaUrl = `https://www.thebluealliance.com/team/${teamData.team_number}/${year}`;
                tbaLinkContainer.innerHTML = `<a href="${tbaUrl}" target="_blank" style="color:var(--accent-color); font-weight:900; text-decoration:none; display:inline-block; margin-top:15px; padding: 10px 15px; background: var(--field-bg); border-radius: 8px; border: 1px solid var(--border-grey); transition: var(--transition-smooth);">View on The Blue Alliance 🔗</a>`;
            }

            document.getElementById('detail-notes-block').innerHTML = `<p><strong style="color:var(--primary-color);">PROUD FEATURES:</strong> ${teamData.proud_features || 'N/A'}</p><p style="margin-top: 10px;"><strong style="color:var(--primary-color);">STRATEGIC PITCH:</strong> ${teamData.strategic_pitch || 'N/A'}</p>`;
            document.getElementById('detail-vulnerabilities-block').innerText = teamData.vulnerabilities || "No vulnerabilities identified/recorded.";

            const savedNote = localStorage.getItem(`wobot_note_${State.activeEventKey}_${teamData.team_number}`);
            document.getElementById('strategist-notes-input').value = savedNote || '';

            const stData = State.statboticsCache[teamData.team_number];
            if (stData) {
                document.getElementById('detail-rank-val').innerText = `#${teamData.rank || '-'}`;
                document.getElementById('detail-expected-pts').innerHTML = `${Number(stData.epa_total || 0).toFixed(1)} <span style="font-size:1.2rem; color:var(--text-white);">PTS</span>`;
                document.getElementById('statbotics-team-content').innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                        <div style="background:var(--field-bg); padding: 15px; border-radius: 8px;">TOTAL EPA: <strong style="color:var(--admin-color);">${Number(stData.epa_total || 0).toFixed(1)}</strong></div>
                        <div style="background:var(--field-bg); padding: 15px; border-radius: 8px;">AUTO EPA: <strong>${Number(stData.epa_auto || 0).toFixed(1)}</strong></div>
                        <div style="background:var(--field-bg); padding: 15px; border-radius: 8px;">TELEOP EPA: <strong>${(Number(stData.epa_total || 0) - Number(stData.epa_auto || 0)).toFixed(1)}</strong></div>
                    </div>`;
            } else {
                document.getElementById('detail-rank-val').innerText = `#${teamData.rank || '-'}`;
                document.getElementById('detail-expected-pts').innerHTML = `N/A <span style="font-size:1.2rem; color:var(--text-white);">PTS</span>`;
                document.getElementById('statbotics-team-content').innerHTML = `<div style="padding: 15px; color: var(--text-muted);">No Statbotics EPA available yet.</div>`;
            }

            if (State.matchTableInstance) State.matchTableInstance.destroy();
            let finalMatchLog = [];

            document.getElementById('match-history-table').innerHTML = "<div style='padding:30px; text-align:center; color:var(--text-muted); font-weight:bold;'>Syncing WOBOT & TBA Data...</div>";

            try {
                let localEvals = State.wobotMatchData.filter(m => parseInt(m.team_number) === parseInt(teamData.team_number));
                let tbaMatches = [];

                try {
                    const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').single();
                    if (tbaKey && tbaKey.key_value) {
                        const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/team/frc${teamData.team_number}/event/${State.activeEventKey}/matches`, tbaKey.key_value);
                        if (res.ok) tbaMatches = await res.json();
                    }
                } catch (e) { console.warn("TBA fetch skipped or failed."); }

                const standardizeMatchKey = (rawStr) => {
                    if (!rawStr) return "unknown";
                    let s = rawStr.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (/^\d+$/.test(s)) s = 'qm' + s;
                    if (s.startsWith('q') && !s.startsWith('qm') && !s.startsWith('qf')) s = s.replace('q', 'qm');
                    if (s.startsWith('qf') || s.startsWith('ef')) s = s.replace(/^(qf|ef)/, 'sf');
                    return s;
                };

                let uniqueMatchKeys = new Set();
                tbaMatches.forEach(m => uniqueMatchKeys.add(standardizeMatchKey(m.comp_level + m.match_number)));
                localEvals.forEach(w => uniqueMatchKeys.add(standardizeMatchKey(w.match_number)));

                finalMatchLog = Array.from(uniqueMatchKeys).map(matchKey => {
                    let tMatch = tbaMatches.find(m => standardizeMatchKey(m.comp_level + m.match_number) === matchKey);
                    let wEval = localEvals.find(w => standardizeMatchKey(w.match_number) === matchKey);

                    let isRed = tMatch && tMatch.alliances && tMatch.alliances.red && tMatch.alliances.red.team_keys.includes('frc' + teamData.team_number);
                    let alliance = isRed ? 'red' : 'blue';
                    let bd = (tMatch && tMatch.score_breakdown && tMatch.score_breakdown[alliance]) ? tMatch.score_breakdown[alliance] : null;
                    let robotIndex = (tMatch && tMatch.alliances && tMatch.alliances[alliance]) ? tMatch.alliances[alliance].team_keys.indexOf('frc' + teamData.team_number) + 1 : 1;
                    let totalPts = (tMatch && tMatch.alliances && tMatch.alliances[alliance]) ? tMatch.alliances[alliance].score : -1;

                    const findVal = (b, keywords) => {
                        if (!b) return '-';
                        for (let kw of keywords) { if (b[kw] !== undefined && b[kw] !== null) return b[kw]; }
                        let keys = Object.keys(b);
                        for (let kw of keywords) {
                            let match = keys.find(k => k.toLowerCase().includes(kw.toLowerCase()));
                            if (match) return b[match];
                        }
                        return '-';
                    };

                    let autoPts = findVal(bd, ['totalAuto', 'autoPoints', 'autoScore']);
                    let telePts = findVal(bd, ['totalTeleop', 'teleopPoints', 'teleopHub', 'teleopFuel']);
                    let climb = findVal(bd, [`endgameRobot${robotIndex}`, `robot${robotIndex}Endgame`, `endgameStatus${robotIndex}`]);

                    let accuracy = bd ? "TBA Data" : "Unscored/Pending";
                    let driverAbility = "-";
                    let scouter = bd ? "TBA API" : "TBA Schedule";
                    let combinedNotes = "No manual scouting data recorded for this match.";

                    if (!tMatch && wEval) {
                        accuracy = "Manual Entry";
                        scouter = "★ WOBOT";
                    }

                    if (wEval) {
                        scouter = "★ " + wEval.scouter_name.split('@')[0];
                        accuracy = wEval.broke_down ? "BROKEN" : "Active";
                        driverAbility = wEval.driver_skill + "/5";
                        combinedNotes = wEval.notes ? `★ WOBOT: ${wEval.notes}` : "No WOBOT notes.";
                    }

                    return {
                        match: matchKey.toUpperCase(),
                        totalPoints: totalPts, autoPoints: autoPts, teleopPoints: telePts,
                        endgameClimb: climb, accuracy: accuracy, driverAbility: driverAbility,
                        scouter: scouter, notes: combinedNotes
                    };
                });

                const levelOrder = { 'qm': 1, 'sf': 2, 'f': 3 };
                finalMatchLog.sort((a, b) => {
                    let aLvl = a.match.toLowerCase().replace(/[0-9]/g, '');
                    let bLvl = b.match.toLowerCase().replace(/[0-9]/g, '');
                    let aNum = parseInt(a.match.replace(/[^0-9]/g, '')) || 0;
                    let bNum = parseInt(b.match.replace(/[^0-9]/g, '')) || 0;

                    let aOrder = levelOrder[aLvl] || 99;
                    let bOrder = levelOrder[bLvl] || 99;

                    if (aOrder !== bOrder) return aOrder - bOrder;
                    return aNum - bNum;
                });

            } catch (e) {
                console.error("Hybrid merge failed", e);
            }

            State.matchTableInstance = new Tabulator("#match-history-table", {
                data: finalMatchLog,
                layout: "fitColumns",
                responsiveLayout: "collapse",
                responsiveLayoutCollapseStartOpen: false,
                columns: [
                    { formatter: "responsiveCollapse", width: 30, minWidth: 30, hozAlign: "center", resizable: false, headerSort: false },
                    {
                        title: "MATCH", field: "match", width: 120, hozAlign: "center", responsive: 0,
                        formatter: (cell) => {
                            const matchStr = cell.getValue();
                            if (!matchStr) return "-";
                            let formattedMatchCode = matchStr.trim().toLowerCase().replace(/\s+/g, '');
                            const matchKey = `${State.activeEventKey}_${formattedMatchCode}`;
                            return `<div style="display:flex; gap: 8px; align-items:center; justify-content:center;">
                                        <a href="https://www.thebluealliance.com/match/${matchKey}" target="_blank" style="color:var(--text-white); font-weight:bold; text-decoration:none;">${matchStr.toUpperCase()} 🔗</a>
                                        <button onclick="openMatchVideo('${matchKey}')" style="background:var(--primary-color); border:none; border-radius:4px; padding:2px 6px; cursor:pointer; color:white; font-size:0.9rem;" title="Watch Video">🎥</button>
                                    </div>`;
                        }
                    },
                    { title: "TOTAL", field: "totalPoints", width: 80, hozAlign: "center", responsive: 0 },
                    { title: "AUTO", field: "autoPoints", width: 70, hozAlign: "center", responsive: 2 },
                    { title: "TELEOP", field: "teleopPoints", width: 80, hozAlign: "center", responsive: 2 },
                    { title: "CLIMB", field: "endgameClimb", width: 90, hozAlign: "center", responsive: 3 },
                    { title: "DRIVER", field: "driverAbility", width: 80, hozAlign: "center", responsive: 4 },
                    { title: "SCOUTER", field: "scouter", width: 120, hozAlign: "center", responsive: 5 },
                    {
                        title: "SCOUTER NOTES", field: "notes", widthGrow: 3, minWidth: 280, responsive: 1,
                        formatter: (cell) => {
                            const val = cell.getValue();
                            if (!val || val.trim() === "" || val === "-" || val.includes("Total Shift Pts: N/A")) {
                                return `<span style="color:var(--text-muted); font-style:italic;">No notes recorded</span>`;
                            }
                            let isWarning = val.includes("⚠️") || val.includes("BROKEN");
                            return `
                                <div style="background: ${isWarning ? 'rgba(220, 53, 69, 0.1)' : 'rgba(243, 156, 18, 0.1)'}; 
                                            padding: 12px; 
                                            border-radius: 6px; 
                                            border-left: 4px solid ${isWarning ? 'var(--danger-color)' : 'var(--accent-color)'}; 
                                            white-space: pre-wrap; 
                                            font-size: 0.95rem; 
                                            line-height: 1.5; 
                                            text-align: left; 
                                            color: var(--text-white); 
                                            margin: 6px 0; 
                                            word-break: break-word;">${val}</div>`;
                        }
                    }
                ],
            });
        }

export function triggerScheduleDrillDown(teamData) {
            if (!teamData) return showToast("Team data not fully loaded yet.");
            State.returnViewOverride = 'view-schedule';
            State.returnScrollPos = window.scrollY;
            launchDrillDownProfile(teamData);
        }

export function handleProfileReturn() {
            switchView('view-roster');
        }

export async function exportMergedStatboticsData() {
            if (Object.keys(State.statboticsCache).length === 0) return showToast("No Statbotics data to export.");

            try {
                const { data: pitData } = await sbClient.from('pit_scouting').select('*').eq('event_key', State.activeEventKey);
                let csvContent = "data:text/csv;charset=utf-8,";

                let statboticsHeaders = ["Team_Number", "Team_Name", "Statbotics_Total_EPA", "Statbotics_Auto_EPA", "Statbotics_Rank"];
                let pitHeaders = ["Wobot_Drivetrain", "Wobot_Motor", "Wobot_Terrain", "Wobot_Intake", "Wobot_Capacity", "Wobot_Scoring", "Wobot_Auton_Start", "Wobot_Auton_Fuel", "Wobot_Auton_Climb", "Wobot_Max_Climb", "Wobot_Climb_Speed", "Wobot_Proud_Features", "Wobot_Pitch", "Wobot_Vulnerabilities", "Wobot_Scouter", "Static_Auton", "Center_Half_Auton", "Center_Full_Auton", "Defense_Main", "Feeder_Human", "Feeder_Floor", "Is_Kitbot"];

                csvContent += statboticsHeaders.join(",") + "," + pitHeaders.join(",") + "\r\n";

                Object.keys(State.statboticsCache).forEach(teamNum => {
                    let row = [];
                    let stData = State.statboticsCache[teamNum];

                    row.push(`"${teamNum}"`);
                    row.push(`"${(stData.team_name || '').replace(/"/g, '""')}"`);
                    row.push(`"${stData.epa_total || 0}"`);
                    row.push(`"${stData.epa_auto || 0}"`);
                    row.push(`"${stData.rank || '-'}"`);

                    let pData = (pitData || []).find(p => parseInt(p.team_number) === parseInt(teamNum));

                    if (pData) {
                        row.push(`"${(pData.drivetrain || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.drive_motor || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.terrain_nav || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.intake_loc || '').replace(/"/g, '""')}"`);
                        row.push(`"${pData.fuel_capacity || 0}"`);
                        row.push(`"${(pData.scoring_method || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.auton_start_pos || '').replace(/"/g, '""')}"`);
                        row.push(`"${pData.auton_fuel || 0}"`);
                        row.push(`"${(pData.auton_climb || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.max_climb || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.climb_speed || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.proud_features || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.strategic_pitch || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.vulnerabilities || '').replace(/"/g, '""')}"`);
                        row.push(`"${(pData.scouter_name || '').replace(/"/g, '""')}"`);

                        row.push(`"${pData.tag_static_auton || false}"`);
                        row.push(`"${pData.tag_center_half || false}"`);
                        row.push(`"${pData.tag_center_full || false}"`);
                        row.push(`"${pData.tag_defense_main || false}"`);
                        row.push(`"${pData.tag_feeder_human || false}"`);
                        row.push(`"${pData.tag_feeder_floor || false}"`);
                        row.push(`"${pData.isKitbot || false}"`);

                    } else {
                        pitHeaders.forEach(() => row.push('""'));
                    }
                    csvContent += row.join(",") + "\r\n";
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `WOBOT_Merged_Statbotics_Data_${State.activeEventKey}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showToast("Merged Data Exported Successfully.");
            } catch (e) {
                console.error("Export failed", e);
                showToast("Failed to generate export.");
            }
        }
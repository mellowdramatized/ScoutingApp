import { APP_CONFIG } from './config.js';
import { State } from './state.js';
import { sbClient, apiFetchTBA } from './api.js';
import { showToast } from './ui.js';
import { setSyncState } from './auth.js';
import { triggerScheduleDrillDown } from './roster.js';

export function predictAllianceScore(allianceTeamKeys) {
    let score = 0; let auto = 0; let tele = 0;
    allianceTeamKeys.forEach(teamKey => {
        let tNum = parseInt(teamKey.replace('frc', ''));
        let stData = State.statboticsCache[tNum];
        if (stData) {
            score += parseFloat(stData.epa_total || 0);
            auto += parseFloat(stData.epa_auto || 0);
            tele += (parseFloat(stData.epa_total || 0) - parseFloat(stData.epa_auto || 0));
        }
    });
    return { score: score.toFixed(1), auto: auto.toFixed(1), tele: tele.toFixed(1) };
}

export async function loadTeamSchedule() {
    let targetTeam = document.getElementById('predictor-team-input').value || APP_CONFIG.teamNumber;
    const container = document.getElementById('schedule-container');
    container.innerHTML = '<div style="color:var(--text-muted); font-weight:bold;">Fetching match data from The Blue Alliance...</div>';
    setSyncState(true);

    try {
        const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').single();
        if (!tbaKey) return showToast("Error: TBA API Key not set in Admin Panel.");

        const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/team/frc${targetTeam}/event/${State.activeEventKey}/matches/simple`, tbaKey.key_value);
        if (!res.ok) throw new Error("TBA fetch failed.");
        let matches = await res.json();

        if (matches.length === 0) {
            container.innerHTML = '<div style="color:var(--accent-color); font-weight:bold;">No matches found for this team at the active event yet.</div>';
            return;
        }

        const levelOrder = { 'qm': 1, 'ef': 2, 'qf': 3, 'sf': 4, 'f': 5 };
        matches.sort((a, b) => {
            if (levelOrder[a.comp_level] !== levelOrder[b.comp_level]) return levelOrder[a.comp_level] - levelOrder[b.comp_level];
            return a.match_number - b.match_number;
        });
        State.currentScheduleMatches = matches;

        let projW = 0, projL = 0, projT = 0;
        let actW = 0, actL = 0, actT = 0;
        let maxDiff = -9999; let easiestMatch = "None";
        let minDiff = 9999; let hardestMatch = "None";

        let html = '';
        matches.forEach(m => {
            let redTeams = m.alliances.red.team_keys;
            let blueTeams = m.alliances.blue.team_keys;
            let targetIsRed = redTeams.includes(`frc${targetTeam}`);

            let redPred = predictAllianceScore(redTeams);
            let bluePred = predictAllianceScore(blueTeams);

            let targetProj = targetIsRed ? redPred.score : bluePred.score;
            let oppProj = targetIsRed ? bluePred.score : redPred.score;
            let diff = parseFloat(targetProj) - parseFloat(oppProj);

            let matchName = `${m.comp_level.toUpperCase()} ${m.match_number}`;
            let matchTime = m.predicted_time || m.time;
            let timeString = matchTime ? new Date(matchTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD";

            if (diff > maxDiff) { maxDiff = diff; easiestMatch = matchName; }
            if (diff < minDiff) { minDiff = diff; hardestMatch = matchName; }
            if (diff > 0) projW++; else if (diff < 0) projL++; else projT++;

            let redScore = m.alliances.red.score;
            let blueScore = m.alliances.blue.score;
            let matchPlayed = redScore > -1 && blueScore > -1;

            if (matchPlayed) {
                let targetAct = targetIsRed ? redScore : blueScore;
                let oppAct = targetIsRed ? blueScore : redScore;
                if (targetAct > oppAct) actW++; else if (targetAct < oppAct) actL++; else actT++;
            }

            let redWinProj = parseFloat(redPred.score) > parseFloat(bluePred.score);
            let blueWinProj = parseFloat(bluePred.score) > parseFloat(redPred.score);

            const getContribStr = (keys) => keys.map(t => {
                let num = t.replace('frc', '');
                let pts = State.statboticsCache[num] ? Number(State.statboticsCache[num].epa_total || 0).toFixed(1) : '-';
                let isTarget = num === targetTeam.toString();

                let cachedTeam = State.globalDataCache.find(d => d.team_number === parseInt(num));
                let teamObjStr = "null";

                if (cachedTeam) {
                    teamObjStr = JSON.stringify(cachedTeam).replace(/"/g, '&quot;');
                } else {
                    teamObjStr = JSON.stringify({ team_number: num, team_nickname: "Unknown", rank: "-", statbotics_total_epa: pts }).replace(/"/g, '&quot;');
                }

                return `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--border-grey); padding-bottom:6px; ${isTarget ? 'color:var(--text-white); font-weight:900;' : 'color:var(--text-muted);'}">
                            <a href="javascript:void(0)" onclick="triggerScheduleDrillDown(${teamObjStr})" style="color: inherit; text-decoration: none; border-bottom: 1px dashed currentColor; padding-bottom: 2px; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-color)'" onmouseout="this.style.color='${isTarget ? 'var(--text-white)' : 'var(--text-muted)'}'">
                                ${isTarget ? '► ' : ''}Team ${num}
                            </a>
                            <span style="color:var(--accent-color); font-weight:bold; font-size: 0.9rem;">${pts} pts</span>
                        </div>`;
            }).join('');

            let rStr = getContribStr(redTeams);
            let bStr = getContribStr(blueTeams);

            let actualScoreBanner = matchPlayed ? `<div style="background:var(--field-bg); padding:10px; border-radius:8px; text-align:center; font-weight:900; margin-bottom:15px; color:var(--text-white); border: 1px solid var(--border-grey); display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:15px;"><span>ACTUAL SCORE: <span style="color:var(--primary-color);">RED ${redScore}</span> - <span style="color:var(--blue-alliance);">BLUE ${blueScore}</span></span><button onclick="openMatchVideo('${m.key}')" style="background:var(--primary-color); border:none; padding:6px 15px; border-radius:4px; color:white; font-weight:bold; cursor:pointer; font-size:0.85rem;">🎥 WATCH</button></div>` : '';

            html += `<div id="match-card-${m.key}" class="card" style="padding:20px; display:flex; flex-direction:column; gap:15px; border-left: 6px solid var(--border-light);">
                                <div style="font-size:1.2rem; font-weight:900; color:var(--text-white); border-bottom:1px solid var(--border-grey); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                                    <span>${matchName} <span style="font-size:0.9rem; color:var(--text-muted); margin-left: 10px; white-space:nowrap;">🕒 ${timeString}</span></span>
                                    <span style="font-size:0.8rem; color:var(--text-muted); background: var(--bg-black); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-grey);">${matchPlayed ? '✅ COMPLETED' : '🕒 UPCOMING'}</span>
                                </div>
                                ${actualScoreBanner}
                                <div class="match-alliance-grid">
                                    <div style="background:rgba(230, 32, 32, 0.05); border: 2px solid ${redWinProj ? 'var(--primary-color)' : 'var(--border-light)'}; border-radius:8px; padding:15px;">
                                        <h2 class="sub-title" style="color:var(--primary-color); margin-bottom:15px;">RED ALLIANCE ${redWinProj ? ' (FAVORED)' : ''}</h2><div style="margin-bottom:15px;">${rStr}</div>
                                        <div style="font-size:0.9rem; color:var(--text-muted); border-top: 2px dashed var(--border-light); padding-top: 10px; display:flex; justify-content:space-between; align-items:center;">
                                            <span>Auto: ${redPred.auto} | Tele: ${redPred.tele}</span>
                                            <span style="text-align:right;">Proj: <strong style="color:var(--text-white); font-size:1.2rem;">${redPred.score}</strong></span>
                                        </div>
                                    </div>
                                    <div style="background:rgba(59, 130, 246, 0.05); border: 2px solid ${blueWinProj ? 'var(--blue-alliance)' : 'var(--border-light)'}; border-radius:8px; padding:15px;">
                                        <h2 class="sub-title" style="color:var(--blue-alliance); margin-bottom:15px;">BLUE ALLIANCE ${blueWinProj ? ' (FAVORED)' : ''}</h2><div style="margin-bottom:15px;">${bStr}</div>
                                        <div style="font-size:0.9rem; color:var(--text-muted); border-top: 2px dashed var(--border-light); padding-top: 10px; display:flex; justify-content:space-between; align-items:center;">
                                            <span>Auto: ${bluePred.auto} | Tele: ${bluePred.tele}</span>
                                            <span style="text-align:right;">Proj: <strong style="color:var(--text-white); font-size:1.2rem;">${bluePred.score}</strong></span>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
        });

        let statsHtml = `
                    <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                        <div class="card" style="margin-bottom:0; padding: 20px; border-top: 4px solid var(--accent-color);">
                            <h2 class="sub-title" style="color:var(--accent-color); font-size:1rem; margin-bottom:5px;">WIN / LOSS RECORD</h2>
                            <div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold;"><span style="color:var(--text-muted);">Projected Record:</span><span style="color:var(--text-white);">${projW} - ${projL} - ${projT}</span></div>
                            <div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold;"><span style="color:var(--text-muted);">Actual Record:</span><span style="color:var(--text-white);">${actW} - ${actL} - ${actT}</span></div>
                        </div>
                        <div class="card" style="margin-bottom:0; padding: 20px; border-top: 4px solid var(--success-color);">
                            <h2 class="sub-title" style="color:var(--success-color); font-size:1rem; margin-bottom:5px;">SCHEDULE DIFFICULTY</h2>
                            <div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold;"><span style="color:var(--text-muted);">Easiest Match:</span><span style="color:var(--success-color);">${easiestMatch} (+${maxDiff > 0 ? maxDiff.toFixed(1) : maxDiff.toFixed(1)})</span></div>
                            <div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold;"><span style="color:var(--text-muted);">Hardest Match:</span><span style="color:var(--danger-color);">${hardestMatch} (${minDiff > 0 ? '+' + minDiff.toFixed(1) : minDiff.toFixed(1)})</span></div>
                        </div>
                    </div>
                `;
        container.innerHTML = statsHtml + html;
        showToast("Schedule and predictions loaded.");
    } catch (err) {
        container.innerHTML = '<div style="color:var(--danger-color); font-weight:bold;">Failed to fetch schedule. Check connection or event key.</div>';
        showToast("Failed to fetch schedule.");
    } finally {
        setSyncState(false);
    }
}

export function jumpToNextMatch() {
    if (!State.currentScheduleMatches || State.currentScheduleMatches.length === 0) return showToast("Load a schedule first.");
    const nextMatch = State.currentScheduleMatches.find(m => m.alliances.red.score === -1);
    if (nextMatch) {
        const el = document.getElementById(`match-card-${nextMatch.key}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.borderLeft = "10px solid var(--accent-color)";
            setTimeout(() => el.style.borderLeft = "6px solid var(--border-light)", 3000);
            showToast(`Jumped to Match ${nextMatch.match_number}`);
        }
    } else {
        showToast("All scheduled matches have been played.");
    }
}

export async function openMatchVideo(matchKey) {
    try {
        const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').single();
        if (!tbaKey) return showToast("Error: TBA API Key not set.");

        const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/match/${matchKey}`, tbaKey.key_value);

        if (!res.ok) throw new Error("Match not found.");
        const matchData = await res.json();

        const statsContainer = document.getElementById('video-stats-container');

        const getTeamLinks = (keys) => keys.map(t => {
            let num = t.replace('frc', '');
            let cachedTeam = State.globalDataCache.find(d => d.team_number === parseInt(num));
            let teamObjStr = "null";
            if (cachedTeam) {
                teamObjStr = JSON.stringify(cachedTeam).replace(/"/g, '&quot;');
            } else {
                teamObjStr = JSON.stringify({ team_number: num, team_nickname: "Unknown", rank: "-", statbotics_total_epa: "-" }).replace(/"/g, '&quot;');
            }
            return `<a href="javascript:void(0)" onclick="closeMatchVideo(); triggerScheduleDrillDown(${teamObjStr})" style="color: inherit; text-decoration: none; border-bottom: 1px dashed currentColor; padding-bottom: 2px; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-color)'" onmouseout="this.style.color='inherit'">${num}</a>`;
        }).join(' &nbsp;|&nbsp; ');

        const redTeamsHTML = getTeamLinks(matchData.alliances.red.team_keys);
        const blueTeamsHTML = getTeamLinks(matchData.alliances.blue.team_keys);

        const redScore = matchData.alliances.red.score;
        const blueScore = matchData.alliances.blue.score;
        const matchPlayed = redScore > -1 && blueScore > -1;

        const redWin = matchPlayed && redScore > blueScore;
        const blueWin = matchPlayed && blueScore > redScore;

        statsContainer.innerHTML = `
                    <div class="match-alliance-grid">
                        <div style="background: ${redWin ? 'rgba(230, 32, 32, 0.15)' : 'var(--bg-black)'}; border: 1px solid ${redWin ? 'var(--primary-color)' : 'var(--border-grey)'}; border-radius: 8px; padding: 20px; border-left: 6px solid var(--primary-color);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                                <span style="color:var(--primary-color); font-weight:900; font-size:1.1rem; letter-spacing:1px;">RED ALLIANCE</span>
                                ${redWin ? '<span style="background:var(--primary-color); color:white; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; letter-spacing:1px;">WINNER</span>' : ''}
                            </div>
                            <div style="font-size:1.2rem; font-weight:bold; color:var(--text-white); margin-bottom: 15px;">
                                ${redTeamsHTML}
                            </div>
                            <div style="font-size:3rem; font-weight:900; line-height:1; color:${redWin ? 'var(--text-white)' : 'var(--text-muted)'};">
                                ${matchPlayed ? redScore : '--'}
                            </div>
                        </div>

                        <div style="background: ${blueWin ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-black)'}; border: 1px solid ${blueWin ? 'var(--blue-alliance)' : 'var(--border-grey)'}; border-radius: 8px; padding: 20px; border-left: 6px solid var(--blue-alliance);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                                <span style="color:var(--blue-alliance); font-weight:900; font-size:1.1rem; letter-spacing:1px;">BLUE ALLIANCE</span>
                                ${blueWin ? '<span style="background:var(--blue-alliance); color:white; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; letter-spacing:1px;">WINNER</span>' : ''}
                            </div>
                            <div style="font-size:1.2rem; font-weight:bold; color:var(--text-white); margin-bottom: 15px;">
                                ${blueTeamsHTML}
                            </div>
                            <div style="font-size:3rem; font-weight:900; line-height:1; color:${blueWin ? 'var(--text-white)' : 'var(--text-muted)'};">
                                ${matchPlayed ? blueScore : '--'}
                            </div>
                        </div>
                    </div>
                `;

        const videoContainer = document.getElementById('video-frame-container');

        if (matchData.videos && matchData.videos.length > 0) {
            const vid = matchData.videos[0];
            if (vid.type === 'youtube') {
                videoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid.key}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            } else {
                videoContainer.innerHTML = `<div style="color:var(--text-muted); padding:20px; text-align:center;">Video format not supported (${vid.type}).</div>`;
            }
        } else {
            videoContainer.innerHTML = `<div style="color:var(--text-muted); padding:20px; text-align:center; font-weight:bold;">No video footage available for this match yet.</div>`;
        }

        document.getElementById('video-title').innerText = `MATCH: ${matchKey.split('_')[1].toUpperCase()}`;
        document.getElementById('video-modal').classList.add('show');

    } catch (err) {
        console.error(err);
        showToast("Failed to load video or match details.");
    }
}

export function closeMatchVideo() {
    document.getElementById('video-modal').classList.remove('show');
    document.getElementById('video-frame-container').innerHTML = '';
    document.getElementById('video-stats-container').innerHTML = '';
}

export async function loadLiveStream() {
    const platformSelect = document.getElementById('stream-platform-select');
    const idInput = document.getElementById('stream-id-input');
    const container = document.getElementById('stream-embed-container');

    let dropdownContainer = document.getElementById('stream-dropdown-container');
    if (!dropdownContainer) {
        dropdownContainer = document.createElement('div');
        dropdownContainer.id = 'stream-dropdown-container';
        dropdownContainer.style.marginBottom = '15px';
        container.parentNode.insertBefore(dropdownContainer, container);
    }
    dropdownContainer.innerHTML = '';

    let platform = platformSelect.value;
    let streamId = idInput.value.trim();

    if (!streamId) {
        showToast("Searching for active streams...");
        try {
            const { data: tbaKey } = await sbClient.from('api_keys').select('key_value').eq('name', 'tba').single();
            if (tbaKey) {
                const res = await apiFetchTBA(`https://www.thebluealliance.com/api/v3/event/${State.activeEventKey}`, tbaKey.key_value);
                if (res.ok) {
                    const eventData = await res.json();
                    const webcasts = eventData.webcasts || [];

                    const validCasts = webcasts.filter(w => w.type === 'youtube' || w.type === 'twitch');

                    if (validCasts.length > 0) {
                        const now = new Date();
                        const startDate = new Date(eventData.start_date);
                        const endDate = new Date(eventData.end_date);
                        endDate.setDate(endDate.getDate() + 1);

                        const isEventOver = now > endDate;
                        const isEventHappening = now >= startDate && now <= endDate;

                        let selectedCast = null;

                        if (isEventHappening) {
                            const todayString = now.toISOString().split('T')[0];
                            selectedCast = validCasts.find(w => w.date === todayString);
                            if (!selectedCast) {
                                selectedCast = validCasts[validCasts.length - 1];
                            }
                            showToast("Event is currently live. Loading current stream.");
                        } else if (isEventOver && validCasts.length > 1) {
                            showToast("Event has ended. Select a stream/day to watch.");

                            const selectHtml = document.createElement('select');
                            selectHtml.style.width = '100%';
                            selectHtml.style.padding = '10px';
                            selectHtml.style.background = 'var(--bg-black, #111)';
                            selectHtml.style.color = 'var(--text-white, #fff)';
                            selectHtml.style.border = '1px solid var(--border-grey, #333)';
                            selectHtml.style.borderRadius = '4px';

                            validCasts.forEach((cast, index) => {
                                const option = document.createElement('option');
                                option.value = index;
                                let label = `Stream ${index + 1} (${cast.type.toUpperCase()})`;
                                if (cast.date) {
                                    label += ` - Date: ${cast.date}`;
                                }
                                option.textContent = label;
                                selectHtml.appendChild(option);
                            });

                            selectHtml.addEventListener('change', (e) => {
                                const castIndex = parseInt(e.target.value);
                                const cast = validCasts[castIndex];
                                idInput.value = cast.channel || cast.file || '';
                                platformSelect.value = cast.type;

                                if (cast.type === 'twitch') {
                                    let sId = cast.channel || cast.file || '';
                                    container.innerHTML = `<iframe src="https://player.twitch.tv/?channel=${sId}&parent=${window.location.hostname}" frameborder="0" allowfullscreen="true" scrolling="no" height="100%" width="100%"></iframe>`;
                                } else if (cast.type === 'youtube') {
                                    let sId = cast.channel || cast.file || '';
                                    let videoId = sId;
                                    if (sId.includes('v=')) {
                                        videoId = sId.split('v=')[1].split('&')[0];
                                    } else if (sId.includes('youtu.be/')) {
                                        videoId = sId.split('youtu.be/')[1].split('?')[0];
                                    } else if (sId.includes('youtube.com/live/')) {
                                        videoId = sId.split('youtube.com/live/')[1].split('?')[0];
                                    }
                                    container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="true" height="100%" width="100%"></iframe>`;
                                }
                                showToast(`Loaded ${cast.type} stream`);
                            });

                            dropdownContainer.appendChild(selectHtml);
                            selectedCast = validCasts[0];
                        } else {
                            selectedCast = validCasts[0];
                        }

                        if (selectedCast) {
                            platform = selectedCast.type;
                            streamId = selectedCast.channel || selectedCast.file || '';
                            platformSelect.value = platform;
                            idInput.value = streamId;
                        }
                    } else {
                        showToast("No valid webcasts found for this event.");
                    }
                }
            }
        } catch (e) {
            console.warn("Auto-detect stream failed", e);
        }

        if (!streamId) return showToast("Please enter a stream ID, or ensure the event has a webcast on TBA.");
    }

    if (platform === 'twitch') {
        container.innerHTML = `<iframe src="https://player.twitch.tv/?channel=${streamId}&parent=${window.location.hostname}" frameborder="0" allowfullscreen="true" scrolling="no" height="100%" width="100%"></iframe>`;
    } else if (platform === 'youtube') {
        let videoId = streamId;
        if (streamId.includes('v=')) {
            videoId = streamId.split('v=')[1].split('&')[0];
        } else if (streamId.includes('youtu.be/')) {
            videoId = streamId.split('youtu.be/')[1].split('?')[0];
        } else if (streamId.includes('youtube.com/live/')) {
            videoId = streamId.split('youtube.com/live/')[1].split('?')[0];
        }

        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="true" height="100%" width="100%"></iframe>`;
    }
    showToast(`Loaded ${platform} stream`);
}
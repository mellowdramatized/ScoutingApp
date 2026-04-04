import { STRATEGIC_TAGS } from './config.js';
import { State } from './state.js';
import { launchDrillDownProfile } from './roster.js';

export function toggleCompareFilter(tagId) {
            if (State.activeCompareFilters.includes(tagId)) {
                State.activeCompareFilters = State.activeCompareFilters.filter(id => id !== tagId);
            } else {
                State.activeCompareFilters.push(tagId);
            }
            renderCompareSidebar();
        }

export function renderCompareSidebar() {
            const filterContainer = document.getElementById('compare-filters');
            filterContainer.innerHTML = STRATEGIC_TAGS.map(tag => {
                const isActive = State.activeCompareFilters.includes(tag.id);
                return `<div class="filter-pill ${isActive ? 'active' : ''}" 
                             style="color: ${isActive ? tag.color : 'var(--text-muted)'}; border-color: ${isActive ? tag.color : 'var(--border-grey)'};" 
                             onclick="toggleCompareFilter('${tag.id}')">
                            ${tag.label}
                        </div>`;
            }).join('');

            let filteredTeams = State.globalDataCache;
            if (State.activeCompareFilters.length > 0) {
                filteredTeams = State.globalDataCache.filter(team => {
                    return State.activeCompareFilters.every(filterId => team[filterId] === true || team[filterId] === "true");
                });
            }

            filteredTeams.sort((a, b) => parseFloat(b.statbotics_total_epa) - parseFloat(a.statbotics_total_epa));

            const listContainer = document.getElementById('compare-sidebar-list');
            if (filteredTeams.length === 0) {
                listContainer.innerHTML = `<div style="text-align:center; padding: 30px; color:var(--text-muted); font-weight:900;">No teams match these filters.</div>`;
                return;
            }

            listContainer.innerHTML = filteredTeams.map(t => {
                const isDNP = State.dnpList.includes(parseInt(t.team_number));
                const inlineStyle = isDNP ? "opacity: 0.3; pointer-events: none;" : "";
                const dnpBadge = isDNP ? `<span style="color:var(--danger-color); font-weight:bold; font-size:0.7rem; margin-left:5px;">[DNP]</span>` : "";
                return `
                <div class="draggable-team" draggable="true" ondragstart="drag(event)" data-team="${t.team_number}" style="display:flex; justify-content:space-between; align-items:center; padding: 12px 10px; border-bottom: 1px solid var(--border-grey); ${inlineStyle}">
                    <div style="cursor:pointer;" onclick="launchDrillDownProfile(${JSON.stringify(t).replace(/"/g, '&quot;')})">
                        <div style="font-weight:900; color:var(--primary-color); font-size:1.1rem; display:flex; align-items:center; gap:8px;"><span style="color:var(--border-light); font-size:1rem;">⠿</span> ${t.team_number}</div>
                        <div style="font-size:0.75rem; color:var(--text-white); font-weight:bold;">${t.team_nickname.substring(0, 15)}${dnpBadge}</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="compare-lr-btn" onclick="setCompareSlot('left', ${t.team_number})">[L]</button>
                        <button class="compare-lr-btn" onclick="setCompareSlot('right', ${t.team_number})">[R]</button>
                        <button class="compare-lr-btn" style="border-color:var(--success-color); color:var(--success-color);" onclick="addToPickList(1, ${t.team_number})">+</button>
                    </div>
                </div>
            `;
            }).join('');
        }

export function setCompareSlot(slot, teamNum) {
            const team = State.globalDataCache.find(t => parseInt(t.team_number) === parseInt(teamNum));
            if (!team) return;
            State.compareSlotData[slot] = team;
            renderCompareSlot(slot);
            checkAutonSynergy();
            updateRadarChart();
        }

export function renderCompareSlot(slot) {
            const team = State.compareSlotData[slot];
            const container = document.getElementById(`compare-slot-${slot}`);

            if (!team) {
                container.innerHTML = `<div style="flex:1; display:flex; justify-content:center; align-items:center; color:var(--text-muted); font-weight:900;">Select a team from the sidebar [${slot === 'left' ? 'L' : 'R'}]</div>`;
                return;
            }

            let pillsHTML = "";
            STRATEGIC_TAGS.forEach(tag => {
                if (team[tag.id] === true || team[tag.id] === "true") {
                    pillsHTML += `<span class="stat-badge" style="border:1px solid ${tag.color}; color:${tag.color};">${tag.label}</span>`;
                }
            });

            if (pillsHTML === "") pillsHTML = `<span style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">No strategic tags recorded.</span>`;

            let imgHTML = team.image_url
                ? `<img src="${team.image_url}" class="compare-img-header" alt="Robot Photo">`
                : `<div class="compare-img-header" style="display:flex; justify-content:center; align-items:center; color:var(--text-muted); font-weight:900;">NO PHOTO</div>`;

            let isTippableWarning = (team.vulnerabilities && team.vulnerabilities.toLowerCase().includes('tip')) ? `<div style="background:var(--danger-color); color:white; font-weight:900; text-align:center; padding:5px; font-size:0.75rem; letter-spacing:2px;">⚠️ TOP HEAVY / TIPPABLE</div>` : "";

            container.innerHTML = `
                ${isTippableWarning}
                ${imgHTML}
                <div style="padding: 20px; display:flex; flex-direction:column; gap:15px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <div>
                            <h2 style="margin:0; font-size:2.2rem; line-height:1; color:${slot === 'left' ? 'var(--primary-color)' : 'var(--blue-alliance)'}; cursor:pointer;" onclick="launchDrillDownProfile(${JSON.stringify(team).replace(/"/g, '&quot;')})">${team.team_number}</h2>
                            <div style="color:var(--text-white); font-weight:bold;">${team.team_nickname}</div>
                        </div>
                        <div style="text-align:right; font-size:0.8rem; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">Rank<br><span style="font-size:1.5rem; color:var(--text-white);">${team.rank}</span></div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div class="stat-box">
                            <div class="stat-box-title">Total EPA</div>
                            <div class="stat-box-val" style="color:var(--accent-color);">${team.statbotics_total_epa}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-box-title">Auto EPA</div>
                            <div class="stat-box-val">${team.statbotics_auto_epa}</div>
                        </div>
                    </div>

                    <div>
                        <h2 class="sub-title" style="font-size:0.85rem; margin-bottom:8px;">Strategic Tags</h2>
                        <div style="display:flex; flex-wrap:wrap; gap:8px;">
                            ${pillsHTML}
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:5px;">
                        <div style="background:var(--bg-black); padding:10px; border-radius:6px; border:1px solid var(--border-grey);">
                            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold;">Match Climb</div>
                            <div style="font-weight:900; color:var(--text-white);">${team.pit_climb}</div>
                        </div>
                        <div style="background:var(--bg-black); padding:10px; border-radius:6px; border:1px solid var(--border-grey);">
                            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold;">Driver Skill</div>
                            <div style="font-weight:900; color:var(--text-white);">${team.driver_skill > 0 ? team.driver_skill.toFixed(1) + ' / 5' : '-'}</div>
                        </div>
                    </div>
                </div>
            `;
        }

export function checkAutonSynergy() {
            const warningEl = document.getElementById('synergy-warning');
            const left = State.compareSlotData.left;
            const right = State.compareSlotData.right;

            if (!left || !right) {
                warningEl.style.display = 'none';
                return;
            }

            const L_Start = left.auton_start_pos || "Unknown";
            const R_Start = right.auton_start_pos || "Unknown";

            if ((L_Start === "Left Only" && R_Start === "Left Only") ||
                (L_Start === "Right Only" && R_Start === "Right Only") ||
                (L_Start === "Center Only" && R_Start === "Center Only")) {
                warningEl.innerText = `⚠️ SYNERGY WARNING: Both teams require the exact same Auton starting position (${L_Start}).`;
                warningEl.style.display = 'block';
            } else {
                warningEl.style.display = 'none';
            }
        }

export function getNormalizeValue(raw, max) {
            if (!raw || isNaN(raw)) return 0;
            return Math.min(100, Math.max(0, (parseFloat(raw) / max) * 100));
        }

export function updateRadarChart() {
            const ctx = document.getElementById('radarChart').getContext('2d');
            const isLight = document.body.classList.contains('light-mode');
            const gridColor = isLight ? '#cbd5e1' : '#444444';
            const fontColor = isLight ? '#64748b' : '#9e9e9e';

            const left = State.compareSlotData.left;
            const right = State.compareSlotData.right;

            if (!left && !right) return;

            if (State.radarChartInstance) {
                State.radarChartInstance.destroy();
            }

            let datasets = [];

            const maxTotal = 50, maxAuto = 20, maxTele = 30;

            const mapClimb = (str) => {
                if (str === "L3") return 100;
                if (str === "L2") return 66;
                if (str === "L1") return 33;
                return 0;
            };

            if (left) {
                datasets.push({
                    label: `Team ${left.team_number}`,
                    data: [
                        getNormalizeValue(left.statbotics_total_epa, maxTotal),
                        getNormalizeValue(left.statbotics_auto_epa, maxAuto),
                        getNormalizeValue(left.statbotics_total_epa - left.statbotics_auto_epa, maxTele),
                        mapClimb(left.pit_climb),
                        getNormalizeValue(left.driver_skill, 5)
                    ],
                    backgroundColor: 'rgba(230, 32, 32, 0.2)',
                    borderColor: '#e62020',
                    pointBackgroundColor: '#e62020',
                    borderWidth: 2
                });
            }

            if (right) {
                datasets.push({
                    label: `Team ${right.team_number}`,
                    data: [
                        getNormalizeValue(right.statbotics_total_epa, maxTotal),
                        getNormalizeValue(right.statbotics_auto_epa, maxAuto),
                        getNormalizeValue(right.statbotics_total_epa - right.statbotics_auto_epa, maxTele),
                        mapClimb(right.pit_climb),
                        getNormalizeValue(right.driver_skill, 5)
                    ],
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: '#3b82f6',
                    pointBackgroundColor: '#3b82f6',
                    borderWidth: 2
                });
            }

            State.radarChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['Total EPA', 'Auto EPA', 'Teleop EPA', 'Climb Power', 'Driver Skill'],
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            angleLines: { color: gridColor },
                            grid: { color: gridColor },
                            pointLabels: { color: fontColor, font: { size: 12, weight: 'bold' } },
                            ticks: { display: false, min: 0, max: 100, stepSize: 20 }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: fontColor, font: { size: 14, weight: 'bold' } } },
                        tooltip: { callbacks: { label: function (context) { return context.dataset.label; } } }
                    }
                }
            });
        }

export function allowDrop(ev) {
            ev.preventDefault();
            ev.currentTarget.classList.add('drag-over');
        }

export function dragLeave(ev) {
            ev.currentTarget.classList.remove('drag-over');
        }

export function drag(ev) {
            ev.dataTransfer.setData("text", ev.currentTarget.getAttribute('data-team'));
        }

export function drop(ev, tier) {
            ev.preventDefault();
            ev.currentTarget.classList.remove('drag-over');
            const teamNum = ev.dataTransfer.getData("text");
            addToPickList(tier, teamNum);
        }

export function addToPickList(tier, teamNum) {
            const team = parseInt(teamNum);

            State.pickLists[1] = State.pickLists[1].filter(t => t !== team);
            State.pickLists[2] = State.pickLists[2].filter(t => t !== team);

            if (!State.pickLists[tier].includes(team)) {
                State.pickLists[tier].push(team);
            }

            savePickListsToStorage();
            renderPickLists();
        }

export function removeFromPickList(tier, teamNum) {
            State.pickLists[tier] = State.pickLists[tier].filter(t => t !== parseInt(teamNum));
            savePickListsToStorage();
            renderPickLists();
        }

export function savePickListsToStorage() {
            localStorage.setItem(`wobot_picklists_${State.activeEventKey}`, JSON.stringify(State.pickLists));
        }

export function loadPickListsFromStorage() {
            const saved = localStorage.getItem(`wobot_picklists_${State.activeEventKey}`);
            if (saved) {
                State.pickLists = JSON.parse(saved);
                renderPickLists();
            }
        }

export function clearPicklists() {
            if (!confirm("Clear all draft boards?")) return;
            State.pickLists = { 1: [], 2: [] };
            savePickListsToStorage();
            renderPickLists();
        }

export function renderPickLists() {
            [1, 2].forEach(tier => {
                const container = document.getElementById(`pick-list-${tier}`);
                container.innerHTML = "";

                State.pickLists[tier].forEach((teamNum, index) => {
                    const teamData = State.globalDataCache.find(t => t.team_number == teamNum) || { team_nickname: "Unknown" };
                    container.innerHTML += `
                        <div class="pick-list-item">
                            <div style="display:flex; align-items:center; gap: 10px;">
                                <span style="color:var(--text-muted); font-size:0.8rem;">#${index + 1}</span>
                                <span style="color: ${tier === 1 ? 'var(--success-color)' : 'var(--accent-color)'};">${teamNum}</span> 
                                <span style="font-size:0.85rem;">${teamData.team_nickname.substring(0, 12)}</span>
                            </div>
                            <button onclick="removeFromPickList(${tier}, ${teamNum})" style="background:transparent; border:none; color:var(--danger-color); cursor:pointer; font-weight:bold;">&times;</button>
                        </div>
                    `;
                });

                if (State.pickLists[tier].length === 0) {
                    container.innerHTML = `<div style="text-align:center; color:var(--border-light); padding:20px; font-weight:bold;">Drop Teams Here</div>`;
                }
            });
        }

export function exportPicklists() {
            let csvContent = "data:text/csv;charset=utf-8,Tier,Pick_Order,Team_Number,Team_Name\r\n";

            [1, 2].forEach(tier => {
                State.pickLists[tier].forEach((teamNum, index) => {
                    const teamData = State.globalDataCache.find(t => t.team_number == teamNum) || { team_nickname: "Unknown" };
                    csvContent += `${tier},${index + 1},${teamNum},"${teamData.team_nickname.replace(/"/g, '""')}"\r\n`;
                });
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `WOBOT_Picklists_${State.activeEventKey}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
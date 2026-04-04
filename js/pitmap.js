import { State } from './state.js';

export function renderPitMap() {
    const container = document.getElementById('pit-map-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!State.currentPitMap || !State.currentPitMap.pits) {
        container.innerHTML = '<div style="color:var(--text-muted); font-weight:bold; padding:20px;">No pit map data available for this event.</div>';
        return;
    }
    
    const mapData = State.currentPitMap;
    const mapSize = mapData.size;
    
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.aspectRatio = `${mapSize.x} / ${mapSize.y}`;
    container.style.backgroundColor = 'var(--field-bg)';
    container.style.border = '2px solid var(--border-grey)';
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    
    if (mapData.areas) {
        Object.keys(mapData.areas).forEach(areaId => {
            const area = mapData.areas[areaId];
            const div = document.createElement('div');
            div.style.position = 'absolute';
            
            const leftPerc = ((area.position.x - (area.size.x / 2)) / mapSize.x) * 100;
            const topPerc = ((area.position.y - (area.size.y / 2)) / mapSize.y) * 100;
            const widthPerc = (area.size.x / mapSize.x) * 100;
            const heightPerc = (area.size.y / mapSize.y) * 100;
            
            div.style.left = `${leftPerc}%`;
            div.style.top = `${topPerc}%`;
            div.style.width = `${widthPerc}%`;
            div.style.height = `${heightPerc}%`;
            
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            div.style.border = '1px dashed var(--border-light)';
            div.style.color = 'var(--text-muted)';
            div.style.fontSize = '0.65rem';
            div.style.textAlign = 'center';
            div.style.padding = '2px';
            div.style.boxSizing = 'border-box';
            div.innerText = area.label || '';
            
            if (area.angle) {
                div.style.transform = `rotate(${area.angle}deg)`;
            }
            
            container.appendChild(div);
        });
    }

    Object.keys(mapData.pits).forEach(pitId => {
        const pit = mapData.pits[pitId];
        const teamNum = pit.team ? parseInt(pit.team) : null;
        
        let isScouted = false;
        if (teamNum) {
            isScouted = State.globalDataCache.some(d => d.team_number === teamNum && d.id);
        }
        
        const div = document.createElement('div');
        div.style.position = 'absolute';
        
        const leftPerc = ((pit.position.x - (pit.size.x / 2)) / mapSize.x) * 100;
        const topPerc = ((pit.position.y - (pit.size.y / 2)) / mapSize.y) * 100;
        const widthPerc = (pit.size.x / mapSize.x) * 100;
        const heightPerc = (pit.size.y / mapSize.y) * 100;
        
        div.style.left = `${leftPerc}%`;
        div.style.top = `${topPerc}%`;
        div.style.width = `${widthPerc}%`;
        div.style.height = `${heightPerc}%`;
        
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.border = '1px solid #000';
        div.style.boxSizing = 'border-box';
        
        div.style.fontWeight = 'bold';
        div.style.color = '#fff';
        div.style.fontSize = '0.75rem';
        
        if (teamNum) {
            div.style.backgroundColor = isScouted ? 'var(--success-color)' : 'var(--danger-color)';
            div.innerText = teamNum;
            div.style.cursor = 'pointer';
            div.onclick = () => {
                const teamData = State.globalDataCache.find(d => d.team_number === teamNum);
                if (teamData && teamData.id) window.launchDrillDownProfile(teamData);
                else window.launchScoutingSession(teamNum);
            };
        } else {
            div.style.backgroundColor = 'var(--bg-black)';
        }
        
        if (pit.angle) {
            div.style.transform = `rotate(${pit.angle}deg)`;
        }
        
        container.appendChild(div);
    });
}

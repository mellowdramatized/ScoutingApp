import os
import re

html_path = 'index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

script_start = content.find('<script>\n        // ==========================================================================')
script_end = content.find('</script>\n</body>')
js_content = content[script_start+9:script_end]

# State Variables
state_vars = [
    "statboticsCache", "wobotMatchData", "activeProfileTeam", "activeCompareFilters",
    "compareSlotData", "radarChartInstance", "pickLists", "isOnline", "currentUser",
    "currentUserRole", "globalDataCache", "activeEventKey", "mainTableInstance",
    "adminTableInstance", "matchTableInstance", "previousAssignmentCount", "syncProcesses",
    "returnViewOverride", "returnScrollPos", "currentScheduleMatches", "currentLiveMatch"
]

def apply_state(text):
    for var in state_vars:
        text = re.sub(r'(?<!\.)\b' + var + r'\b(?!\s*:)', f'State.{var}', text)
    return text

def apply_fetch(text):
    text = re.sub(r'fetch\(`https://api\.statbotics\.io/([^`]+)`\)', r'apiFetchStatbotics(`https://api.statbotics.io/\1`)', text)
    text = re.sub(
        r"fetch\((`https://www\.thebluealliance\.com[^`]+`),\s*\{\s*headers:\s*\{\s*'X-TBA-Auth-Key':\s*([^}]+?)\s*\}\s*\}\)",
        r"apiFetchTBA(\1, \2)", 
        text
    )
    return text

functions = {}
remaining = js_content

pattern = re.compile(r'\b(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(')
while True:
    match = pattern.search(remaining)
    if not match:
        break
    start = match.start()
    name = match.group(2)
    brace = remaining.find('{', start)
    if brace == -1:
        break
    count = 1
    end = brace + 1
    while count > 0 and end < len(remaining):
        if remaining[end] == '{': count += 1
        elif remaining[end] == '}': count -= 1
        end += 1
    functions[name] = remaining[start:end]
    remaining = remaining[:start] + remaining[end:]

func_groups = {
    'ui.js': ['applyTeamBranding', 'showToast', 'toggleTheme', 'togglePasswordVisibility', 'switchView', 'switchDetailTab'],
    'auth.js': ['setSyncState', 'updateConnectionUI', 'checkConnection', 'handleAuth', 'handleLogout', 'bootApplication', 'showAuthScreen', 'launchSecureSession'],
    'forms.js': ['getPitFormData', 'saveDraft', 'handleScoutSubmit', 'getMatchFormData', 'resetMatchForm', 'handleMatchScoutSubmit', 'compressImage', 'previewRobotImage', 'saveToOfflineQueue', 'dataURItoBlob', 'processPayloadUpload', 'uploadOfflineData', 'startDictation', 'resetDictationBtn'],
    'draft.js': ['toggleCompareFilter', 'renderCompareSidebar', 'setCompareSlot', 'renderCompareSlot', 'checkAutonSynergy', 'getNormalizeValue', 'updateRadarChart', 'allowDrop', 'dragLeave', 'drag', 'drop', 'addToPickList', 'removeFromPickList', 'savePickListsToStorage', 'loadPickListsFromStorage', 'clearPicklists', 'renderPickLists', 'exportPicklists'],
    'roster.js': ['renderMasterRoster', 'launchDrillDownProfile', 'triggerScheduleDrillDown', 'handleProfileReturn', 'exportMergedStatboticsData'],
    'schedule.js': ['predictAllianceScore', 'loadTeamSchedule', 'jumpToNextMatch', 'openMatchVideo', 'closeMatchVideo', 'loadLiveStream'],
    'admin.js': ['loadAdminTelemetry', 'wipeAssignments', 'autoAssign', 'manualAssign', 'populateManualDispatchDropdowns', 'loadUserAdminTable', 'assignAllToScouter', 'setGlobalEvent'],
    'app.js': ['refreshApplicationData', 'renderActiveAssignments', 'fetchStatboticsRoster', 'performBackgroundSync', 'fetchGlobalEventKey', 'initPermissionsUI', 'launchScoutingSession', 'loadCachesFromStorage']
}

config_match = re.search(r"if \(!localStorage\.getItem\('wobot_has_visited'\)\) \{.*?\n        \}", remaining, re.DOTALL)
config_visit = config_match.group(0) if config_match else ""

app_config_match = re.search(r"const APP_CONFIG = \{.*?\n        \};", remaining, re.DOTALL)
app_config = app_config_match.group(0) if app_config_match else ""

strat_tags_match = re.search(r"const STRATEGIC_TAGS = \[.*?\n        \];", remaining, re.DOTALL)
strat_tags = strat_tags_match.group(0) if strat_tags_match else ""

state_decls = re.search(r"// 1. STATE VARIABLES FIRST .*?\n(.*?)// 2. CONFIGURATION", remaining, re.DOTALL).group(1)

api_client_match = re.search(r"const sbClient = window\.supabase\.createClient\(.*?\n        \}\);", remaining, re.DOTALL)
api_client = api_client_match.group(0) if api_client_match else ""

exports = {
    'config.js': ['APP_CONFIG', 'STRATEGIC_TAGS'],
    'state.js': ['State'],
    'api.js': ['sbClient', 'apiFetchStatbotics', 'apiFetchTBA']
}
for f, funcs in func_groups.items():
    exports[f] = funcs

def build_imports(file_name, content):
    imports = []
    for f, exps in exports.items():
        if f == file_name: continue
        used = []
        for exp in exps:
            if re.search(r'\b' + exp + r'\b', content):
                used.append(exp)
        if used:
            imports.append(f"import {{ {', '.join(used)} }} from './{f}';")
    return "\n".join(imports) + "\n\n" if imports else ""

os.makedirs('js', exist_ok=True)

config_content = f"{config_visit}\n\nexport {app_config}\n\nexport {strat_tags}\n"
with open('js/config.js', 'w', encoding='utf-8') as f:
    f.write(config_content)

state_obj_lines = []
for line in state_decls.split('\n'):
    if line.strip().startswith('let '):
        line = line.strip()[4:].replace(';', ',')
        state_obj_lines.append("    " + line)
state_content = "export const State = {\n" + "\n".join(state_obj_lines) + "\n};\n"
with open('js/state.js', 'w', encoding='utf-8') as f:
    f.write(state_content)

api_content = f"""import {{ APP_CONFIG }} from './config.js';

export {api_client}

export async function apiFetchStatbotics(url) {{
    return fetch(url);
}}

export async function apiFetchTBA(url, tbaKey) {{
    return fetch(url, {{
        headers: {{ 'X-TBA-Auth-Key': tbaKey }}
    }});
}}
"""
with open('js/api.js', 'w', encoding='utf-8') as f:
    f.write(api_content)

for file_name, funcs in func_groups.items():
    content_parts = []
    for func in funcs:
        code = functions.get(func, "")
        code = apply_state(code)
        code = apply_fetch(code)
        content_parts.append(f"export {code}")
    
    raw_content = "\n\n".join(content_parts)
    
    if file_name == 'app.js':
        extra = []
        if 'applyTeamBranding();' in remaining: extra.append('applyTeamBranding();')
        if "if (localStorage.getItem('wobot_theme') === 'light') toggleTheme();" in remaining:
            extra.append("if (localStorage.getItem('wobot_theme') === 'light') toggleTheme();")
        if 'loadCachesFromStorage();' in remaining: extra.append('loadCachesFromStorage();')
        if 'setInterval(checkConnection, 7000);' in remaining: extra.append('setInterval(checkConnection, 7000);')
        if 'bootApplication();' in remaining: extra.append('bootApplication();')
        
        auth_change = re.search(r"sbClient\.auth\.onAuthStateChange.*?\}\);", remaining, re.DOTALL)
        if auth_change: extra.append(auth_change.group(0))
        
        bindings = []
        for fn in sum(func_groups.values(), []):
            bindings.append(f"window.{fn} = {fn};")
            
        raw_content += "\n\n" + "\n".join(extra) + "\n\n// Window Bindings\n" + "\n".join(bindings)
        raw_content = apply_state(raw_content)

    final_content = build_imports(file_name, raw_content) + raw_content
    with open(f'js/{file_name}', 'w', encoding='utf-8') as f:
        f.write(final_content)

new_html = content[:script_start] + '<script type="module" src="js/app.js"></script>\n</body>\n\n</html>\n'
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Extraction complete!")

if (!localStorage.getItem('wobot_has_visited')) {
            localStorage.setItem('wobot_has_visited', 'true');
            window.location.href = 'guide.html';
        }

export const APP_CONFIG = {
            teamNumber: "141",
            teamName: "WOBOT",
            appTitle: "Scouting Dashboard v8.0",
            supabaseUrl: 'https://gtmyuivkjtfxbswecrhz.supabase.co',
            supabaseAnonKey: 'sb_publishable_h6UZTcvyYUhJ6x4OeNwk8Q_ML3lPmRw',
            ownerEmailLock: "carmelokyles@gmail.com",
            defaultEventYear: "2026",
            teamSignupCode: "wobot2026"
        };

export const STRATEGIC_TAGS = [
            { id: 'tag_static_auton', label: 'Static Auton', color: 'var(--accent-color)' },
            { id: 'tag_center_half', label: 'Center Half', color: 'var(--blue-alliance)' },
            { id: 'tag_center_full', label: 'Center Full', color: 'var(--blue-alliance)' },
            { id: 'tag_defense_main', label: 'Primary Defense', color: 'var(--danger-color)' },
            { id: 'tag_feeder_human', label: 'Human Feeder', color: 'var(--success-color)' },
            { id: 'tag_feeder_floor', label: 'Solo Feeder', color: 'var(--success-color)' },
            { id: 'isKitbot', label: 'Kitbot Chassis', color: 'var(--text-muted)' }
        ];

export const RADIAL_MENU_CONFIG = {
    root: [
        { label: 'My Teams', icon: '📋', action: "window.switchView('view-tasks')" },
        { label: 'Pit Scout', icon: '🔍', action: "window.switchView('view-scout')" },
        { label: 'Post-Match', icon: '⏱️', action: "window.switchView('view-match-eval')" },
        { label: 'Master Roster', icon: '📊', action: "window.switchView('view-roster')" },
        { label: 'Draft Room', icon: '🏆', action: "window.switchView('view-compare')" },
        { label: 'Predictor', icon: '📅', action: "window.switchView('view-schedule')" },
        { label: 'Pit Map', icon: '🗺️', action: "window.switchView('view-pitmap')" },
        { label: 'Admin', icon: '⚙️', action: "window.switchView('view-admin')" }
    ],
    'view-roster': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Export Data', icon: '📥', action: "window.downloadRosterCSV()" },
        { label: 'Draft Room', icon: '🏆', action: "window.switchView('view-compare')" },
        { label: 'Jump to Wobot', icon: '🤖', action: "window.launchDrillDownProfile(State.globalDataCache.find(t => t.team_number === 141))" }
    ],
    'view-detail': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Back to Roster', icon: '📊', action: "window.handleProfileReturn()" },
        { label: 'Overview Tab', icon: '📋', action: "window.switchDetailTab('overview')" },
        { label: 'Matches Tab', icon: '⏱️', action: "window.switchDetailTab('matches')" }
    ],
    'view-scout': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Save Draft', icon: '💾', action: "window.saveDraft('pit')" },
        { label: 'Pit Map', icon: '🗺️', action: "window.switchView('view-pitmap')" }
    ],
    'view-match-eval': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Save Draft', icon: '💾', action: "window.saveDraft('match')" },
        { label: 'Dictate', icon: '🎤', action: "window.startDictation()" },
        { label: 'Predictor', icon: '📅', action: "window.switchView('view-schedule')" }
    ],
    'view-compare': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Clear Lists', icon: '🗑️', action: "window.clearPicklists()" },
        { label: 'Export Lists', icon: '📥', action: "window.exportPicklists()" },
        { label: 'Master Roster', icon: '📊', action: "window.switchView('view-roster')" }
    ],
    'view-schedule': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Jump Next', icon: '⏭️', action: "window.jumpToNextMatch()" },
        { label: 'Live Stream', icon: '📺', action: "window.switchView('view-stream')" }
    ],
    'view-stream': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Load Stream', icon: '📺', action: "window.loadLiveStream()" },
        { label: 'Predictor', icon: '📅', action: "window.switchView('view-schedule')" }
    ],
    'view-admin': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Auto Assign', icon: '🤖', action: "window.autoAssign()" },
        { label: 'Wipe Assigns', icon: '🗑️', action: "window.wipeAssignments()" },
        { label: 'Set Global Event', icon: '⚙️', action: "window.setGlobalEvent()" },
        { label: 'Export Merged CSV', icon: '📥', action: "window.exportMergedStatboticsData()" }
    ],
    'view-pitmap': [
        { label: 'Return to Dashboard', icon: '🏠', action: "window.switchView('view-tasks')" },
        { label: 'Pit Scout', icon: '🔍', action: "window.switchView('view-scout')" }
    ]
};

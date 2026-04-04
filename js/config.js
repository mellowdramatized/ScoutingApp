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

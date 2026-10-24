import { APP_CONFIG } from './config.js';

export const sbClient = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
    auth: {
        storageKey: 'wobot_clean_session',
        storage: window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});

// In-memory caches to prevent repeated 404/500 console spam during frequent refreshes
const nexusLayoutCache = new Map();
const unsupportedStatboticsEvents = new Set(
    JSON.parse(sessionStorage.getItem('wobot_statbotics_unsupported_events') || '[]')
);

export async function apiFetchStatbotics(url) {
    // Check if this is a team_events query for an offseason event that already threw HTTP 500
    const eventMatch = url.match(/[?&]event=([^&]+)/i);
    const eventKey = eventMatch ? decodeURIComponent(eventMatch[1]).toLowerCase() : null;

    if (eventKey && url.includes('/team_events') && unsupportedStatboticsEvents.has(eventKey)) {
        return new Response(
            JSON.stringify({ error: `Event ${eventKey} is not indexed in Statbotics team_events.` }),
            { status: 404, statusText: 'Not Indexed (Cached)' }
        );
    }

    try {
        const res = await fetch(url);
        if (!res.ok && eventKey && url.includes('/team_events')) {
            unsupportedStatboticsEvents.add(eventKey);
            sessionStorage.setItem(
                'wobot_statbotics_unsupported_events',
                JSON.stringify([...unsupportedStatboticsEvents])
            );
        }
        return res;
    } catch (err) {
        console.warn('[Statbotics API] Network error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

export async function apiFetchTBA(url, tbaKey) {
    // Pass X-TBA-Auth-Key as a query parameter to avoid CORS OPTIONS preflight issues
    const separator = url.includes('?') ? '&' : '?';
    const authedUrl = tbaKey
        ? `${url}${separator}X-TBA-Auth-Key=${encodeURIComponent(tbaKey)}`
        : url;

    return fetch(authedUrl);
}

export async function getNexusPitLayout(eventKey, forceRefresh = false) {
    if (!eventKey || eventKey === 'Pending...') return null;

    const normalizedKey = String(eventKey).trim().toLowerCase();

    // Return cached layout (or cached null for 404 events) to avoid hitting Nexus on every UI refresh
    if (!forceRefresh && nexusLayoutCache.has(normalizedKey)) {
        return nexusLayoutCache.get(normalizedKey);
    }

    const sessionMissingKey = `wobot_nexus_404_${normalizedKey}`;
    if (!forceRefresh && sessionStorage.getItem(sessionMissingKey) === '1') {
        nexusLayoutCache.set(normalizedKey, null);
        return null;
    }

    try {
        const { data: keyData } = await sbClient
            .from('api_keys')
            .select('key_value')
            .eq('name', 'nexus')
            .maybeSingle();

        if (!keyData || !keyData.key_value) {
            console.warn("Nexus API key missing in Supabase 'api_keys' table.");
            if (normalizedKey !== 'demo1234') {
                console.warn('Skipping Nexus fetch for real event due to missing API key.');
                nexusLayoutCache.set(normalizedKey, null);
                return null;
            }
        }

        const apiKey = keyData && keyData.key_value ? keyData.key_value : 'demo1234';

        const res = await fetch(`https://frc.nexus/api/v1/event/${encodeURIComponent(normalizedKey)}/map`, {
            headers: { 'Nexus-Api-Key': apiKey }
        });

        if (res.status === 404) {
            console.info(`[Nexus API] No vector pit map published for "${normalizedKey}" (404). Using fallback pit grid.`);
            sessionStorage.setItem(sessionMissingKey, '1');
            nexusLayoutCache.set(normalizedKey, null);
            return null;
        }

        if (!res.ok) {
            if (res.status === 403) console.error('Nexus API Forbidden: Invalid API Key.');
            nexusLayoutCache.set(normalizedKey, null);
            return null;
        }

        const mapData = await res.json();
        nexusLayoutCache.set(normalizedKey, mapData);
        return mapData;
    } catch (err) {
        nexusLayoutCache.set(normalizedKey, null);
        return null;
    }
}

let activeSessionId = null;
let heartbeatInterval = null;

export async function startTelemetrySession(userId, userName) {
    activeSessionId = crypto.randomUUID();

    const { error } = await sbClient.from('user_sessions').insert({
        session_id: activeSessionId,
        user_id: userId,
        user_name: userName,
        current_view: 'Dashboard',
        status: 'online'
    });

    if (!error) {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(async () => {
            if (activeSessionId) {
                await sbClient.from('user_sessions').update({
                    last_heartbeat: new Date().toISOString()
                }).eq('session_id', activeSessionId);
            }
        }, 120000);

        window.addEventListener('beforeunload', () => {
            if (activeSessionId) {
                const url = `${APP_CONFIG.supabaseUrl}/rest/v1/user_sessions?session_id=eq.${activeSessionId}&apikey=${APP_CONFIG.supabaseAnonKey}`;
                const blob = new Blob([JSON.stringify({ status: 'offline' })], { type: 'application/json' });
                navigator.sendBeacon(url, blob);
            }
        });
    }
}

export async function updateTelemetryView(viewName) {
    if (!activeSessionId) return;
    await sbClient.from('user_sessions').update({
        current_view: viewName,
        last_heartbeat: new Date().toISOString()
    }).eq('session_id', activeSessionId);
}
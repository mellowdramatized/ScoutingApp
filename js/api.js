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

export async function apiFetchStatbotics(url) {
    return fetch(url);
}

export async function apiFetchTBA(url, tbaKey) {
    return fetch(url, {
        headers: { 'X-TBA-Auth-Key': tbaKey }
    });
}

export async function getNexusPitLayout(eventKey) {
    try {
        const { data: keyData, error } = await sbClient.from('api_keys').select('key_value').eq('name', 'nexus').maybeSingle();
        
        if (!keyData || !keyData.key_value) {
            console.warn("Nexus API key missing in Supabase 'api_keys' table.");
            if (eventKey !== 'demo1234') {
                console.warn("Skipping Nexus fetch for real event due to missing API key.");
                return null; // Return null to avoid 403 Forbidden
            }
        }

        const apiKey = keyData ? keyData.key_value : 'demo1234';

        const res = await fetch(`https://frc.nexus/api/v1/event/${eventKey}/map`, {
            headers: { 'Nexus-Api-Key': apiKey }
        });
        
        if (!res.ok) {
            if (res.status === 403) console.error("Nexus API Forbidden: Invalid API Key.");
            throw new Error('Nexus Pit Layout fetch failed');
        }
        return await res.json();
    } catch (err) {
        return null;
    }
}

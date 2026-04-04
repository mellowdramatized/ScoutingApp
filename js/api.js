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

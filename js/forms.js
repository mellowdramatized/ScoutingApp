import { State } from './state.js';
import { sbClient } from './api.js';
import { showToast, switchView } from './ui.js';
import { setSyncState, checkConnection } from './auth.js';
import { refreshApplicationData } from './app.js';

export function getPitFormData() {
            return {
                payload_type: 'pit',
                team_number: document.getElementById('f-team').value,
                event_key: State.activeEventKey,
                team_nickname: document.getElementById('f-nickname').value,
                team_name: document.getElementById('f-teamname').value,
                scouter_initials: document.getElementById('f-initials').value,

                tag_static_auton: document.getElementById('tag-static-auton').checked,
                tag_center_half: document.getElementById('tag-center-half').checked,
                tag_center_full: document.getElementById('tag-center-full').checked,
                tag_feeder_human: document.getElementById('tag-feeder-human').checked,
                tag_feeder_floor: document.getElementById('tag-feeder-floor').checked,
                isKitbot: document.getElementById('m-is-Kitbot').checked,

                drivetrain: document.getElementById('f-drive').value,
                drive_motor: document.getElementById('f-motor').value,
                terrain_nav: document.getElementById('f-terrain').value,
                intake_loc: document.getElementById('f-intake').value,
                fuel_capacity: document.getElementById('f-capacity').value || 0,
                fuelaccuracy: document.getElementById('f-fuel-accuracy').value,
                fuel_range: document.getElementById('f-fuel_range').value,
                scoring_method: document.getElementById('f-scoring').value,
                auton_start_pos: document.getElementById('f-auton-start-pos').value,
                auton_fuel: document.getElementById('f-auton-fuel').value || 0,

                auton_climb: document.getElementById('f-auton-climb') ? document.getElementById('f-auton-climb').value : 'No',

                max_climb: document.getElementById('f-max-climb').value,
                climb_speed: document.getElementById('f-climb-speed').value,
                proud_features: document.getElementById('f-proud').value,
                strategic_pitch: document.getElementById('f-pitch').value,
                vulnerabilities: document.getElementById('f-vulnerabilities').value,
                isKitbot: document.getElementById('m-is-Kitbot').checked,
                fuelaccuracy: document.getElementById('f-fuel-accuracy').value,
                scouter_name: State.currentUser,
                created_at: new Date().toISOString(),
                image_base64: document.getElementById('f-photo-base64').value
            };
        }

export function saveDraft(type) {
            if (type === 'pit') {
                const draftData = getPitFormData();
                draftData.is_draft = true;
                saveToOfflineQueue(draftData);
                showToast("Pit Draft saved locally.");
            } else if (type === 'match') {
                const draftData = getMatchFormData();
                saveToOfflineQueue(draftData);
                showToast("Evaluation Draft saved locally.");
                resetMatchForm();
                switchView('view-tasks');
            }
        }

export async function handleScoutSubmit(event) {
            event.preventDefault();
            const submitBtn = document.getElementById('sub-btn');
            const payload = getPitFormData();

            if (!State.isOnline) {
                saveToOfflineQueue(payload);
                showToast("Report saved to device memory.");
                event.target.reset();
                document.getElementById('f-photo-base64').value = "";
                switchView('view-tasks');
                return;
            }

            submitBtn.innerText = "SUBMITTING...";
            submitBtn.disabled = true;
            setSyncState(true);

            try {
                await processPayloadUpload(payload);
                showToast("Report submitted successfully.");
            } catch (err) {
                showToast(`Submission error: ${err.message}`);
                saveToOfflineQueue(payload);
            } finally {
                setSyncState(false);
                submitBtn.innerText = "SUBMIT PIT REPORT";
                submitBtn.disabled = false;
                event.target.reset();
                document.getElementById('f-photo-base64').value = "";
                document.getElementById('robot-photo-preview').classList.add('hidden');
                document.getElementById('img-placeholder').classList.remove('hidden');
                refreshApplicationData();
                switchView('view-tasks');
            }
        }

export function getMatchFormData() {
            let prefix = "";
            if (document.getElementById('m-played-defense').checked) prefix += "[PLAYED DEFENSE] ";
            if (document.getElementById('m-was-defended').checked) prefix += "[WAS DEFENDED] ";
            let rawNotes = document.getElementById('m-notes').value;
            let finalNotes = prefix + rawNotes;

            return {
                payload_type: 'match',
                event_key: State.activeEventKey,
                match_number: document.getElementById('m-match').value.trim(),
                team_number: document.getElementById('m-team').value,
                scouter_name: State.currentUser,
                auto_fuel: 0,
                teleop_fuel: 0,
                endgame_climb: 'None',
                driver_skill: parseInt(document.getElementById('m-driver-skill').value) || 3,
                broke_down: document.getElementById('m-broke-down').checked,
                notes: finalNotes,
                created_at: new Date().toISOString()
            };
        }

export function resetMatchForm() {
            document.getElementById('m-match').value = "";
            document.getElementById('m-team').value = "";
            document.getElementById('m-driver-skill').value = "3";
            document.getElementById('m-broke-down').checked = false;
            document.getElementById('m-played-defense').checked = false;
            document.getElementById('m-was-defended').checked = false;
            document.getElementById('m-notes').value = "";
        }

export async function handleMatchScoutSubmit() {
            const submitBtn = document.getElementById('sub-match-btn');
            const payload = getMatchFormData();

            if (!payload.match_number || !payload.team_number) return showToast("Match Number and Team Number are required.");

            if (!State.isOnline) {
                saveToOfflineQueue(payload);
                showToast("Evaluation saved to device memory.");
                resetMatchForm();
                switchView('view-tasks');
                return;
            }

            submitBtn.innerText = "SUBMITTING...";
            submitBtn.disabled = true;
            setSyncState(true);

            try {
                await processPayloadUpload(payload);
                showToast("Evaluation submitted successfully.");
            } catch (err) {
                showToast(`Submission error: ${err.message}`);
                saveToOfflineQueue(payload);
            } finally {
                setSyncState(false);
                submitBtn.innerText = "SUBMIT EVALUATION";
                submitBtn.disabled = false;
                resetMatchForm();
                refreshApplicationData();
                switchView('view-tasks');
            }
        }

export function compressImage(file, callback) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.getElementById('compression-canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    callback(dataUrl);
                }
                img.src = event.target.result;
            }
            reader.readAsDataURL(file);
        }

export function previewRobotImage(input) {
            if (input.files && input.files[0]) {
                compressImage(input.files[0], (base64) => {
                    const preview = document.getElementById('robot-photo-preview');
                    preview.src = base64;
                    preview.classList.remove('hidden');
                    document.getElementById('img-placeholder').classList.add('hidden');
                    document.getElementById('f-photo-base64').value = base64;
                    showToast("Photo Uploaded!")

                });
            }
        }

export function saveToOfflineQueue(data) {
            let queue = JSON.parse(localStorage.getItem('wobot_offline_queue') || '[]');
            queue.push(data);
            localStorage.setItem('wobot_offline_queue', JSON.stringify(queue));
            checkConnection();
        }

export function dataURItoBlob(dataURI) {
            var byteString = atob(dataURI.split(',')[1]);
            var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            var ab = new ArrayBuffer(byteString.length);
            var ia = new Uint8Array(ab);
            for (var i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
            return new Blob([ab], { type: mimeString });
        }

export async function processPayloadUpload(payload) {
            let table = payload.payload_type === 'match' ? 'match_scouting' : 'pit_scouting';
            let dataToInsert = { ...payload };
            delete dataToInsert.payload_type;

            if (dataToInsert.image_base64) {
                const blob = dataURItoBlob(dataToInsert.image_base64);
                const storagePath = `robot-photos/frc${dataToInsert.team_number}_${dataToInsert.event_key}_${Date.now()}.jpg`;
                const { error: uploadError } = await sbClient.storage.from('scouting-data').upload(storagePath, blob, { contentType: 'image/jpeg' });
                if (!uploadError) dataToInsert.image_url = sbClient.storage.from('scouting-data').getPublicUrl(storagePath).data.publicUrl;
                delete dataToInsert.image_base64;
            }

            const { error: dbError } = await sbClient.from(table).insert([dataToInsert]);
            if (dbError) throw dbError;

            if (table === 'pit_scouting') {
                await sbClient.from('scout_assignments').update({ completed: true }).eq('scouter_email', dataToInsert.scouter_name).eq('team_number', dataToInsert.team_number).eq('event_key', dataToInsert.event_key);
            }
        }

export async function uploadOfflineData() {
            if (!State.isOnline) return showToast("Waiting for internet connection.");
            let queue = JSON.parse(localStorage.getItem('wobot_offline_queue') || '[]');
            if (queue.length === 0) return showToast("No offline data to upload.");

            setSyncState(true);
            try {
                for (let i = 0; i < queue.length; i++) {
                    await processPayloadUpload(queue[i]);
                }
                localStorage.removeItem('wobot_offline_queue');
                showToast("Upload successful.");
                await refreshApplicationData();
                checkConnection();
            } catch (err) {
                showToast(`Upload error: ${err.message}`);
            } finally {
                setSyncState(false);
            }
        }

export function startDictation() {
            if (!('webkitSpeechRecognition' in window)) {
                return showToast("Speech recognition is not supported in this browser. Try Chrome or Safari.");
            }

            const btn = document.getElementById('dictate-btn');
            if (btn.innerText.includes("Listening")) return;

            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.start();
            btn.innerText = "🔴 Listening...";
            btn.style.color = "var(--primary-color)";

            recognition.onresult = function (e) {
                const noteBox = document.getElementById('m-notes');
                const transcript = e.results[0][0].transcript;
                noteBox.value += (noteBox.value ? " " : "") + transcript;
                resetDictationBtn(btn);
            };

            recognition.onerror = function (e) {
                resetDictationBtn(btn);
                showToast("Dictation error or microphone blocked.");
            }

            recognition.onend = function () {
                resetDictationBtn(btn);
            }
        }

export function resetDictationBtn(btn) {
            btn.innerText = "🎤 Dictate Notes";
            btn.style.color = "var(--text-white)";
        }
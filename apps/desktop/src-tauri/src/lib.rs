use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};
use tauri::{Emitter, Manager};
use lazy_static::lazy_static;
use regex::Regex;
// use tauri_plugin_window_state::{StateFlags, Builder as WindowStateBuilder};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Response from get_log_metadata command
#[derive(serde::Serialize)]
pub struct LogMetadata {
    line_count: usize,
    player_name: Option<String>,
}

/// Response from read_log_update command - single-pass file reading
#[derive(serde::Serialize)]
pub struct LogUpdate {
    line_count: usize,
    player_name: Option<String>,
    new_lines: Vec<String>,
    patterns: Vec<RawLogPattern>,
}

/// Raw log pattern extracted from a log line for schema discovery
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawLogPattern {
    pub event_name: Option<String>,
    pub severity: Option<String>,
    pub teams: Vec<String>,
    pub subsystems: Vec<String>,
    pub signature: String,
    pub example_line: String,
}

// Regex patterns for log pattern extraction (compiled once, reused)
lazy_static! {
    static ref TIMESTAMP_RE: Regex = Regex::new(r"^<\d{4}-\d{2}-\d{2}T[\d:.]+Z>\s*").unwrap();
    static ref SEVERITY_RE: Regex = Regex::new(r"\[(Notice|Error|Trace|Warning)\]").unwrap();
    static ref EVENT_NAME_RE: Regex = Regex::new(r"<([A-Za-z_:][A-Za-z0-9_:]*(?:::[A-Za-z0-9_<>]+)*)>").unwrap();
    static ref TEAM_TAG_RE: Regex = Regex::new(r"\[Team_([A-Za-z]+)\]").unwrap();
    static ref SUBSYSTEM_TAG_RE: Regex = Regex::new(r"\[([A-Za-z][A-Za-z0-9_]*)\]").unwrap();
}

const SEVERITY_TAGS: &[&str] = &["Notice", "Error", "Trace", "Warning"];

/// Generate a stable signature for pattern deduplication
fn generate_signature(
    event_name: &Option<String>,
    severity: &Option<String>,
    teams: &[String],
    subsystems: &[String],
) -> String {
    let mut sorted_teams = teams.to_vec();
    sorted_teams.sort();
    let mut sorted_subsystems = subsystems.to_vec();
    sorted_subsystems.sort();

    format!(
        "{}|{}|{}|{}",
        event_name.as_deref().unwrap_or("null"),
        severity.as_deref().unwrap_or("null"),
        sorted_teams.join(","),
        sorted_subsystems.join(",")
    )
}

/// Extract pattern metadata from a log line
fn extract_log_pattern(line: &str) -> Option<RawLogPattern> {
    // Skip lines that don't start with timestamp
    if !line.starts_with('<') || !TIMESTAMP_RE.is_match(line) {
        return None;
    }

    // Remove timestamp for parsing
    let content = TIMESTAMP_RE.replace(line, "");

    // Extract severity
    let severity = SEVERITY_RE.captures(&content)
        .map(|c| c.get(1).unwrap().as_str().to_string());

    // Extract event name (skip timestamp-like patterns)
    let event_name = EVENT_NAME_RE.captures(&content)
        .and_then(|c| {
            let name = c.get(1).unwrap().as_str();
            if !name.starts_with("20") { // Skip dates like 2025-...
                Some(name.to_string())
            } else {
                None
            }
        });

    // Extract team tags
    let teams: Vec<String> = TEAM_TAG_RE.captures_iter(&content)
        .map(|c| format!("Team_{}", c.get(1).unwrap().as_str()))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    // Extract subsystem tags (excluding severity tags)
    let subsystems: Vec<String> = SUBSYSTEM_TAG_RE.captures_iter(&content)
        .map(|c| c.get(1).unwrap().as_str().to_string())
        .filter(|tag| !SEVERITY_TAGS.contains(&tag.as_str()) && !tag.starts_with("Team_"))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    // Generate signature
    let signature = generate_signature(&event_name, &severity, &teams, &subsystems);

    Some(RawLogPattern {
        event_name,
        severity,
        teams,
        subsystems,
        signature,
        example_line: line.to_string(),
    })
}

/// Event markers for pre-filtering log lines before sending to JavaScript.
///
/// This is a critical performance optimization that reduces IPC overhead by ~95%.
/// Only lines containing these markers are sent to JavaScript for full parsing.
///
/// Categories:
/// - Connection: Player login/logout events
/// - Inventory: Equipment and item management
/// - Vehicle: Ship control, destruction, quantum travel
/// - Combat: Deaths, collisions, damage
/// - Missions: Objectives and mission state
/// - Economy: Shopping and wallet transactions
/// - Locations: Landing areas, docking, spawning
/// - System: Error states and quit events
///
/// Performance: 20k lines → ~500 filtered lines (95% reduction)
const EVENT_MARKERS: &[&str] = &[
    // Connection events
    "AccountLoginCharacterStatus_Character",  // Player login with character name

    // Inventory events
    "<RequestLocationInventory>",             // Opened inventory at location
    "<EquipItem>",                            // Item equipped
    "<AttachmentReceived>",                   // Attachment added to item

    // Vehicle events
    "<Vehicle Control Flow>",                 // Entered/exited ship
    "<[ActorState] Place>",                   // Placed in vehicle seat
    "<Quantum Drive Arrived",                 // QT jump completed
    "<Jump Drive Requesting State Change>",   // Jump drive state change
    "Destruction>",                           // Vehicle/structure destroyed (partial match)

    // Combat events
    "<Actor Death>",                          // Player/NPC killed
    "<[ActorState] Dead>",                    // Death state change
    "<FatalCollision>",                       // Collision death
    "<[STAMINA]",                             // Stamina changes (combat related)

    // Mission events
    "<MissionShared>",                        // Mission shared with party
    "<ObjectiveUpserted>",                    // Objective added/updated
    "<MissionEnded>",                         // Mission completed
    "<EndMission>",                           // Mission ended
    "<CLocalMissionPhaseMarker::CreateMarker>", // Bounty target spawned (SC 4.4.x+)

    // Economy events
    "<CEntityComponentShoppingProvider::SendStandardItemBuyRequest>",  // Item purchased
    "<CWallet::ProcessClaimToNextStep>",      // Payment processed

    // Location events
    "<CLandingArea::OnDoorOpenStateChanged>", // Landing pad door opened
    "<CSCItemDockingTube::OnSetTubeState>",   // Docking tube state
    "<CSCLoadingPlatformManager>",            // Loading platform event
    "<Spawn Flow>",                           // Player spawn event
    "<CEntity::OnOwnerRemoved>",              // Entity ownership removed

    // System events
    "<SystemQuit>",                           // Game quit
    "<Failed to get starmap route data!>",    // Starmap error
];

/// Check if a line contains any event marker
fn contains_event_marker(line: &str) -> bool {
    EVENT_MARKERS.iter().any(|marker| line.contains(marker))
}

/// Read log file in a single pass - returns line count, player name (optional), filtered new lines, and patterns
/// Only returns lines that contain event markers (95% reduction in data sent to JavaScript)
#[tauri::command]
fn read_log_update(
    path: &str,
    from_line: usize,
    extract_player_name: bool,
    extract_patterns: bool,
) -> Result<LogUpdate, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut line_count = 0;
    let mut player_name: Option<String> = None;
    let mut new_lines = Vec::new();
    let mut lines_scanned = 0usize;

    // Pattern extraction state
    let mut patterns: Vec<RawLogPattern> = Vec::new();
    let mut seen_signatures: HashSet<String> = HashSet::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;

        // Extract player name if requested (keep updating for most recent)
        if extract_player_name && line.contains("AccountLoginCharacterStatus_Character") {
            if let Some(start) = line.find("name ") {
                let name_start = start + 5;
                if let Some(end) = line[name_start..].find(" - ") {
                    player_name = Some(line[name_start..name_start + end].to_string());
                }
            }
        }

        // Collect only lines that contain event markers (pre-filter for JavaScript)
        if line_count >= from_line {
            lines_scanned += 1;

            // Extract pattern if enabled (dedupe by signature within this file read)
            if extract_patterns {
                if let Some(pattern) = extract_log_pattern(&line) {
                    if !seen_signatures.contains(&pattern.signature) {
                        seen_signatures.insert(pattern.signature.clone());
                        patterns.push(pattern);
                    }
                }
            }

            if contains_event_marker(&line) {
                new_lines.push(line);
            }
        }

        line_count += 1;
    }

    // Debug telemetry (only in debug builds)
    #[cfg(debug_assertions)]
    if lines_scanned > 0 {
        let filtered_ratio = if lines_scanned > 0 {
            ((lines_scanned - new_lines.len()) as f64 / lines_scanned as f64 * 100.0) as u32
        } else {
            0
        };
        println!(
            "[Rust] read_log_update: scanned {} lines, {} matched markers ({}% filtered out), {} unique patterns",
            lines_scanned,
            new_lines.len(),
            filtered_ratio,
            patterns.len()
        );
    }

    // Warn if no markers matched in a large file (potential marker coverage issue)
    #[cfg(debug_assertions)]
    if lines_scanned > 1000 && new_lines.is_empty() {
        eprintln!(
            "[Rust] Warning: No event markers matched in {} lines. \
             Check if EVENT_MARKERS are up-to-date with Star Citizen log format.",
            lines_scanned
        );
    }

    // Warn if player name extraction was requested but failed
    #[cfg(debug_assertions)]
    if extract_player_name && player_name.is_none() && line_count > 100 {
        eprintln!(
            "[Rust] Warning: Could not extract player name from {} lines. \
             Check if AccountLoginCharacterStatus_Character format has changed.",
            line_count
        );
    }

    Ok(LogUpdate {
        line_count,
        player_name,
        new_lines,
        patterns,
    })
}

/// Get log file metadata (line count and player name) in a single pass
/// Uses BufReader for memory-efficient streaming
#[tauri::command]
fn get_log_metadata(path: &str) -> Result<LogMetadata, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut line_count = 0;
    let mut player_name: Option<String> = None;

    // Read through file once, counting lines and finding player name
    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
        line_count += 1;

        // Look for player name in AccountLoginCharacterStatus_Character events
        // Keep updating to get the MOST RECENT login (handles multiple sessions)
        if line.contains("AccountLoginCharacterStatus_Character") {
            // Extract name until " - " delimiter to support hyphenated names
            if let Some(start) = line.find("name ") {
                let name_start = start + 5;
                if let Some(end) = line[name_start..].find(" - ") {
                    player_name = Some(line[name_start..name_start + end].to_string());
                }
            }
        }
    }

    Ok(LogMetadata {
        line_count,
        player_name,
    })
}

/// Read new lines from a file starting at a specific line position
/// Uses BufReader for memory-efficient streaming
#[tauri::command]
fn read_log_lines_from(path: &str, from_line: usize) -> Result<Vec<String>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut new_lines = Vec::new();
    let mut current_line = 0;

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;

        if current_line >= from_line {
            // Only include non-empty lines
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                new_lines.push(line);
            }
        }

        current_line += 1;
    }

    Ok(new_lines)
}

/// Get line count only (fast path when player name not needed)
#[tauri::command]
fn get_line_count(path: &str) -> Result<usize, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    Ok(reader.lines().count())
}

/// Check if running a debug build (for E2E test detection)
/// This command is available in both debug and release builds,
/// but returns different values based on the build type.
#[tauri::command]
fn is_debug_build() -> bool {
    cfg!(debug_assertions)
}

#[tauri::command]
fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    println!("[Rust] close_splashscreen command called");

    // Close splash window
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().map_err(|e| {
            eprintln!("[Rust] Failed to close splash window: {}", e);
            e.to_string()
        })?;
        println!("[Rust] Splash window closed");
    } else {
        println!("[Rust] Warning: Splash window not found");
    }

    // Navigate main window to "/" and show it
    if let Some(main) = app.get_webview_window("main") {
        // Navigate from /waiting to / (this triggers auth check and app initialization)
        println!("[Rust] Navigating main window to /");
        main.eval("window.location.href = '/'").map_err(|e| {
            eprintln!("[Rust] Failed to navigate main window: {}", e);
            e.to_string()
        })?;

        // Show main window immediately - page will handle loading state
        main.show().map_err(|e| {
            eprintln!("[Rust] Failed to show main window: {}", e);
            e.to_string()
        })?;
        println!("[Rust] Main window shown");

        // Emit event to notify frontend that splash has closed
        app.emit("splash-closed", ()).map_err(|e| {
            eprintln!("[Rust] Failed to emit splash-closed event: {}", e);
            e.to_string()
        })?;
        println!("[Rust] splash-closed event emitted");
    } else {
        eprintln!("[Rust] Error: Main window not found!");
        return Err("Main window not found".to_string());
    }

    Ok(())
}

// ============================================================================
// Test Commands (Debug Builds Only)
// These commands are ONLY compiled in debug builds and do NOT exist in release.
// Used for E2E testing to bypass OAuth, inject state, etc.
// ============================================================================

/// Inject authentication state directly (bypasses OAuth flow)
/// Only available in debug builds for E2E testing
#[cfg(debug_assertions)]
#[tauri::command]
fn test_inject_auth(jwt: String, user_json: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    println!("[Test] Injecting auth state");

    let store = app.store("auth.json").map_err(|e| e.to_string())?;

    // Parse user JSON to validate it
    let user: serde_json::Value = serde_json::from_str(&user_json)
        .map_err(|e| format!("Invalid user JSON: {}", e))?;

    // Store JWT and user
    store.set("jwt", serde_json::json!(jwt));
    store.set("user", user);
    store.save().map_err(|e| e.to_string())?;

    // Emit event to notify frontend
    app.emit("test-auth-injected", ()).map_err(|e| e.to_string())?;

    println!("[Test] Auth state injected successfully");
    Ok(())
}

/// Select a log file programmatically (bypasses file picker)
/// Only available in debug builds for E2E testing
#[cfg(debug_assertions)]
#[tauri::command]
fn test_select_log_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    println!("[Test] Selecting log file: {}", path);

    // Verify file exists
    if !std::path::Path::new(&path).exists() {
        return Err(format!("Test log file not found: {}", path));
    }

    // Emit event to frontend to trigger log watching
    app.emit("test-log-selected", &path).map_err(|e| e.to_string())?;

    println!("[Test] Log file selection event emitted");
    Ok(())
}

/// Clear all stored state (for test isolation)
/// Only available in debug builds for E2E testing
#[cfg(debug_assertions)]
#[tauri::command]
fn test_clear_state(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    println!("[Test] Clearing all stored state");

    let store_names = ["auth.json", "logs.json", "settings.json"];

    for store_name in store_names {
        if let Ok(store) = app.store(store_name) {
            store.clear();
            let _ = store.save();
            println!("[Test] Cleared store: {}", store_name);
        }
    }

    // Emit event to notify frontend
    app.emit("test-state-cleared", ()).map_err(|e| e.to_string())?;

    println!("[Test] All state cleared");
    Ok(())
}

/// Get store contents for test assertions
/// Only available in debug builds for E2E testing
#[cfg(debug_assertions)]
#[tauri::command]
fn test_get_store_contents(store_name: String, app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store(&store_name).map_err(|e| e.to_string())?;

    let mut contents = serde_json::Map::new();
    for (key, value) in store.entries() {
        contents.insert(key.clone(), value.clone());
    }

    serde_json::to_string(&contents).map_err(|e| e.to_string())
}

/// Set a specific store value for testing
/// Only available in debug builds for E2E testing
#[cfg(debug_assertions)]
#[tauri::command]
fn test_set_store_value(
    store_name: String,
    key: String,
    value_json: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store(&store_name).map_err(|e| e.to_string())?;

    let value: serde_json::Value = serde_json::from_str(&value_json)
        .map_err(|e| format!("Invalid JSON value: {}", e))?;

    store.set(&key, value);
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

/// Append a line to a log file (for testing file watching)
/// Only available in debug builds for E2E testing
#[cfg(debug_assertions)]
#[tauri::command]
fn test_append_log_line(path: String, line: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let mut file = OpenOptions::new()
        .append(true)
        .create(true)
        .open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    writeln!(file, "{}", line)
        .map_err(|e| format!("Failed to write line: {}", e))?;

    println!("[Test] Appended line to log file: {}", path);
    Ok(())
}

/// Create a test log file with sample content
/// Only available in debug builds for E2E testing
#[cfg(debug_assertions)]
#[tauri::command]
fn test_create_log_file(path: String, content: String) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;

    let mut file = File::create(&path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write content: {}", e))?;

    println!("[Test] Created test log file: {}", path);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    let devtools = tauri_plugin_devtools::init();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
        // .plugin(
        //     WindowStateBuilder::new()
        //         .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
        //         .build(),
        // );

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    // Build with plugins
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {
            // Prevent multiple instances of the app
            // Note: Deep link forwarding removed - auth now uses WebSocket push
        }))
        .plugin(tauri_plugin_updater::Builder::new().pubkey("dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDNDMzFDRDcxMTEzQUNGMjYKUldRbXp6b1JjYzB4UEx0ODl6NkNtellkVXhNbnRUQ2QwRDY1ZGlvNWJmL0RkeVdMKzBudkM1WHoK").build())
        .setup(|_app| {
            // Note: Deep link protocol registration removed
            // Auth now uses WebSocket push from server instead of picologs:// deep links

            // Open DevTools automatically in dev mode
            #[cfg(debug_assertions)]
            {
                if let Some(main_window) = _app.get_webview_window("main") {
                    main_window.open_devtools();
                    println!("[Dev Mode] DevTools opened for main window");
                }
            }

            Ok(())
        });

    // Register commands - test commands only available in debug builds
    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        greet,
        close_splashscreen,
        is_debug_build,
        get_log_metadata,
        read_log_lines_from,
        get_line_count,
        read_log_update,
        // Test commands (debug only)
        test_inject_auth,
        test_select_log_file,
        test_clear_state,
        test_get_store_contents,
        test_set_store_value,
        test_append_log_line,
        test_create_log_file
    ]);

    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        greet,
        close_splashscreen,
        is_debug_build,
        get_log_metadata,
        read_log_lines_from,
        get_line_count,
        read_log_update
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ============================================================================
// Unit Tests
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // generate_signature tests
    // ========================================================================

    #[test]
    fn test_generate_signature_all_fields() {
        let signature = generate_signature(
            &Some("TestEvent".to_string()),
            &Some("Notice".to_string()),
            &["Team_A".to_string(), "Team_B".to_string()],
            &["Subsystem1".to_string()],
        );

        // Teams and subsystems should be sorted
        assert!(signature.contains("TestEvent"));
        assert!(signature.contains("Notice"));
        assert!(signature.contains("Team_A"));
        assert!(signature.contains("Team_B"));
        assert!(signature.contains("Subsystem1"));
    }

    #[test]
    fn test_generate_signature_null_values() {
        let signature = generate_signature(&None, &None, &[], &[]);

        assert_eq!(signature, "null|null||");
    }

    #[test]
    fn test_generate_signature_sorts_teams_and_subsystems() {
        let sig1 = generate_signature(
            &Some("Event".to_string()),
            &None,
            &["B".to_string(), "A".to_string()],
            &["Z".to_string(), "Y".to_string()],
        );
        let sig2 = generate_signature(
            &Some("Event".to_string()),
            &None,
            &["A".to_string(), "B".to_string()],
            &["Y".to_string(), "Z".to_string()],
        );

        // Should be identical after sorting
        assert_eq!(sig1, sig2);
    }

    // ========================================================================
    // contains_event_marker tests
    // ========================================================================

    #[test]
    fn test_contains_event_marker_positive() {
        assert!(contains_event_marker("Some text AccountLoginCharacterStatus_Character more text"));
        assert!(contains_event_marker("<Vehicle Control Flow> player entered ship"));
        assert!(contains_event_marker("<Actor Death> player killed enemy"));
        assert!(contains_event_marker("<SystemQuit> player quit"));
        assert!(contains_event_marker("<Quantum Drive Arrived> at destination"));
    }

    #[test]
    fn test_contains_event_marker_negative() {
        assert!(!contains_event_marker("This is a random log line"));
        assert!(!contains_event_marker("No markers here"));
        assert!(!contains_event_marker("<SomeOtherEvent> not tracked"));
        assert!(!contains_event_marker(""));
    }

    #[test]
    fn test_contains_event_marker_partial_match() {
        // "Destruction>" is a partial match marker
        assert!(contains_event_marker("<Vehicle Destruction> ship exploded"));
        assert!(contains_event_marker("Something Destruction> something else"));
    }

    // ========================================================================
    // extract_log_pattern tests
    // ========================================================================

    #[test]
    fn test_extract_log_pattern_with_timestamp() {
        let line = "<2024-01-01T12:00:00.000Z> [Notice] <TestEvent> Some log message";
        let pattern = extract_log_pattern(line);

        assert!(pattern.is_some());
        let p = pattern.unwrap();
        assert_eq!(p.event_name, Some("TestEvent".to_string()));
        assert_eq!(p.severity, Some("Notice".to_string()));
    }

    #[test]
    fn test_extract_log_pattern_without_timestamp() {
        let line = "[Notice] <TestEvent> Some log message without timestamp";
        let pattern = extract_log_pattern(line);

        // Should return None if no timestamp
        assert!(pattern.is_none());
    }

    #[test]
    fn test_extract_log_pattern_extracts_teams() {
        let line = "<2024-01-01T12:00:00.000Z> [Team_Blue] [Team_Red] Combat event";
        let pattern = extract_log_pattern(line).unwrap();

        assert!(pattern.teams.contains(&"Team_Blue".to_string()));
        assert!(pattern.teams.contains(&"Team_Red".to_string()));
    }

    #[test]
    fn test_extract_log_pattern_extracts_subsystems() {
        let line = "<2024-01-01T12:00:00.000Z> [Physics] [Combat] <Event> message";
        let pattern = extract_log_pattern(line).unwrap();

        assert!(pattern.subsystems.contains(&"Physics".to_string()));
        assert!(pattern.subsystems.contains(&"Combat".to_string()));
    }

    #[test]
    fn test_extract_log_pattern_excludes_severity_from_subsystems() {
        let line = "<2024-01-01T12:00:00.000Z> [Notice] [Error] <Event> message";
        let pattern = extract_log_pattern(line).unwrap();

        // Notice and Error should NOT be in subsystems (they're severity tags)
        assert!(!pattern.subsystems.contains(&"Notice".to_string()));
        assert!(!pattern.subsystems.contains(&"Error".to_string()));
    }

    #[test]
    fn test_extract_log_pattern_skips_date_events() {
        let line = "<2024-01-01T12:00:00.000Z> <2024-01-01> Some message";
        let pattern = extract_log_pattern(line).unwrap();

        // Should not extract dates as event names
        assert!(pattern.event_name.is_none() || !pattern.event_name.as_ref().unwrap().starts_with("20"));
    }

    #[test]
    fn test_extract_log_pattern_unique_signatures() {
        let line1 = "<2024-01-01T12:00:00.000Z> [Notice] <EventA> message 1";
        let line2 = "<2024-01-01T12:00:00.000Z> [Notice] <EventA> message 2";
        let line3 = "<2024-01-01T12:00:00.000Z> [Notice] <EventB> message 3";

        let p1 = extract_log_pattern(line1).unwrap();
        let p2 = extract_log_pattern(line2).unwrap();
        let p3 = extract_log_pattern(line3).unwrap();

        // Same event type should have same signature
        assert_eq!(p1.signature, p2.signature);

        // Different event type should have different signature
        assert_ne!(p1.signature, p3.signature);
    }

    // ========================================================================
    // RawLogPattern struct tests
    // ========================================================================

    #[test]
    fn test_raw_log_pattern_serialization() {
        let pattern = RawLogPattern {
            event_name: Some("TestEvent".to_string()),
            severity: Some("Notice".to_string()),
            teams: vec!["Team_A".to_string()],
            subsystems: vec!["Physics".to_string()],
            signature: "test-signature".to_string(),
            example_line: "example line".to_string(),
        };

        // Test that it serializes correctly (camelCase)
        let json = serde_json::to_string(&pattern).unwrap();
        assert!(json.contains("\"eventName\""));
        assert!(json.contains("\"exampleLine\""));
    }

    // ========================================================================
    // LogUpdate struct tests
    // ========================================================================

    #[test]
    fn test_log_update_serialization() {
        let update = LogUpdate {
            line_count: 100,
            player_name: Some("TestPlayer".to_string()),
            new_lines: vec!["line1".to_string(), "line2".to_string()],
            patterns: vec![],
        };

        let json = serde_json::to_string(&update).unwrap();
        assert!(json.contains("\"line_count\":100"));
        assert!(json.contains("\"player_name\":\"TestPlayer\""));
        assert!(json.contains("\"new_lines\""));
    }

    // ========================================================================
    // Event marker coverage tests
    // ========================================================================

    #[test]
    fn test_all_event_markers_documented() {
        // Verify that EVENT_MARKERS is not empty
        assert!(!EVENT_MARKERS.is_empty());

        // Verify each category has at least one marker
        let connection_markers: Vec<_> = EVENT_MARKERS.iter()
            .filter(|m| m.contains("Login") || m.contains("Quit"))
            .collect();
        assert!(!connection_markers.is_empty(), "Should have connection markers");

        let vehicle_markers: Vec<_> = EVENT_MARKERS.iter()
            .filter(|m| m.contains("Vehicle") || m.contains("Quantum") || m.contains("Jump"))
            .collect();
        assert!(!vehicle_markers.is_empty(), "Should have vehicle markers");

        let combat_markers: Vec<_> = EVENT_MARKERS.iter()
            .filter(|m| m.contains("Death") || m.contains("Dead") || m.contains("Collision"))
            .collect();
        assert!(!combat_markers.is_empty(), "Should have combat markers");
    }
}

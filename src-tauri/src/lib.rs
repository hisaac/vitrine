mod album;

use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(serde::Serialize)]
struct Album {
    folder: String,
    files: Vec<String>,
}

fn open_album(app: &tauri::AppHandle, folder: String) -> Result<Album, String> {
    let folder = std::fs::canonicalize(folder).map_err(|e| format!("Cannot open folder: {e}"))?;
    let paths = album::scan(&folder)?;
    for path in &paths {
        app.asset_protocol_scope()
            .allow_file(path)
            .map_err(|e| e.to_string())?;
    }
    Ok(Album {
        folder: folder
            .to_str()
            .ok_or("This folder's name is not supported")?
            .to_owned(),
        files: paths
            .into_iter()
            .filter_map(|p| p.into_os_string().into_string().ok())
            .collect(),
    })
}

#[tauri::command]
async fn load_folder(app: tauri::AppHandle, folder: String) -> Result<Album, String> {
    tauri::async_runtime::spawn_blocking(move || open_album(&app, folder))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn choose_folder(app: tauri::AppHandle) -> Result<Option<Album>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(folder) = app
            .dialog()
            .file()
            .set_title("Choose an art folder")
            .blocking_pick_folder()
        else {
            return Ok(None);
        };
        let path = folder.into_path().map_err(|e| e.to_string())?;
        open_album(
            &app,
            path.to_str()
                .ok_or("This folder's name is not supported")?
                .to_owned(),
        )
        .map(Some)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![choose_folder, load_folder])
        .run(tauri::generate_context!())
        .expect("error while running Vitrine");
}

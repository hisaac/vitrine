use std::path::{Path, PathBuf};

pub fn scan(folder: &Path) -> Result<Vec<PathBuf>, String> {
    let entries = std::fs::read_dir(folder).map_err(|e| format!("Cannot open folder: {e}"))?;
    let mut files = Vec::new();
    for entry in entries {
        let Ok(entry) = entry else { continue };
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        if !kind.is_file() || entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if matches!(
            extension.as_str(),
            "jpg" | "jpeg" | "png" | "webp" | "gif" | "avif" | "bmp"
        ) && path.to_str().is_some()
        {
            files.push(path);
        }
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lists_only_supported_regular_files_in_the_selected_directory() {
        let folder = std::env::temp_dir().join(format!("vitrine-scan-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        for name in [
            "art.JPG",
            "second.png",
            "animation.gif",
            "notes.txt",
            ".hidden.jpg",
        ] {
            std::fs::write(folder.join(name), b"fixture").unwrap();
        }
        std::fs::create_dir_all(folder.join("nested.jpg")).unwrap();
        std::fs::write(folder.join("nested.jpg/inside.jpg"), b"fixture").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(folder.join("art.JPG"), folder.join("link.jpg")).unwrap();
        let mut names: Vec<_> = scan(&folder)
            .unwrap()
            .into_iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        names.sort();
        std::fs::remove_dir_all(folder).unwrap();
        assert_eq!(names, ["animation.gif", "art.JPG", "second.png"]);
    }
    #[test]
    fn missing_folder_reports_an_error() {
        assert!(scan(Path::new("/vitrine-folder-that-does-not-exist")).is_err());
    }
}

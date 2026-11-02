fn main() {
    tauri_plugin::Builder::new(&["scan"])
        .ios_path("ios")
        .build();
}

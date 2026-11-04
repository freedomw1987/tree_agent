fn main() {
    tauri_plugin::Builder::new(&["speak", "stop", "status"])
        .ios_path("ios")
        .build();
}
